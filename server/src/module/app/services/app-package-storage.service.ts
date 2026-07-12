import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

export interface PublishAppVersionInput {
  appCode: string;
  version: string;
  sourceDir: string;
  entryFile: string;
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
}

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

    const packagePath = this.resolvePackagePath(appCode, version);
    fs.rmSync(packagePath, { recursive: true, force: true });
    fs.mkdirSync(packagePath, { recursive: true });

    for (const zipFile of zipFiles) {
      const entryName = this.normalizeRelativeFile(this.getZipEntryName(zipFile));
      const targetPath = path.resolve(packagePath, ...entryName.split('/'));
      if (!this.isPathInside(targetPath, packagePath)) {
        throw new BadRequestException('Invalid app package path');
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, await zipFile.async('nodebuffer'));
    }

    return { packagePath };
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

    const entryFile = this.normalizeRelativeFile(input.entryFile);
    const sourceEntry = path.resolve(sourceDir, ...entryFile.split('/'));
    if (!this.isPathInside(sourceEntry, sourceDir) || !fs.existsSync(sourceEntry)) {
      throw new BadRequestException('App entry file not found');
    }

    const publishPath = this.resolvePublicPath(appCode, version);
    fs.rmSync(publishPath, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(publishPath), { recursive: true });
    fs.cpSync(sourceDir, publishPath, { recursive: true });

    return {
      publishPath,
      entryUrl: `${this.getPublicPrefix()}${appCode}/${version}/${entryFile}`,
    };
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
}
