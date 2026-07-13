import { BadRequestException, Injectable } from '@nestjs/common';
import {
  parse,
  type AssignmentExpression,
  type MemberExpression,
  type Node,
} from 'acorn';
import * as walk from 'acorn-walk';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

import { APP_SERVICE_HOST_SOURCE } from '../runtime/app-service-host';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import {
  AppManifestService,
  type NormalizedServiceManifest,
} from './app-manifest.service';
import { AppPackageStorageService } from './app-package-storage.service';

export interface AppServiceScanFinding {
  code: string;
  severity: 'error' | 'warning';
  line?: number;
  column?: number;
}

export interface AppServiceScanResult {
  passed: boolean;
  findings: AppServiceScanFinding[];
  scannedFiles: number;
  entrySha256: string;
}

export interface ServicePackageInstallResult {
  manifest: NormalizedServiceManifest;
  releaseDir: string;
  entryFile: 'dist/index.js';
  fileSize: number;
  packageSha256: string;
  scanResult: AppServiceScanResult;
}

interface ScanAndInstallInput {
  appCode: string;
  zipBuffer: Buffer;
}

const SERVICE_ARCHIVE_FILES = new Set(['app.manifest.json', 'dist/index.js']);
const FORBIDDEN_GLOBALS = new Set([
  'fetch',
  'WebSocket',
  'process',
  'Bun',
  'Deno',
  'global',
  'globalThis',
  'module',
]);
const FORBIDDEN_CALLS = new Set(['eval', 'Function']);
const FORBIDDEN_MEMBER_NAMES = new Set(['constructor', 'prototype', '__proto__']);
const MAX_FINDINGS = 50;
const MAX_MANIFEST_BYTES = 64 * 1024;

@Injectable()
export class AppServicePackageService {
  constructor(
    private readonly manifestService: AppManifestService,
    private readonly storage: AppPackageStorageService,
  ) {}

  async scanAndInstall(input: ScanAndInstallInput): Promise<ServicePackageInstallResult> {
    if (!Buffer.isBuffer(input.zipBuffer) || input.zipBuffer.length === 0) {
      throw new BadRequestException('Service package file is required');
    }
    if (input.zipBuffer.length > this.storage.getMaxPackageSizeBytes()) {
      throw new BadRequestException('Service package is too large');
    }

    const zip = await this.loadZip(input.zipBuffer);
    const archiveFiles = this.validateArchive(zip);
    this.storage.assertArchiveLimits([...archiveFiles.values()], 'Service package');
    const manifestBuffer = await archiveFiles.get('app.manifest.json')!.async('nodebuffer');
    if (manifestBuffer.length > MAX_MANIFEST_BYTES) {
      throw new BadRequestException('Service manifest is too large');
    }

    const manifest = this.manifestService.validateServiceManifest(
      this.parseManifest(manifestBuffer.toString('utf8')),
    );
    if (manifest.code !== input.appCode) {
      throw new BadRequestException('Manifest code does not match app code');
    }

    const entryBuffer = await archiveFiles.get(manifest.entry)!.async('nodebuffer');
    if (entryBuffer.length > this.storage.getMaxPackageFileBytes()) {
      throw new BadRequestException('Service entry is too large');
    }
    const source = entryBuffer.toString('utf8');
    const entrySha256 = this.sha256(entryBuffer);
    const scanResult = this.scanSource(source, entrySha256);
    if (!scanResult.passed) {
      throw new BadRequestException({
        message: 'Service package failed security scan',
        scan_result: scanResult,
      });
    }

    const packageSha256 = this.sha256(input.zipBuffer);
    const releaseDir = this.installRelease({
      manifest,
      source,
      packageSha256,
    });

    return {
      manifest,
      releaseDir,
      entryFile: manifest.entry,
      fileSize: input.zipBuffer.length,
      packageSha256,
      scanResult,
    };
  }

