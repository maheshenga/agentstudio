import { TenantContext } from '../../common/tenant/tenant.context';
import { AppAnalyticsController } from './app-analytics.controller';

describe('AppAnalyticsController', () => {
  const analyticsService = {
    getPlatformOverview: jest.fn(),
    getPlatformAppDetail: jest.fn(),
    getTenantOverview: jest.fn(),
  };
  let controller: AppAnalyticsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AppAnalyticsController(analyticsService as any);
  });

  it('runs platform analytics outside tenant filtering', async () => {
    analyticsService.getPlatformOverview.mockResolvedValue({ summary: {} });
    const run = jest.spyOn(TenantContext, 'run');

    const result = await controller.platformOverview({ days: 7 }, { userId: 9 } as any);

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: undefined, userId: 9, ignoreTenant: true }),
      expect.any(Function),
    );
    expect(analyticsService.getPlatformOverview).toHaveBeenCalledWith(7);
    expect(result).toEqual(expect.objectContaining({ code: 200 }));
  });

  it('derives tenant analytics scope only from tenant context', async () => {
    analyticsService.getTenantOverview.mockResolvedValue({ summary: {} });

    const result = await TenantContext.run({ tenantId: 23, userId: 7 }, () =>
      controller.tenantOverview({ days: 30 }),
    );

    expect(analyticsService.getTenantOverview).toHaveBeenCalledWith(23, 30);
    expect(result).toEqual(expect.objectContaining({ code: 200 }));
  });

  it('rejects tenant analytics when tenant context is absent', async () => {
    const result = await controller.tenantOverview({ days: 30 });

    expect(analyticsService.getTenantOverview).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ code: 401 }));
  });
});
