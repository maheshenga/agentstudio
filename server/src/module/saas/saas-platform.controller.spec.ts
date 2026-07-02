import { Test, TestingModule } from '@nestjs/testing';

import { SaasPlatformController } from './saas-platform.controller';
import { SaasPlatformService } from './services/saas-platform.service';
import { SaasProvisioningService } from './services/saas-provisioning.service';

describe('SaasPlatformController', () => {
  let controller: SaasPlatformController;

  const provisioning = {
    createTenantFromPlatform: jest.fn(),
  };
  const platformService = {
    listOrders: jest.fn(),
    listSubscriptions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaasPlatformController],
      providers: [
        {
          provide: SaasProvisioningService,
          useValue: provisioning,
        },
        {
          provide: SaasPlatformService,
          useValue: platformService,
        },
      ],
    }).compile();

    controller = module.get(SaasPlatformController);
  });

  it('lists platform SaaS orders outside tenant scope', async () => {
    platformService.listOrders.mockResolvedValue({
      list: [{ order_no: 'SO20260702000000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listOrders({ page: '1' }, { userId: 1 } as any);

    expect(platformService.listOrders).toHaveBeenCalledWith({ page: '1' });
    expect(result.data).toEqual({
      list: [{ order_no: 'SO20260702000000001000001' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('lists platform SaaS subscriptions outside tenant scope', async () => {
    platformService.listSubscriptions.mockResolvedValue({
      list: [{ tenant_id: 12, status: 'active' }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listSubscriptions({ status: 'active' }, { userId: 1 } as any);

    expect(platformService.listSubscriptions).toHaveBeenCalledWith({ status: 'active' });
    expect(result.data).toEqual({
      list: [{ tenant_id: 12, status: 'active' }],
      total: 1,
      page: 1,
      limit: 20,
    });
  });
});
