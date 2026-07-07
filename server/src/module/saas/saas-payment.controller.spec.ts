import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as tenantUtils from '../../common/utils/tenant.util';
import { SaasPaymentController } from './saas-payment.controller';
import { SaasOrderService } from './services/saas-order.service';
import { SaasPaymentService } from './services/saas-payment.service';
import { SaasResourcePackOrderService } from './services/saas-resource-pack-order.service';

describe('SaasPaymentController', () => {
  let controller: SaasPaymentController;

  const saasOrderService = {
    confirmDevPayment: jest.fn(),
    confirmAlipayPayment: jest.fn(),
    findPlatformOrder: jest.fn(),
  };
  const saasPaymentService = {
    createAlipayPayment: jest.fn(),
    verifyAlipayNotify: jest.fn(),
    verifyAlipayPaidNotify: jest.fn(),
    getAlipayConfigStatus: jest.fn(),
  };
  const resourcePackOrderService = {
    confirmDevPayment: jest.fn(),
    confirmAlipayPayment: jest.fn(),
    findPlatformOrder: jest.fn(),
    toResponse: jest.fn((order) => ({
      order_no: order.orderNo,
      resource_pack_code: order.resourcePackCode,
      status: order.status,
    })),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'app.env') return 'development';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      if (key === 'app.env') return 'development';
      return undefined;
    });

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
        {
          provide: SaasResourcePackOrderService,
          useValue: resourcePackOrderService,
        },
        {
          provide: ConfigService,
          useValue: configService,
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

  it('dev-confirms a resource pack order when order_type is resource_pack', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    resourcePackOrderService.confirmDevPayment.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      resourcePackCode: 'tokens_1m',
      status: 'paid',
    });

    const result = await controller.devConfirm({
      order_no: 'RPO20260703120000001000001',
      order_type: 'resource_pack',
    });

    expect(resourcePackOrderService.confirmDevPayment).toHaveBeenCalledWith(88, 'RPO20260703120000001000001');
    expect(result.data).toEqual({
      order_no: 'RPO20260703120000001000001',
      resource_pack_code: 'tokens_1m',
      status: 'paid',
    });
  });

  it('rejects development payment confirmation in production', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'app.env') return 'production';
      return undefined;
    });
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);

    await expect(
      controller.devConfirm({
        order_no: 'SO20260702000000001000001',
      }),
    ).rejects.toThrow(NotFoundException);

    expect(saasOrderService.confirmDevPayment).not.toHaveBeenCalled();
    expect(resourcePackOrderService.confirmDevPayment).not.toHaveBeenCalled();
  });

  it('confirms an order when Alipay notifies trade success', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
    });
    saasPaymentService.verifyAlipayPaidNotify.mockResolvedValue({
      valid: true,
      tradeNo: '2026070222000000000001',
    });
    saasOrderService.confirmAlipayPayment.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      status: 'paid',
      alipayTradeNo: '2026070222000000000001',
    });

    const result = await controller.alipayNotify({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
    });

    expect(result).toBe('success');
    expect(saasOrderService.findPlatformOrder).toHaveBeenCalledWith('SO20260702000000001000001');
    expect(saasPaymentService.verifyAlipayPaidNotify).toHaveBeenCalledWith({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
    }, {
      orderNo: 'SO20260702000000001000001',
      amountCents: 99000,
    });
    expect(saasOrderService.confirmAlipayPayment).toHaveBeenCalledWith(
      'SO20260702000000001000001',
      '2026070222000000000001',
    );
  });

  it('routes RPO Alipay notify orders to resource pack confirmation', async () => {
    resourcePackOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'RPO20260703120000001000001',
      amount_cents: 19900,
    });
    saasPaymentService.verifyAlipayPaidNotify.mockResolvedValue({
      valid: true,
      tradeNo: '2026070322000000000001',
    });
    resourcePackOrderService.confirmAlipayPayment.mockResolvedValue({ status: 'paid' });

    await expect(
      controller.alipayNotify({
        out_trade_no: 'RPO20260703120000001000001',
        trade_no: '2026070322000000000001',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toBe('success');

    expect(resourcePackOrderService.findPlatformOrder).toHaveBeenCalledWith('RPO20260703120000001000001');
    expect(saasPaymentService.verifyAlipayPaidNotify).toHaveBeenCalledWith(
      {
        out_trade_no: 'RPO20260703120000001000001',
        trade_no: '2026070322000000000001',
        trade_status: 'TRADE_SUCCESS',
      },
      {
        orderNo: 'RPO20260703120000001000001',
        amountCents: 19900,
      },
    );
    expect(resourcePackOrderService.confirmAlipayPayment).toHaveBeenCalledWith(
      'RPO20260703120000001000001',
      '2026070322000000000001',
    );
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
  });

  it('ignores non-success Alipay notifications without mutating orders', async () => {
    saasPaymentService.verifyAlipayNotify.mockReturnValue(true);

    const result = await controller.alipayNotify({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'WAIT_BUYER_PAY',
    });

    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(result).toBe('success');
  });

  it('rejects Alipay notifications that fail signature verification', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
    });
    saasPaymentService.verifyAlipayPaidNotify.mockResolvedValue({
      valid: false,
      reason: 'invalid_signature',
    });

    const result = await controller.alipayNotify({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
    });

    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(result).toBe('fail');
  });

  it('rejects paid Alipay notifications when local order data does not validate against the signed payload', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
    });
    saasPaymentService.verifyAlipayPaidNotify.mockResolvedValue({
      valid: false,
      reason: 'amount_mismatch',
    });

    const result = await controller.alipayNotify({
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
      total_amount: '9.90',
    });

    expect(result).toBe('fail');
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
  });

  it('returns Alipay config status in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);
    saasPaymentService.getAlipayConfigStatus.mockReturnValue({
      enabled: false,
      configured: false,
      missing_keys: ['ALIPAY_APP_ID'],
      app_id_masked: '',
      gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notify_url_configured: false,
      return_url_configured: false,
    });

    const result = await controller.getAlipayConfigStatus();

    expect(result.data).toEqual({
      enabled: false,
      configured: false,
      missing_keys: ['ALIPAY_APP_ID'],
      app_id_masked: '',
      gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notify_url_configured: false,
      return_url_configured: false,
    });
  });

  it('requires tenant billing view permission for Alipay config status', () => {
    expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.getAlipayConfigStatus)).toEqual([
      'tenant:billing:view',
    ]);
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

    expect(saasPaymentService.createAlipayPayment).toHaveBeenCalledWith(12, 'SO20260702000000001000001', 'plan');
    expect(result.data).toEqual({
      configured: false,
      provider: 'alipay',
      order_no: 'SO20260702000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing.',
    });
  });

  it('requires explicit tenant payment permissions for Alipay payment creation', () => {
    expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.createAlipayPayment)).toEqual([
      'tenant:billing:upgrade',
      'tenant:resource-pack-order:pay',
    ]);
  });
});
