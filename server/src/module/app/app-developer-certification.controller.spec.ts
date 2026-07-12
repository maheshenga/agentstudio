import { TenantContext } from '../../common/tenant/tenant.context';
import { AppDeveloperCertificationController } from './app-developer-certification.controller';
import { AppDeveloperCertificationService } from './services/app-developer-certification.service';

describe('AppDeveloperCertificationController', () => {
  const service = {
    list: jest.fn(),
    getProfile: jest.fn(),
    decide: jest.fn(),
    setDisabled: jest.fn(),
  };
  let controller: AppDeveloperCertificationController;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(TenantContext, 'run').mockImplementation((_, callback) => callback() as any);
    controller = new AppDeveloperCertificationController(
      service as unknown as AppDeveloperCertificationService,
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('lists certification profiles in platform context', async () => {
    const query = { certification_status: 'pending' as const };
    service.list.mockResolvedValue([{ id: '9', certification_status: 'pending' }]);

    await expect(controller.list(query, { userId: 2 })).resolves.toMatchObject({
      code: 200,
      data: [{ id: '9', certification_status: 'pending' }],
    });
    expect(service.list).toHaveBeenCalledWith(query);
    expect(TenantContext.run).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 2, ignoreTenant: true }),
      expect.any(Function),
    );
  });

  it('reads one certification profile by platform id', async () => {
    service.getProfile.mockResolvedValue({ id: '9', user_id: '17' });

    await expect(controller.getProfile(9, { userId: 2 })).resolves.toMatchObject({
      code: 200,
      data: { id: '9', user_id: '17' },
    });
    expect(service.getProfile).toHaveBeenCalledWith(9);
  });

  it('uses the authenticated platform operator for certification decisions', async () => {
    const body = {
      decision: 'certified' as const,
      approved_runtime_types: ['service'] as const,
      risk_level: 'low' as const,
      certification_expiry: '2099-12-31T00:00:00.000Z',
      message: 'Approved',
    };
    service.decide.mockResolvedValue({ id: '9', certification_status: 'certified' });

    await expect(controller.decide(9, body as any, { userId: 2 })).resolves.toMatchObject({
      code: 200,
      data: { id: '9', certification_status: 'certified' },
    });
    expect(service.decide).toHaveBeenCalledWith(9, 2, body);
  });

  it('uses the authenticated platform operator for disabled-state changes', async () => {
    const body = { disabled: true, message: 'Security review required' };
    service.setDisabled.mockResolvedValue({ id: '9', disabled: true });

    await expect(controller.setDisabled(9, body, { userId: 3 })).resolves.toMatchObject({
      code: 200,
      data: { id: '9', disabled: true },
    });
    expect(service.setDisabled).toHaveBeenCalledWith(9, 3, body);
  });
});
