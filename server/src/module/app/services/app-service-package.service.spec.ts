import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import JSZip from 'jszip';

import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppManifestService } from './app-manifest.service';
import { AppPackageStorageService } from './app-package-storage.service';
import { AppServicePackageService } from './app-service-package.service';

describe('AppServicePackageService', () => {
  let tempRoot: string;
  let service: AppServicePackageService;

  const manifest = {
    manifestVersion: 2,
    code: 'admin_echo_service',
    version: '1.0.0',
    runtime: 'service',
    entry: 'dist/index.js',
    healthPath: '/health',
    capabilities: [],
    allowedOrigins: [],
  };
  const validSource = [
    "'use strict';",
    "exports.health = async function health() { return { status: 'ok' }; };",
    'exports.invoke = async function invoke(request) { return { echo: request }; };',
  ].join('\n');

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-service-package-'));
    const storage = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.serviceRuntime.rootDir') return tempRoot;
        if (key === 'appMarketplace.maxPackageSizeMb') return 10;
        return fallback;
      }),
    } as any);
    service = new AppServicePackageService(new AppManifestService(), storage);
  });

  afterEach(() => {
    fs.chmodSync(tempRoot, 0o755);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('scans and atomically installs an immutable single-entry service release', async () => {
    const zipBuffer = await createZip(manifest, validSource);

    const result = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer,
    });

    expect(result).toMatchObject({
      manifest,
      entryFile: 'dist/index.js',
      fileSize: zipBuffer.length,
      scanResult: {
        passed: true,
        findings: [],
        scannedFiles: 1,
        entrySha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      packageSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.releaseDir).toBe(path.join(tempRoot, 'admin_echo_service', '1.0.0'));
    expect(fs.readFileSync(path.join(result.releaseDir, 'dist/index.js'), 'utf8')).toBe(validSource);
    expect(fs.existsSync(path.join(result.releaseDir, 'agentstudio-host.cjs'))).toBe(true);
    expect(
      JSON.parse(fs.readFileSync(path.join(result.releaseDir, '.agentstudio-release.json'), 'utf8')),
    ).toEqual({ package_sha256: result.packageSha256 });
  });

  it('accepts an identical release idempotently and rejects checksum replacement', async () => {
    const first = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer: await createZip(manifest, validSource),
    });
    const second = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer: await createZip(manifest, validSource),
    });
    expect(second.releaseDir).toBe(first.releaseDir);

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await createZip(manifest, `${validSource}\nexports.changed = true;`),
      }),
    ).rejects.toThrow('Service release checksum does not match the installed version');
  });

  it('accepts an existing P10 release whose manifest predates empty service targets', async () => {
    const zipBuffer = await createZip(manifest, validSource);
    const installed = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer,
    });
    const manifestPath = path.join(installed.releaseDir, 'app.manifest.json');
    const legacyManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    delete legacyManifest.serviceTargets;
    fs.chmodSync(manifestPath, 0o644);
    fs.writeFileSync(manifestPath, `${JSON.stringify(legacyManifest, null, 2)}\n`);

    await expect(
      service.scanAndInstall({ appCode: 'admin_echo_service', zipBuffer }),
    ).resolves.toMatchObject({ releaseDir: installed.releaseDir });
  });

  it('rejects an installed release whose reviewed files were modified', async () => {
    const zipBuffer = await createZip(manifest, validSource);
    const installed = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer,
    });
    const entryPath = path.join(installed.releaseDir, 'dist', 'index.js');
    fs.chmodSync(entryPath, 0o644);
    fs.writeFileSync(entryPath, `${validSource}\nexports.tampered = true;`);

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer,
      }),
    ).rejects.toThrow('Service release checksum does not match the installed version');
  });

  it('re-hashes the installed entry without executing it before candidate start', async () => {
    const installed = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer: await createZip(manifest, validSource),
    });
    const version = {
      packagePath: installed.releaseDir,
      entryFile: installed.entryFile,
      scanResult: installed.scanResult,
    } as unknown as AppPackageVersionEntity;

    await expect(service.verifyInstalledEntry(version)).resolves.toBeUndefined();

    const entryPath = path.join(installed.releaseDir, 'dist', 'index.js');
    fs.chmodSync(entryPath, 0o644);
    fs.writeFileSync(entryPath, `${validSource}\nexports.tampered = true;`);
    await expect(service.verifyInstalledEntry(version)).rejects.toThrow(
      'Installed service entry checksum does not match reviewed content',
    );
  });

  it('rejects installed entry paths outside the runtime root or with missing files', async () => {
    await expect(
      service.verifyInstalledEntry({
        packagePath: path.join(tempRoot, '..', 'outside-release'),
        entryFile: 'dist/index.js',
        scanResult: { entrySha256: 'a'.repeat(64) },
      } as unknown as AppPackageVersionEntity),
    ).rejects.toThrow('Invalid installed service entry');

    const installed = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer: await createZip(manifest, validSource),
    });
    const entryPath = path.join(installed.releaseDir, 'dist', 'index.js');
    fs.chmodSync(entryPath, 0o644);
    fs.rmSync(entryPath);
    await expect(
      service.verifyInstalledEntry({
        packagePath: installed.releaseDir,
        entryFile: installed.entryFile,
        scanResult: installed.scanResult,
      } as unknown as AppPackageVersionEntity),
    ).rejects.toThrow('Invalid installed service entry');
  });

  it('rejects installed release markers that were replaced by symbolic links', async () => {
    const zipBuffer = await createZip(manifest, validSource);
    const installed = await service.scanAndInstall({
      appCode: 'admin_echo_service',
      zipBuffer,
    });
    const markerPath = path.join(installed.releaseDir, '.agentstudio-release.json');
    const outsideMarker = path.join(tempRoot, 'outside-release-marker.json');
    fs.writeFileSync(
      outsideMarker,
      JSON.stringify({ package_sha256: installed.packageSha256 }),
    );
    fs.chmodSync(installed.releaseDir, 0o755);
    fs.chmodSync(markerPath, 0o644);
    fs.rmSync(markerPath);
    fs.symlinkSync(outsideMarker, markerPath, 'file');

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer,
      }),
    ).rejects.toThrow('Service release checksum does not match the installed version');
  });

  it('rejects archive entries outside the exact P10 allowlist', async () => {
    const zip = new JSZip();
    zip.file('app.manifest.json', JSON.stringify(manifest));
    zip.file('dist/index.js', validSource);
    zip.file('package.json', '{"scripts":{"postinstall":"node bad.js"}}');

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await zip.generateAsync({ type: 'nodebuffer' }),
      }),
    ).rejects.toThrow('Service package contains unsupported files');
  });

  it('rejects symbolic-link entries even when the path is allowlisted', async () => {
    const zip = new JSZip();
    zip.file('app.manifest.json', JSON.stringify(manifest));
    zip.file('dist/index.js', validSource, { unixPermissions: 0o120777 });

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await zip.generateAsync({ type: 'nodebuffer', platform: 'UNIX' }),
      }),
    ).rejects.toThrow('Service package symbolic links are not allowed');
  });

  it('applies shared compression limits before scanning a service package', async () => {
    const storage = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.serviceRuntime.rootDir') return tempRoot;
        if (key === 'appMarketplace.maxPackageSizeMb') return 10;
        if (key === 'appMarketplace.maxPackageFileMb') return 2;
        if (key === 'appMarketplace.maxPackageUncompressedMb') return 4;
        if (key === 'appMarketplace.maxPackageCompressionRatio') return 2;
        return fallback;
      }),
    } as any);
    service = new AppServicePackageService(new AppManifestService(), storage);

    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await createZip(manifest, `${validSource}\n/*${'A'.repeat(256 * 1024)}*/`),
      }),
    ).rejects.toThrow('Service package compression ratio exceeds the limit');
  });

  it.each([
    ["const cp = require('node:child_process'); exports.health=async()=>({}); exports.invoke=async()=>({});", 'forbidden_module'],
    ["exports.health=async()=>({}); exports.invoke=async()=>fetch('https://example.com');", 'forbidden_global'],
    ["exports.health=async()=>({}); exports.invoke=async()=>process.env.SECRET;", 'forbidden_global'],
    ["exports.health=async()=>({}); exports.invoke=async()=>eval('1');", 'forbidden_call'],
    ["exports.health=async()=>({}); exports.invoke=async()=>Function('return 1')();", 'forbidden_call'],
    [
      "exports.health=async()=>({}); exports.invoke=async()=>({}).constructor.constructor('return process')();",
      'forbidden_constructor_escape',
    ],
    [
      "exports.health=async()=>({}); exports.invoke=async()=>({})['constructor']['constructor']('return process')();",
      'forbidden_constructor_escape',
    ],
    [
      "exports.health=async()=>({}); exports.invoke=async()=>({})['__proto__'];",
      'forbidden_constructor_escape',
    ],
    ["exports.health=async()=>({}); exports.invoke=async()=>import('./other.js');", 'dynamic_import'],
    ["const load = require; exports.health=async()=>({}); exports.invoke=async()=>load('fs');", 'forbidden_module'],
    ["exports.health=async()=>({}); exports.invoke=async()=>module.require('fs');", 'forbidden_module'],
    ["exports.health=async()=>({}); exports.invoke=async()=>globalThis['fetch']('https://example.com');", 'forbidden_global'],
    ["const run = eval; exports.health=async()=>({}); exports.invoke=async()=>run('1');", 'forbidden_call'],
  ])('rejects dangerous JavaScript with bounded finding codes', async (source, code) => {
    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await createZip(manifest, source),
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        scan_result: expect.objectContaining({
          passed: false,
          findings: expect.arrayContaining([expect.objectContaining({ code })]),
        }),
      }),
    });
  });

  it.each([
    ['exports.health = async () => ({ status: "ok" });', 'Service entry must export health and invoke'],
    ['exports.health = ;', 'Service entry is not valid JavaScript'],
  ])('rejects malformed service entry contracts', async (source, message) => {
    await expect(
      service.scanAndInstall({
        appCode: 'admin_echo_service',
        zipBuffer: await createZip(manifest, source),
      }),
    ).rejects.toThrow(message);
  });

  async function createZip(manifestValue: object, source: string) {
    const zip = new JSZip();
    zip.file('app.manifest.json', JSON.stringify(manifestValue));
    zip.file('dist/index.js', source);
    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
      platform: 'UNIX',
    });
  }
});