  async verifyInstalledEntry(
    version: Pick<AppPackageVersionEntity, 'packagePath' | 'entryFile' | 'scanResult'>,
  ): Promise<void> {
    const runtimeRoot = this.storage.getServiceRuntimeRoot();
    const releaseDir = path.resolve(String(version.packagePath || ''));
    if (
      version.entryFile !== 'dist/index.js' ||
      !this.isPathInside(releaseDir, runtimeRoot)
    ) {
      throw new BadRequestException('Invalid installed service entry');
    }

    const entryPath = path.resolve(releaseDir, 'dist', 'index.js');
    if (!this.isPathInside(entryPath, releaseDir)) {
      throw new BadRequestException('Invalid installed service entry');
    }

    try {
      const releaseStat = fs.lstatSync(releaseDir);
      const distDir = path.join(releaseDir, 'dist');
      const distStat = fs.lstatSync(distDir);
      const entryStat = fs.lstatSync(entryPath);
      if (
        releaseStat.isSymbolicLink() ||
        !releaseStat.isDirectory() ||
        distStat.isSymbolicLink() ||
        !distStat.isDirectory() ||
        entryStat.isSymbolicLink() ||
        !entryStat.isFile()
      ) {
        throw new Error('invalid_entry');
      }
      const realRoot = fs.realpathSync(runtimeRoot);
      const realEntry = fs.realpathSync(entryPath);
      if (!this.isPathInside(realEntry, realRoot)) throw new Error('escaped_entry');
    } catch {
      throw new BadRequestException('Invalid installed service entry');
    }

    const expectedHash = String(version.scanResult?.entrySha256 || '');
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new BadRequestException('Invalid reviewed service entry checksum');
    }

    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(entryPath)) {
      hash.update(chunk as Buffer);
    }
    const actualHash = hash.digest('hex');
    if (!timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(actualHash, 'hex'))) {
      throw new BadRequestException(
        'Installed service entry checksum does not match reviewed content',
      );
    }
  }

  private async loadZip(buffer: Buffer) {
    try {
      return await JSZip.loadAsync(buffer);
    } catch {
      throw new BadRequestException('Invalid service package zip');
    }
  }

  private validateArchive(zip: JSZip) {
    const files = new Map<string, JSZip.JSZipObject>();
    for (const zipFile of Object.values(zip.files)) {
      if (this.isSymbolicLink(zipFile)) {
        throw new BadRequestException('Service package symbolic links are not allowed');
      }
      if (zipFile.dir) continue;

      const archiveEntry = zipFile as JSZip.JSZipObject & { unsafeOriginalName?: unknown };
      const rawName =
        typeof archiveEntry.unsafeOriginalName === 'string'
          ? archiveEntry.unsafeOriginalName
          : zipFile.name;
      const name = this.normalizeArchivePath(rawName);
      if (rawName !== name || !SERVICE_ARCHIVE_FILES.has(name) || files.has(name)) {
        throw new BadRequestException('Service package contains unsupported files');
      }
      files.set(name, zipFile);
    }

    if (files.size !== SERVICE_ARCHIVE_FILES.size) {
      throw new BadRequestException('Service package must contain app.manifest.json and dist/index.js');
    }
    return files;
  }

  private normalizeArchivePath(value: string) {
    const normalized = value.replace(/\\/g, '/');
    const resolved = path.posix.normalize(normalized);
    if (
      !normalized ||
      normalized.startsWith('/') ||
      normalized.includes('\0') ||
      resolved === '.' ||
      resolved.startsWith('../') ||
      resolved.includes('/../') ||
      path.posix.isAbsolute(resolved)
    ) {
      throw new BadRequestException('Invalid service package path');
    }
    return resolved;
  }

  private isSymbolicLink(zipFile: JSZip.JSZipObject) {
    const permissions = Number(zipFile.unixPermissions || 0);
    return Boolean(permissions && (permissions & 0o170000) === 0o120000);
  }

  private parseManifest(value: string) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new BadRequestException('Invalid service manifest json');
    }
  }

  private scanSource(source: string, entrySha256: string): AppServiceScanResult {
    let ast: Node;
    try {
      ast = parse(source, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        allowHashBang: false,
      });
    } catch {
      throw new BadRequestException('Service entry is not valid JavaScript');
    }

    const findings: AppServiceScanFinding[] = [];
    const exports = new Set<string>();
    const addFinding = (code: string, node: Node) => {
      if (findings.length >= MAX_FINDINGS) return;
      findings.push({
        code,
        severity: 'error',
        line: node?.loc?.start?.line,
        column: node?.loc?.start?.column,
      });
    };

    const visitors: walk.SimpleVisitors<undefined> = {
      ImportDeclaration: (node) => addFinding('forbidden_module', node),
      ImportExpression: (node) => addFinding('dynamic_import', node),
      CallExpression: (node) => {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'require') {
          addFinding('forbidden_module', node);
        }
        if (node.callee?.type === 'Identifier' && FORBIDDEN_CALLS.has(node.callee.name)) {
          addFinding('forbidden_call', node);
        }
      },
      NewExpression: (node) => {
        if (node.callee?.type === 'Identifier' && node.callee.name === 'Function') {
          addFinding('forbidden_call', node);
        }
      },
      MemberExpression: (node) => {
        const memberName = this.getStaticMemberName(node);
        if (FORBIDDEN_MEMBER_NAMES.has(memberName)) {
          addFinding('forbidden_constructor_escape', node);
        }
        if (
          node.object?.type === 'Identifier' &&
          node.object.name === 'module' &&
          ((!node.computed &&
            node.property.type === 'Identifier' &&
            node.property.name === 'require') ||
            (node.computed &&
              node.property.type === 'Literal' &&
              node.property.value === 'require'))
        ) {
          addFinding('forbidden_module', node);
        }
      },
      Identifier: (node) => {
        if (node.name === 'require') {
          addFinding('forbidden_module', node);
          return;
        }
        if (FORBIDDEN_CALLS.has(node.name)) {
          addFinding('forbidden_call', node);
          return;
        }
        if (FORBIDDEN_GLOBALS.has(node.name)) {
          addFinding('forbidden_global', node);
        }
      },
      AssignmentExpression: (node) => {
        const exportedName = this.getCommonJsExportName(node.left);
        if (exportedName) exports.add(exportedName);
      },
    };
    // Source scanning is defense in depth; service execution still requires process isolation.
    walk.simple(ast, visitors);

    if (!exports.has('health') || !exports.has('invoke')) {
      throw new BadRequestException('Service entry must export health and invoke');
    }

    return {
      passed: findings.length === 0,
      findings,
      scannedFiles: 1,
      entrySha256,
    };
  }

  private getCommonJsExportName(node: AssignmentExpression['left']) {
    if (node?.type !== 'MemberExpression' || node.object?.type !== 'Identifier') return '';
    if (node.object.name !== 'exports') return '';
    const member = node as MemberExpression;
    if (!member.computed && member.property.type === 'Identifier') return member.property.name;
    if (member.computed && member.property.type === 'Literal') {
      return String(member.property.value || '');
    }
    return '';
  }

  private getStaticMemberName(node: MemberExpression) {
    if (!node.computed && node.property.type === 'Identifier') return node.property.name;
    if (node.computed && node.property.type === 'Literal') {
      return typeof node.property.value === 'string' ? node.property.value : '';
    }
    return '';
  }

  private installRelease(input: {
    manifest: NormalizedServiceManifest;
    source: string;
    packageSha256: string;
  }) {
    const releaseDir = this.storage.resolveServiceReleasePath(
      input.manifest.code,
      input.manifest.version,
    );
    if (fs.existsSync(releaseDir)) {
      this.assertExistingRelease(
        releaseDir,
        input.packageSha256,
        input.manifest,
        input.source,
      );
      return releaseDir;
    }

    const appDir = path.dirname(releaseDir);
    fs.mkdirSync(appDir, { recursive: true, mode: 0o755 });
    const stagingDir = path.join(appDir, `.staging-${input.manifest.version}-${randomUUID()}`);
    try {
      fs.mkdirSync(path.join(stagingDir, 'dist'), { recursive: true, mode: 0o755 });
      fs.writeFileSync(
        path.join(stagingDir, 'app.manifest.json'),
        `${JSON.stringify(input.manifest, null, 2)}\n`,
        { mode: 0o444 },
      );
      fs.writeFileSync(path.join(stagingDir, 'dist', 'index.js'), input.source, { mode: 0o444 });
      fs.writeFileSync(path.join(stagingDir, 'agentstudio-host.cjs'), APP_SERVICE_HOST_SOURCE, {
        mode: 0o444,
      });
      fs.writeFileSync(
        path.join(stagingDir, '.agentstudio-release.json'),
        JSON.stringify({ package_sha256: input.packageSha256 }),
        { mode: 0o444 },
      );
      this.makeReleaseReadOnly(stagingDir);
      try {
        fs.renameSync(stagingDir, releaseDir);
      } catch (error) {
        if (!fs.existsSync(releaseDir)) throw error;
        this.assertExistingRelease(
          releaseDir,
          input.packageSha256,
          input.manifest,
          input.source,
        );
      }
      return releaseDir;
    } finally {
      if (fs.existsSync(stagingDir)) {
        this.makeWritable(stagingDir);
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    }
  }

  private assertExistingRelease(
    releaseDir: string,
    packageSha256: string,
    manifest: NormalizedServiceManifest,
    source: string,
  ) {
    const releaseStat = fs.lstatSync(releaseDir);
    if (releaseStat.isSymbolicLink() || !releaseStat.isDirectory()) {
      throw new BadRequestException('Invalid installed service release');
    }
    try {
      const rootEntries = fs.readdirSync(releaseDir).sort();
      const distDir = path.join(releaseDir, 'dist');
      const distStat = fs.lstatSync(distDir);
      const distEntries = fs.readdirSync(distDir).sort();
      if (
        distStat.isSymbolicLink() ||
        !distStat.isDirectory() ||
        JSON.stringify(rootEntries) !==
          JSON.stringify([
            '.agentstudio-release.json',
            'agentstudio-host.cjs',
            'app.manifest.json',
            'dist',
          ]) ||
        JSON.stringify(distEntries) !== JSON.stringify(['index.js'])
      ) {
        throw new Error('unexpected_release_files');
      }

      const manifestPath = path.join(releaseDir, 'app.manifest.json');
      const manifestStat = fs.lstatSync(manifestPath);
      const storedManifest = this.manifestService.validateServiceManifest(
        this.parseManifest(fs.readFileSync(manifestPath, 'utf8')),
      );
      if (
        manifestStat.isSymbolicLink() ||
        !manifestStat.isFile() ||
        JSON.stringify(storedManifest) !== JSON.stringify(manifest)
      ) {
        throw new Error('release_manifest_mismatch');
      }

      const expectedFiles = new Map<string, string>([
        ['.agentstudio-release.json', JSON.stringify({ package_sha256: packageSha256 })],
        ['agentstudio-host.cjs', APP_SERVICE_HOST_SOURCE],
        ['dist/index.js', source],
      ]);
      for (const [relativePath, expected] of expectedFiles) {
        const target = path.join(releaseDir, ...relativePath.split('/'));
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink() || !stat.isFile() || fs.readFileSync(target, 'utf8') !== expected) {
          throw new Error('release_file_mismatch');
        }
      }
      return;
    } catch {
      // A missing or malformed marker is treated as a checksum mismatch.
    }
    throw new BadRequestException('Service release checksum does not match the installed version');
  }

  private makeReleaseReadOnly(root: string) {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) {
        this.makeReleaseReadOnly(target);
        fs.chmodSync(target, 0o555);
      } else {
        fs.chmodSync(target, 0o444);
      }
    }
    fs.chmodSync(root, 0o555);
  }

  private makeWritable(root: string) {
    fs.chmodSync(root, 0o755);
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const target = path.join(root, entry.name);
      if (entry.isDirectory()) this.makeWritable(target);
      else fs.chmodSync(target, 0o644);
    }
  }

  private isPathInside(candidatePath: string, rootPath: string) {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedCandidate = path.resolve(candidatePath);
    const root = process.platform === 'win32' ? resolvedRoot.toLowerCase() : resolvedRoot;
    const candidate =
      process.platform === 'win32' ? resolvedCandidate.toLowerCase() : resolvedCandidate;
    const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    return candidate.startsWith(rootWithSep);
  }

  private sha256(value: Buffer) {
    return createHash('sha256').update(value).digest('hex');
  }
}
