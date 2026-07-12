import { TenantContext } from '../../common/tenant/tenant.context';
import { AppDeveloperProfileController } from './app-developer-profile.controller';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';

describe('AppDeveloperProfileController', () => {
  const service = {
    getOwnProfile: jest.fn(),
    apply: jest.fn(),
  };
  let controller: AppDeveloperProfileController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    controller = new AppDeveloperProfileController(
      service as unknown as AppDeveloperCertificationService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads only the authenticated user certification profile', async () => {
    service.getOwnProfile.mockResolvedValue({ id: '9', user_id: '17' });

    await expect(controller.getOwnProfile({ userId: 17 })).resolves.toMatchObject({
      code: 200,
      data: { id: '9', user_id: '17' },
    });
    expect(service.getOwnProfile).toHaveBeenCalledWith(17);
    expect(TenantContext.run).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 17, ignoreTenant: true }),
      expect.any(Function),
    );
  });

  it('submits certification for the authenticated user identity', async () => {
    const body = {
      display_name: 'Alice Studio',
      statement: 'We build reviewed tenant workflow services.',
      requested_runtime_types: ['service'] as const,
    };
    service.apply.mockResolvedValue({ id: '9', user_id: '17', certification_status: 'pending' });

    await expect(controller.apply(body as any, { userId: 17 })).resolves.toMatchObject({
      code: 200,
      data: { id: '9', user_id: '17', certification_status: 'pending' },
    });
    expect(service.apply).toHaveBeenCalledWith(17, body);
  });
});
