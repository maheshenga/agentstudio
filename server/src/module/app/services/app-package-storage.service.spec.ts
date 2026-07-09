import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AppPackageStorageService } from './app-package-storage.service';

describe('AppPackageStorageService', () => {
  let tempRoot: string;
  let packageRoot: string;
  let publicRoot: string;
  let service: AppPackageStorageService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'app-package-storage-'));
    packageRoot = path.join(tempRoot, 'packages');
    publicRoot = path.join(tempRoot, 'public');
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.mkdirSync(publicRoot, { recursive: true });

    service = new AppPackageStorageService({
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'appMarketplace.packageDir') return packageRoot;
        if (key === 'appMarketplace.publicDir') return publicRoot;
        if (key === 'appMarketplace.publicPrefix') return '/apps-static/';
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
  });

  it('rejects package paths that escape the package root', () => {
    expect(() => service.resolvePackagePath('..', 'escape')).toThrow('Invalid app package path');
  });

  it('rejects public paths that escape the public root', () => {
    expect(() => service.resolvePublicPath('..', 'escape')).toThrow('Invalid app public path');
  });

  it('publishes a version under the public root and returns the static entry url', async () => {
    const sourceDir = path.join(packageRoot, 'job_board', '1.0.0');
    fs.mkdirSync(path.join(sourceDir, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'dist', 'index.html'), '<html>ok</html>');
    fs.writeFileSync(path.join(sourceDir, 'dist', 'assets', 'app.js'), 'console.log("ok")');

    const result = await service.publishVersion({
      appCode: 'job_board',
      version: '1.0.0',
      sourceDir,
      entryFile: 'dist/index.html',
    });

    expect(result).toEqual({
      publishPath: path.join(publicRoot, 'job_board', '1.0.0'),
      entryUrl: '/apps-static/job_board/1.0.0/dist/index.html',
    });
    expect(fs.readFileSync(path.join(publicRoot, 'job_board', '1.0.0', 'dist', 'index.html'), 'utf8')).toBe(
      '<html>ok</html>',
    );
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
      }),
    ).rejects.toThrow('Invalid app package path');
  });
});
