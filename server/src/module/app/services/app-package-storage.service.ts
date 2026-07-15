import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

export interface PublishAppVersionInput {
  appCode: string;
  version: string;
  sourceDir: string;
  entryFile: string;
  expectedContentHash: string;
}

export interface PublishAppVersionResult {
  publishPath: string;
  entryUrl: string;
}

export interface ExtractStaticPackageInput {
  appCode: string;
  version: string;
  zipBuffer: Buffer;
}

export interface ExtractStaticPackageResult {
  packagePath: string;
  contentHash: string;
}

type ZipEntryWithSizes = JSZip.JSZipObject & {
  _data?: {
    compressedSize?: unknown;
    uncompressedSize?: unknown;
  };
};

@Injectable()
export class AppPackageStorageService {
  constructor(private readonly config: ConfigService) {}

  getPackageRoot() {
    return path.resolve(process.cwd(), this.config.get<string>('appMarketplace.packageDir') || '../upload/app-packages');
  }

  getPublicRoot() {
    return path.resolve(process.cwd(), this.config.get<string>('appMarketplace.publicDir') || '../upload/app-public');
  }

  getServiceRuntimeRoot() {
    return path.resolve(
      process.cwd(),
      this.config.get<string>('appMarketplace.serviceRuntime.rootDir') ||
        '../upload/app-service-runtime',
    );
  }

  getPublicPrefix() {
    const raw = this.config.get<string>('appMarketplace.publicPrefix') || '/apps-static/';
    const trimmed = raw.trim() || '/apps-static/';
    const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
  }

  getMaxPackageSizeBytes() {
    const maxMb = Number(this.config.get<number>('appMarketplace.maxPackageSizeMb') ?? 50);
    return Math.max(1, maxMb) * 1024 * 1024;
  }

  getMaxPackageFiles() {
    const maxFiles = Number(this.config.get<number>('appMarketplace.maxPackageFiles') ?? 500);
    return Math.max(1, maxFiles);
  }

  getMaxPackageFileBytes() {
    const maxMb = Number(this.config.get<number>('appMarketplace.maxPackageFileMb') ?? 25);
    return Math.max(1, maxMb) * 1024 * 1024;
  }

  getMaxPackageUncompressedBytes() {
    const maxMb = Number(
      this.config.get<number>('appMarketplace.maxPackageUncompressedMb') ?? 200,
    );
    return Math.max(1, maxMb) * 1024 * 1024;
  }

  getMaxPackageCompressionRatio() {
    const ratio = Number(
      this.config.get<number>('appMarketplace.maxPackageCompressionRatio') ?? 100,
    );
    return Math.max(1, ratio);
  }

  assertArchiveLimits(zipFiles: JSZip.JSZipObject[], packageLabel = 'App package') {
    let totalUncompressedBytes = 0;
    for (const zipFile of zipFiles) {
      const { compressedSize, uncompressedSize } = this.getZipEntrySizes(zipFile, packageLabel);
      if (uncompressedSize > this.getMaxPackageFileBytes()) {
        throw new BadRequestException(`${packageLabel} file exceeds the limit`);
      }
      totalUncompressedBytes += uncompressedSize;
      if (totalUncompressedBytes > this.getMaxPackageUncompressedBytes()) {
        throw new BadRequestException(`${packageLabel} uncompressed size exceeds the limit`);
      }
      if (
        uncompressedSize > 0 &&
        uncompressedSize / Math.max(1, compressedSize) > this.getMaxPackageCompressionRatio()
      ) {
        throw new BadRequestException(`${packageLabel} compression ratio exceeds the limit`);
      }
    }
  }

  resolvePackagePath(...segments: string[]) {
    return this.resolveInside(this.getPackageRoot(), 'Invalid app package path', ...segments);
  }

  resolvePublicPath(...segments: string[]) {
    return this.resolveInside(this.getPublicRoot(), 'Invalid app public path', ...segments);
  }

  resolveServiceReleasePath(appCode: string, version: string) {
    const safeCode = this.safeSegment(appCode, 'Invalid service release path');
    const safeVersion = this.safeVersion(version);
    return this.resolveInside(
      this.getServiceRuntimeRoot(),
      'Invalid service release path',
      safeCode,
      safeVersion,
    );
  }

