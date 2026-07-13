import { TenantContext } from '../../common/tenant/tenant.context';
import { AppDeveloperController } from './app-developer.controller';
import { AppDeveloperService } from './services/app-developer.service';

describe('AppDeveloperController', () => {
  const service = {
    listApps: jest.fn(),
    getApp: jest.fn(),
    createApp: jest.fn(),
    updateApp: jest.fn(),
    uploadVersion: jest.fn(),
    submitVersion: jest.fn(),
    getServiceOverview: jest.fn(),
    getServiceLogs: jest.fn(),
  };
  let controller: AppDeveloperController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    controller = new AppDeveloperController(service as unknown as AppDeveloperService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates an app for the authenticated developer identity', async () => {
    service.createApp.mockResolvedValue({ code: 'creator_portal', developer_id: 17 });

    await expect(
      controller.createApp(
        { code: 'creator_portal', name: 'Creator Portal' },
        { userId: 17, user: { nickname: 'Alice' } },
      ),
    ).resolves.toMatchObject({ code: 200, data: { code: 'creator_portal', developer_id: 17 } });

    expect(service.createApp).toHaveBeenCalledWith(
      { code: 'creator_portal', name: 'Creator Portal' },
      17,
      'Alice',
    );
  });

  it('uses the authenticated user id for version uploads', async () => {
    const file = { buffer: Buffer.from('zip') } as Express.Multer.File;
    service.uploadVersion.mockResolvedValue({ version: '1.0.0', review_status: 'pending' });

    await controller.uploadVersion('creator_portal', file, { userId: 17 });

    expect(service.uploadVersion).toHaveBeenCalledWith('creator_portal', file, 17);
  });

  it('uses the authenticated developer identity for service observability', async () => {
    service.getServiceOverview.mockResolvedValue({ days: 7, services: [] });
    service.getServiceLogs.mockResolvedValue({ app_code: 'workflow_service', stdout: '', stderr: '' });

    await controller.getServiceOverview('7', { userId: 17 });
    await controller.getServiceLogs('workflow_service', '250', { userId: 17 });

    expect(service.getServiceOverview).toHaveBeenCalledWith(17, 7);
    expect(service.getServiceLogs).toHaveBeenCalledWith('workflow_service', 17, 250);
  });
});
