import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes } from 'crypto';

import JSZip from 'jszip';

import { AppPackageStorageService } from './app-package-storage.service';

describe('AppPackageStorageService', () => {
  let tempRoot: string;
  let packageRoot: string;
  let publicRoot: string;
  let serviceRuntimeRoot: string;
  let service: AppPackageStorageService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-package-storage-'));
    packageRoot = path.join(tempRoot, 'packages');
    publicRoot = path.join(tempRoot, 'public');
    serviceRuntimeRoot = path.join(tempRoot, 'service-runtime');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(publicRoot, { recursive: true });

    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.publicPrefix') return '/apps-static/';
        if (key === 'appMarketplace.serviceRuntime.rootDir') return serviceRuntimeRoot;
        if (key === 'appMarketplace.maxPackageFiles') return 500;
        if (key === 'appMarketplace.maxPackageSizeMb') return 50;
        return fallback;
      }),
    } as any);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('resolves package and public roots from config', () => {
    expect(service.getPackageRoot()).toBe(path.resolve(packageRoot));
    expect(service.getPublicRoot()).toBe(path.resolve(publicRoot));
    expect(service.getPublicPrefix()).toBe('/apps-static/');
    expect(service.getServiceRuntimeRoot()).toBe(path.resolve(serviceRuntimeRoot));
    expect(service.resolveServiceReleasePath('admin_echo_service', '1.0.0')).toBe(
      path.join(serviceRuntimeRoot, 'admin_echo_service', '1.0.0'),
    );
  });

  it('rejects package paths that escape the package root', () => {
    expect(() => service.resolvePackagePath('..', 'escape')).toThrow('Invalid app package path');
  });

  it('rejects public paths that escape the public root', () => {
    expect(() => service.resolvePublicPath('..', 'escape')).toThrow('Invalid app public path');
  });

  it('rejects service release paths that escape the runtime root', () => {
    expect(() => service.resolveServiceReleasePath('..', '1.0.0')).toThrow(
      'Invalid service release path',
    );
  });

  it('publishes a version under the public root and returns the static entry url', async () => {
    const sourceDir = path.join(packageRoot, 'job_board', '1.0.0');
    fs.mkdirSync(path.join(sourceDir, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), '<html>ok</html>');
    fs.writeFileSync(path.join(sourceDir, 'dist', 'assets', 'app.js'), 'console.log("ok")');
    const expectedContentHash = await service.hashDirectory(sourceDir);

    const result = await service.publishVersion({
      appCode: 'job_board',
      version: '1.0.0',
      sourceDir,
      entryFile: 'dist/index.html',
      expectedContentHash,
    });

    expect(result).toEqual({
      publishPath: path.join(publicRoot, 'job_board', '1.0.0'),
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    expect(fs.readFileSync(path.join(publicRoot, 'job_board', '1.0.0', 'dist', 'index.html'), 'utf8')).toBe(
      '<html>ok</html>',
    );
  });

  it('preserves the previous public version when copying the replacement fails', async () => {
    const sourceDir = path.join(packageRoot, 'job_board', '1.0.0');
    const publishDir = path.join(publicRoot, 'job_board', '1.0.0');
    fs.mkdirSync(path.join(sourceDir, 'dist'), { recursive: true });
    fs.mkdirSync(path.join(publishDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), '<html>new</html>');
    fs.writeFileSync(path.join(publishDir, 'dist', 'index.html'), '<html>old</html>');
    const expectedContentHash = await service.hashDirectory(sourceDir);
    const failingService = new (class extends AppPackageStorageService {
      copyDirectorySync() {
        throw new Error('copy failed');
      }
    })((service as any).config);

    await expect(
      failingService.publishVersion({
        appCode: 'job_board',
        version: '1.0.0',
        sourceDir,
        entryFile: 'dist/index.html',
        expectedContentHash,
      }),
    ).rejects.toThrow('copy failed');

    expect(fs.readFileSync(path.join(publishDir, 'dist', 'index.html'), 'utf8')).toBe(
      '<html>old</html>',
    );
    expect(fs.readdirSync(path.dirname(publishDir)).filter((name) => name.includes('.staging-'))).toEqual([]);
  });

  it('extracts an uploaded static app package under the package root', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', '{"code":"job_board","version":"1.0.0"}');
    zip.file('dist/index.html', '<html>job board</html>');
    zip.file('dist/assets/app.js', 'console.log("ok")');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await service.extractStaticPackage({
      appCode: 'job_board',
      version: '1.0.0',
      zipBuffer: buffer,
    });

    expect(result).toEqual({
      packagePath: path.join(packageRoot, 'job_board', '1.0.0'),
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(fs.readFileSync(path.join(packageRoot, 'job_board', '1.0.0', 'dist', 'index.html'), 'utf8')).toBe(
      '<html>job board</html>',
    );
  });

  it('rejects static app packages with too many files', async () => {
    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.publicPrefix') return '/apps-static/';
        if (key === 'appMarketplace.maxPackageFiles') return 2;
        if (key === 'appMarketplace.maxPackageSizeMb') return 50;
        return fallback;
      }),
    } as any);
    const zip = new JSZip();
    zip.file('manifest.json', '{}');
    zip.file('dist/index.html', '<html>ok</html>');
    zip.file('dist/assets/app.js', 'console.log("ok")');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    await expect(
      service.extractStaticPackage({
        appCode: 'job_board',
        version: '1.0.0',
        zipBuffer: buffer,
      }),
    ).rejects.toThrow('App package contains too many files');
  });

  it('rejects publication when extracted reviewed content has changed', async () => {
    const sourceDir = path.join(packageRoot, 'job_board', '1.0.0');
    fs.mkdirSync(path.join(sourceDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), '<html>reviewed</html>');
    const expectedContentHash = await service.hashDirectory(sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), '<html>tampered</html>');

    await expect(
      service.publishVersion({
        appCode: 'job_board',
        version: '1.0.0',
        sourceDir,
        entryFile: 'dist/index.html',
        expectedContentHash,
      }),
    ).rejects.toThrow('App package content integrity check failed');
    expect(fs.existsSync(path.join(publicRoot, 'job_board', '1.0.0'))).toBe(false);
  });

  it('rejects static packages whose total uncompressed size exceeds the limit', async () => {
    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.maxPackageSizeMb') return 50;
        if (key === 'appMarketplace.maxPackageFileMb') return 1;
        if (key === 'appMarketplace.maxPackageUncompressedMb') return 1;
        if (key === 'appMarketplace.maxPackageCompressionRatio') return 100;
        return fallback;
      }),
    } as any);
    const zip = new JSZip();
    zip.file('dist/a.bin', randomBytes(700 * 1024));
    zip.file('dist/b.bin', randomBytes(700 * 1024));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(
      service.extractStaticPackage({ appCode: 'job_board', version: '1.0.0', zipBuffer: buffer }),
    ).rejects.toThrow('App package uncompressed size exceeds the limit');
  });

  it('rejects static packages containing a file larger than the per-file limit', async () => {
    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.maxPackageSizeMb') return 50;
        if (key === 'appMarketplace.maxPackageFileMb') return 1;
        if (key === 'appMarketplace.maxPackageUncompressedMb') return 4;
        if (key === 'appMarketplace.maxPackageCompressionRatio') return 100;
        return fallback;
      }),
    } as any);
    const zip = new JSZip();
    zip.file('dist/large.bin', randomBytes(2 * 1024 * 1024));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(
      service.extractStaticPackage({ appCode: 'job_board', version: '1.0.0', zipBuffer: buffer }),
    ).rejects.toThrow('App package file exceeds the limit');
  });

  it('rejects static packages with an excessive compression ratio', async () => {
    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.maxPackageSizeMb') return 50;
        if (key === 'appMarketplace.maxPackageFileMb') return 1;
        if (key === 'appMarketplace.maxPackageUncompressedMb') return 2;
        if (key === 'appMarketplace.maxPackageCompressionRatio') return 2;
        return fallback;
      }),
    } as any);
    const zip = new JSZip();
    zip.file('dist/repeated.txt', 'A'.repeat(256 * 1024));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    await expect(
      service.extractStaticPackage({ appCode: 'job_board', version: '1.0.0', zipBuffer: buffer }),
    ).rejects.toThrow('App package compression ratio exceeds the limit');
  });

  it('rejects publishing from outside the package root', async () => {
    const outsideDir = path.join(tempRoot, 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });

    await expect(
      service.publishVersion({
        appCode: 'job_board',
        version: '1.0.0',
        sourceDir: outsideDir,
        entryFile: 'dist/index.html',
        expectedContentHash: 'a'.repeat(64),
      }),
    ).rejects.toThrow('Invalid app package path');
  });
});