  async extractStaticPackage(input: ExtractStaticPackageInput): Promise<ExtractStaticPackageResult> {
    const appCode = this.safeSegment(input.appCode, 'Invalid app code');
    const version = this.safeVersion(input.version);
    if (!Buffer.isBuffer(input.zipBuffer) || input.zipBuffer.length === 0) {
      throw new BadRequestException('App package file is required');
    }
    if (input.zipBuffer.length > this.getMaxPackageSizeBytes()) {
      throw new BadRequestException('App package is too large');
    }

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(input.zipBuffer);
    } catch {
      throw new BadRequestException('Invalid app package zip');
    }
    const zipFiles = Object.values(zip.files).filter((zipFile) => !zipFile.dir);
    if (zipFiles.length > this.getMaxPackageFiles()) {
      throw new BadRequestException('App package contains too many files');
    }
    this.assertArchiveLimits(zipFiles);

    const packagePath = this.resolvePackagePath(appCode, version);
    const stagingPath = this.resolvePackagePath(
      appCode,
      `.staging-${version}-${randomUUID()}`,
    );
    await fs.promises.mkdir(stagingPath, { recursive: true });
    let actualUncompressedBytes = 0;
    try {
      for (const zipFile of zipFiles) {
        const entryName = this.normalizeRelativeFile(this.getZipEntryName(zipFile));
        const targetPath = path.resolve(stagingPath, ...entryName.split('/'));
        if (!this.isPathInside(targetPath, stagingPath)) {
          throw new BadRequestException('Invalid app package path');
        }
        const fileBuffer = await zipFile.async('nodebuffer');
        if (fileBuffer.length > this.getMaxPackageFileBytes()) {
          throw new BadRequestException('App package file exceeds the limit');
        }
        actualUncompressedBytes += fileBuffer.length;
        if (actualUncompressedBytes > this.getMaxPackageUncompressedBytes()) {
          throw new BadRequestException('App package uncompressed size exceeds the limit');
        }
        await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.promises.writeFile(targetPath, fileBuffer);
      }
      await fs.promises.rm(packagePath, { recursive: true, force: true });
      await fs.promises.rename(stagingPath, packagePath);
    } finally {
      await fs.promises.rm(stagingPath, { recursive: true, force: true });
    }

