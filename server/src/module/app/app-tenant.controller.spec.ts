import { IS_PUBLIC_KEY } from '../../common/constant';
import { getTenantId } from '../../common/utils/tenant.util';
import { AppTenantController } from './app-tenant.controller';

jest.mock('../../common/utils/tenant.util', () => ({
  getTenantId: jest.fn(),
}));

describe('AppTenantController iframe exchange', () => {
  const service = { exchangeIframeLaunch: jest.fn() };
  const mockedGetTenantId = getTenantId as jest.MockedFunction<typeof getTenantId>;
  let controller: AppTenantController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppTenantController(service as any);
    mockedGetTenantId.mockReturnValue(23);
    service.exchangeIframeLaunch.mockResolvedValue({
      token: 'host-only-runtime-token',
      expires_at: '2026-07-12T08:00:00.000Z',
      capabilities: ['context.read'],
    });
  });

  it('uses JWT tenant and user identity and remains protected by the platform guard', async () => {
    await expect(
      controller.exchangeIframeLaunch({ launch_token: 'signed-launch-token' }, {
        userId: 91,
      } as any),
    ).resolves.toMatchObject({ data: { token: 'host-only-runtime-token' } });
    expect(service.exchangeIframeLaunch).toHaveBeenCalledWith(23, 91, 'signed-launch-token');
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, AppTenantController.prototype.exchangeIframeLaunch),
    ).not.toBe(true);
  });

  it('fails before exchange when tenant or user identity is absent', async () => {
    mockedGetTenantId.mockReturnValue(null);
    await expect(
      controller.exchangeIframeLaunch({ launch_token: 'signed-launch-token' }, {
        userId: 91,
      } as any),
    ).resolves.toMatchObject({ code: 401 });

    mockedGetTenantId.mockReturnValue(23);
    await expect(
      controller.exchangeIframeLaunch({ launch_token: 'signed-launch-token' }, {} as any),
    ).resolves.toMatchObject({ code: 401 });
    expect(service.exchangeIframeLaunch).not.toHaveBeenCalled();
  });
});
