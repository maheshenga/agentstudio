import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { AppFactoryModuleEntity } from '../entities/app-factory-module.entity';
import { AppFactoryPublishLogEntity } from '../entities/app-factory-publish-log.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppReviewLogEntity } from '../entities/app-review-log.entity';
import { AppPackageStorageService } from './app-package-storage.service';
import { AppFactoryTemplateService } from './app-factory-template.service';
import { AppFactoryService } from './app-factory.service';

describe('AppFactoryService', () => {
  let service: AppFactoryService;
  let packagePath: string;
  let publishPath: string;

  const factoryRepo = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const publishLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const appRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const versionRepo = {
    create: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };
  const appReviewLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const storage = {
    resolvePackagePath: jest.fn(),
    hashDirectory: jest.fn(),
    publishVersion: jest.fn(),
  };
  const templateService = {
    getTemplate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    packagePath = fs.mkdtempSync(path.join(os.tmpdir(), 'app-factory-package-'));
    publishPath = fs.mkdtempSync(path.join(os.tmpdir(), 'app-factory-public-'));

    factoryRepo.create.mockImplementation((value) => ({ ...value }));
    factoryRepo.find.mockResolvedValue([]);
    factoryRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    publishLogRepo.create.mockImplementation((value) => ({ ...value }));
    publishLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 1, ...value }));
    appRepo.create.mockImplementation((value) => ({ ...value }));
    appRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 10, ...value }));
    versionRepo.create.mockImplementation((value) => ({ ...value }));
    versionRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 20, ...value }));
    appReviewLogRepo.create.mockImplementation((value) => ({ ...value }));
    appReviewLogRepo.save.mockImplementation(async (value) => ({ id: value.id ?? 30, ...value }));
    storage.resolvePackagePath.mockReturnValue(packagePath);
    storage.hashDirectory.mockResolvedValue('a'.repeat(64));
    storage.publishVersion.mockResolvedValue({
      publishPath,
      entryUrl: '/apps-static/factory_landing_page/1.0.0/dist/index.html',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppFactoryService,
        { provide: getRepositoryToken(AppFactoryModuleEntity), useValue: factoryRepo },
        { provide: getRepositoryToken(AppFactoryPublishLogEntity), useValue: publishLogRepo },
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(AppReviewLogEntity), useValue: appReviewLogRepo },
        { provide: AppPackageStorageService, useValue: storage },
        { provide: AppFactoryTemplateService, useValue: templateService },
      ],
    }).compile();

    service = module.get(AppFactoryService);
  });

  afterEach(() => {
    fs.rmSync(packagePath, { recursive: true, force: true });
    fs.rmSync(publishPath, { recursive: true, force: true });
  });

  it('creates a static page factory module in draft state', async () => {
    factoryRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createModule(
        {
          code: 'landing_page',
          name: 'Landing Page',
          html_content: '<h1>Hello</h1>',
        },
        7,
      ),
    ).resolves.toMatchObject({
      code: 'landing_page',
      status: 'draft',
      app_code: 'factory_landing_page',
    });

    expect(factoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'landing_page',
        name: 'Landing Page',
        kind: 'static_page',
        status: 'draft',
        appCode: 'factory_landing_page',
        createdBy: 7,
      }),
    );
  });

  it('keeps immutable template provenance when creating a module', async () => {
    factoryRepo.findOne.mockResolvedValue(null);
    templateService.getTemplate.mockResolvedValue({
      code: 'job_board',
      template_version: '2.0.0',
      schema_version: 2,
      runtime_target: 'static',
      manifest_defaults: { tenant_scoped: true, permissions: ['context.read'] },
    });

    await service.createModule({
      code: 'job_board_v2',
      name: 'Job Board',
      template_code: 'job_board',
      template_version: '2.0.0',
      template_schema_version: 99,
      runtime_target: 'service',
      manifest_defaults: { capabilities: ['context.read'] },
    });

    expect(factoryRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        templateCode: 'job_board',
        templateVersion: '2.0.0',
        templateSchemaVersion: 2,
        runtimeTarget: 'static',
        manifestDefaults: { tenant_scoped: true, permissions: ['context.read'] },
      }),
    );
    expect(templateService.getTemplate).toHaveBeenCalledWith('job_board', '2.0.0');
  });

  it('rejects unsafe static page html before publish', async () => {
    factoryRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'bad_page',
      name: 'Bad',
      htmlContent: '<script>alert(1)</script>',
      appCode: 'factory_bad_page',
      status: 'draft',
      visibility: 'marketplace',
    });

    await expect(service.publishModule('bad_page', { version: '1.0.0' }, 7)).rejects.toThrow(
      'Factory page HTML contains unsafe script',
    );
    expect(appRepo.save).not.toHaveBeenCalled();
  });

  it('publishes a safe static page as a marketplace app version', async () => {
    factoryRepo.findOne.mockResolvedValueOnce({
      id: 1,
      code: 'landing_page',
      name: 'Landing Page',
      htmlContent: '<h1>Hello</h1>',
      cssContent: 'body{color:#111}',
      visibility: 'marketplace',
      status: 'draft',
      appCode: 'factory_landing_page',
      category: 'Marketing',
      summary: 'Simple page',
      description: 'Generated page',
    });
    appRepo.findOne.mockResolvedValue(null);
    versionRepo.findOne.mockResolvedValue(null);

    await expect(service.publishModule('landing_page', { version: '1.0.0' }, 7)).resolves.toMatchObject({
      status: 'published',
      latest_version: '1.0.0',
      app_code: 'factory_landing_page',
      entry_url: '/apps-static/factory_landing_page/1.0.0/dist/index.html',
    });

    expect(storage.resolvePackagePath).toHaveBeenCalledWith('factory_landing_page', '1.0.0');
    expect(storage.publishVersion).toHaveBeenCalledWith({
      appCode: 'factory_landing_page',
      version: '1.0.0',
      sourceDir: packagePath,
      entryFile: 'dist/index.html',
      expectedContentHash: 'a'.repeat(64),
    });
    expect(fs.existsSync(path.join(packagePath, 'dist', 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(packagePath, 'manifest.json'))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(packagePath, 'manifest.json'), 'utf8'))).toMatchObject({
      code: 'factory_landing_page',
      version: '1.0.0',
      type: 'static',
      entry: 'dist/index.html',
    });
    expect(appRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'factory_landing_page',
        type: 'static',
        status: 'published',
        entryMode: 'static',
      }),
    );
    expect(versionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0.0',
        reviewStatus: 'approved',
        publishStatus: 'published',
        contentHash: 'a'.repeat(64),
      }),
    );
    expect(appReviewLogRepo.save).toHaveBeenCalled();
    expect(publishLogRepo.save).toHaveBeenCalled();
  });

  it('rejects duplicate versions before mutating an existing app or package files', async () => {
    factoryRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'landing_page',
      name: 'Landing Page',
      htmlContent: '<h1>Hello</h1>',
      appCode: 'factory_landing_page',
      visibility: 'marketplace',
      status: 'published',
    });
    appRepo.findOne.mockResolvedValue({ id: 10, code: 'factory_landing_page', status: 'published' });
    versionRepo.findOne.mockResolvedValue({ id: 20, appId: 10, version: '1.0.0' });

    await expect(service.publishModule('landing_page', { version: '1.0.0' }, 7)).rejects.toThrow(
      'App version 1.0.0 already exists',
    );

    expect(appRepo.save).not.toHaveBeenCalled();
    expect(storage.resolvePackagePath).not.toHaveBeenCalled();
    expect(storage.publishVersion).not.toHaveBeenCalled();
    expect(fs.readdirSync(packagePath)).toHaveLength(0);
  });

  it('does not persist publish state and cleans staged package files when public publish fails', async () => {
    factoryRepo.findOne.mockResolvedValue({
      id: 1,
      code: 'landing_page',
      name: 'Landing Page',
      htmlContent: '<h1>Hello</h1>',
      appCode: 'factory_landing_page',
      visibility: 'marketplace',
      status: 'draft',
    });
    appRepo.findOne.mockResolvedValue(null);
    versionRepo.findOne.mockResolvedValue(null);
    storage.publishVersion.mockRejectedValue(new Error('copy failed'));

    await expect(service.publishModule('landing_page', { version: '1.0.0' }, 7)).rejects.toThrow('copy failed');

    expect(appRepo.save).not.toHaveBeenCalled();
    expect(versionRepo.save).not.toHaveBeenCalled();
    expect(appReviewLogRepo.save).not.toHaveBeenCalled();
    expect(factoryRepo.save).not.toHaveBeenCalled();
    expect(publishLogRepo.save).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(packagePath, 'dist', 'index.html'))).toBe(false);
    expect(fs.existsSync(path.join(packagePath, 'manifest.json'))).toBe(false);
  });

  it('generates a service manifest but refuses to publish executable output outside review', async () => {
    factoryRepo.findOne.mockResolvedValue({
      id: 2,
      code: 'classifieds',
      name: '分类信息服务',
      runtimeTarget: 'service',
      manifestDefaults: { healthPath: '/health', capabilities: ['context.read'] },
      appCode: 'factory_classifieds',
      status: 'draft',
    });

    await expect(service.previewManifest('classifieds', '1.0.0')).resolves.toMatchObject({
      manifestVersion: 2,
      runtime: 'service',
      entry: 'dist/index.js',
    });
    await expect(service.publishModule('classifieds', { version: '1.0.0' }, 7)).rejects.toThrow(
      'Service factory output must be submitted through App Platform review',
    );
    expect(appRepo.save).not.toHaveBeenCalled();
    expect(storage.publishVersion).not.toHaveBeenCalled();
  });
});
