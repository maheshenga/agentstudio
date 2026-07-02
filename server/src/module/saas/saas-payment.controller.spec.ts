import { Test, TestingModule } from '@nestjs/testing';

import * as tenantUtils from '../../common/utils/tenant.util';
import { SaasPaymentController } from './saas-payment.controller';
import { SaasOrderService } from './services/saas-order.service';
import { SaasPaymentService } from './services/saas-payment.service';

describe('SaasPaymentController', () => {
  let controller: SaasPaymentController;

  const saasOrderService = {
    confirmDevPayment: jest.fn(),
  };
  const saasPaymentService = {
    createAlipayPayment: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SaasPaymentController],
      providers: [
        {
          provide: SaasOrderService,
          useValue: saasOrderService,
        },
        {
          provide: SaasPaymentService,
          useValue: saasPaymentService,
        },
      ],
    }).compile();

    controller = module.get(SaasPaymentController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('confirms a development payment in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);
    saasOrderService.confirmDevPayment.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      planCode: 'pro',
      amountCents: 99000,
      status: 'paid',
      paymentMethod: 'alipay',
      alipayTradeNo: 'DEV-SO20260702000000001000001',
      paidAt: new Date('2026-07-02T00:00:00.000Z'),
    });

    const result = await controller.devConfirm({
      order_no: 'SO20260702000000001000001',
    });

    expect(saasOrderService.confirmDevPayment).toHaveBeenCalledWith(12, 'SO20260702000000001000001');
    expect(result.data).toEqual({
      order_no: 'SO20260702000000001000001',
      plan_code: 'pro',
      amount_cents: 99000,
      status: 'paid',
      payment_method: 'alipay',
      alipay_trade_no: 'DEV-SO20260702000000001000001',
      paid_at: new Date('2026-07-02T00:00:00.000Z'),
    });
  });

  it('accepts the reserved Alipay notify endpoint', async () => {
    const result = await controller.alipayNotify({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
    });

    expect(result.data).toEqual({
      received: true,
      provider: 'alipay',
    });
  });

  it('creates an Alipay payment in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);
    saasPaymentService.createAlipayPayment.mockResolvedValue({
      configured: false,
      provider: 'alipay',
      order_no: 'SO20260702000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing.',
    });

    const result = await controller.createAlipayPayment({
      order_no: 'SO20260702000000001000001',
    });

    expect(saasPaymentService.createAlipayPayment).toHaveBeenCalledWith(12, 'SO20260702000000001000001');
    expect(result.data).toEqual({
      configured: false,
      provider: 'alipay',
      order_no: 'SO20260702000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing.',
    });
  });
});