    return { packagePath, contentHash: await this.hashDirectory(packagePath) };
  }

  async hashDirectory(rootDir: string) {
    const resolvedRoot = path.resolve(rootDir);
    if (!this.isPathInside(resolvedRoot, this.getPackageRoot())) {
      throw new BadRequestException('Invalid app package path');
    }
    const files = await this.collectRegularFiles(resolvedRoot);
    const hash = createHash('sha256');
    hash.update('agentstudio-static-content-v1\0');
    for (const relativePath of files) {
      const pathBytes = Buffer.from(relativePath, 'utf8');
      const content = await fs.promises.readFile(
        path.resolve(resolvedRoot, ...relativePath.split('/')),
      );
      hash.update(this.lengthFrame(pathBytes.length));
      hash.update(pathBytes);
      hash.update(this.lengthFrame(content.length));
      hash.update(content);
    }
    return hash.digest('hex');
  }

  async publishVersion(input: PublishAppVersionInput): Promise<PublishAppVersionResult> {
    const appCode = this.safeSegment(input.appCode, 'Invalid app code');
    const version = this.safeVersion(input.version);
    const sourceDir = path.resolve(input.sourceDir);
    if (!this.isPathInside(sourceDir, this.getPackageRoot())) {
      throw new BadRequestException('Invalid app package path');
    }
    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new BadRequestException('App package source not found');
    }
    const expectedContentHash = String(input.expectedContentHash || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedContentHash)) {
      throw new BadRequestException('App package content integrity metadata is missing');
    }
    const actualContentHash = await this.hashDirectory(sourceDir);
    if (actualContentHash !== expectedContentHash) {
      throw new BadRequestException('App package content integrity check failed');
    }

    const entryFile = this.normalizeRelativeFile(input.entryFile);
    const sourceEntry = path.resolve(sourceDir, ...entryFile.split('/'));
    if (!this.isPathInside(sourceEntry, sourceDir) || !fs.existsSync(sourceEntry)) {
      throw new BadRequestException('App entry file not found');
    }

    const publishPath = this.resolvePublicPath(appCode, version);
    const publishParent = path.dirname(publishPath);
    const stagingPath = this.resolvePublicPath(
      appCode,
      `.staging-${version}-${randomUUID()}`,
    );
    const backupPath = this.resolvePublicPath(appCode, `.backup-${version}-${randomUUID()}`);
    let backupCreated = false;
    fs.mkdirSync(publishParent, { recursive: true });
    try {
      fs.rmSync(stagingPath, { recursive: true, force: true });
      this.copyDirectorySync(sourceDir, stagingPath);
      if (fs.existsSync(publishPath)) {
        fs.renameSync(publishPath, backupPath);
        backupCreated = true;
      }
      fs.renameSync(stagingPath, publishPath);
      if (backupCreated) {
        fs.rmSync(backupPath, { recursive: true, force: true });
        backupCreated = false;
      }
    } catch (error) {
      fs.rmSync(stagingPath, { recursive: true, force: true });
      if (backupCreated && !fs.existsSync(publishPath) && fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, publishPath);
        backupCreated = false;
      }
      throw error;
    } finally {
      fs.rmSync(stagingPath, { recursive: true, force: true });
      if (backupCreated && fs.existsSync(publishPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
    }

    return {
      publishPath,
      entryUrl: `${this.getPublicPrefix()}${appCode}/${version}/${entryFile}`,
    };
  }

  protected copyDirectorySync(sourceDir: string, targetDir: string) {
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  }

  private resolveInside(rootPath: string, message: string, ...segments: string[]) {
    const target = path.resolve(rootPath, ...segments);
    if (!this.isPathInside(target, rootPath)) {
      throw new BadRequestException(message);
    }
    return target;
  }

  private isPathInside(candidatePath: string, rootPath: string) {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedCandidate = path.resolve(candidatePath);
    const root = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
    const candidate = process.platform === 'win32' ? resolvedCandidate.toLowerCase() : resolvedCandidate;
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return candidate === root || candidate.startsWith(rootWithSep);
  }

  private safeSegment(value: string, message: string) {
    const segment = String(value || '').trim();
    if (!/^[a-z][a-z0-9_]{2,79}$/.test(segment)) {
      throw new BadRequestException(message);
    }
    return segment;
  }

  private safeVersion(value: string) {
    const version = String(value || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
      throw new BadRequestException('Invalid app version');
    }
    return version;
  }

  private normalizeRelativeFile(value: string) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === '.' || resolved.startsWith('../') || resolved.includes('/../')) {
      throw new BadRequestException('Invalid app entry');
    }
    return resolved;
  }

  private getZipEntryName(zipFile: JSZip.JSZipObject) {
    return String((zipFile as any).unsafeOriginalName || zipFile.name || '');
  }

  private async collectRegularFiles(rootDir: string) {
    const files: string[] = [];
    const visit = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
      for (const entry of entries) {
        const absolutePath = path.resolve(currentDir, entry.name);
        if (!this.isPathInside(absolutePath, rootDir)) {
          throw new BadRequestException('Invalid app package path');
        }
        if (entry.isSymbolicLink()) {
          throw new BadRequestException('App package contains unsupported filesystem entries');
        }
        if (entry.isDirectory()) {
          await visit(absolutePath);
          continue;
        }
        if (!entry.isFile()) {
          throw new BadRequestException('App package contains unsupported filesystem entries');
        }
        files.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
      }
    };
    await visit(rootDir);
    files.sort((left, right) => left.localeCompare(right, 'en'));
    return files;
  }

  private lengthFrame(length: number) {
    const frame = Buffer.allocUnsafe(8);
    frame.writeBigUInt64BE(BigInt(length));
    return frame;
  }

  private getZipEntrySizes(zipFile: JSZip.JSZipObject, packageLabel: string) {
    const data = (zipFile as ZipEntryWithSizes)._data;
    const compressedSize = Number(data?.compressedSize);
    const uncompressedSize = Number(data?.uncompressedSize);
    if (
      !Number.isSafeInteger(compressedSize) ||
      compressedSize < 0 ||
      !Number.isSafeInteger(uncompressedSize) ||
      uncompressedSize < 0
    ) {
      throw new BadRequestException(`${packageLabel} has invalid archive metadata`);
    }
    return { compressedSize, uncompressedSize };
  }
}
