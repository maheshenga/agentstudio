import { AppFactoryController } from './app-factory.controller';

describe('AppFactoryController', () => {
  const factoryService = {
    previewManifest: jest.fn(),
  };
  const templateService = {
    getTemplate: jest.fn(),
  };
  let controller: AppFactoryController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppFactoryController(factoryService as any, templateService as any);
  });

  it('loads an exact immutable template version', async () => {
    templateService.getTemplate.mockResolvedValue({
      code: 'job_board',
      template_version: '2.0.0',
    });

    await expect(
      controller.getTemplate('job_board', { template_version: '2.0.0' }),
    ).resolves.toMatchObject({
      code: 200,
      data: { code: 'job_board', template_version: '2.0.0' },
    });
    expect(templateService.getTemplate).toHaveBeenCalledWith('job_board', '2.0.0');
  });

  it('previews a generated manifest without publishing it', async () => {
    factoryService.previewManifest.mockResolvedValue({
      manifestVersion: 2,
      runtime: 'service',
    });

    await expect(
      controller.previewManifest('classifieds', { version: '1.0.0' }),
    ).resolves.toMatchObject({
      code: 200,
      data: { manifestVersion: 2, runtime: 'service' },
    });
    expect(factoryService.previewManifest).toHaveBeenCalledWith('classifieds', '1.0.0');
  });
});
