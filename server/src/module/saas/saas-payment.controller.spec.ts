import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as tenantUtils from '../../common/utils/tenant.util';
import { AppOrderService } from '../app-commerce/services/app-order.service';
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
    handleAlipayNotify: jest.fn(),
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
  const appOrderService = {
    confirmDevPayment: jest.fn(),
    toResponse: jest.fn((order) => ({
      order_no: order.orderNo,
      app_code: order.appCode,
      amount_cents: order.amountCents,
      status: order.status,
    })),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'app.env') return 'development';
      return undefined;
    }),
  };
  const billingUser = { userId: 7, permissions: ['tenant:billing:upgrade'] };
  const resourcePackUser = { userId: 8, permissions: ['tenant:resource-pack-order:pay'] };
  const appPurchaseUser = { userId: 9, permissions: ['app:tenant:purchase'] };

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
          provide: AppOrderService,
          useValue: appOrderService,
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

    const result = await (controller.devConfirm as any)(
      { order_no: 'SO20260702000000001000001' },
      billingUser,
    );

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

    const result = await (controller.devConfirm as any)(
      {
        order_no: 'RPO20260703120000001000001',
        order_type: 'resource_pack',
      },
      resourcePackUser,
    );

    expect(resourcePackOrderService.confirmDevPayment).toHaveBeenCalledWith(88, 'RPO20260703120000001000001');
    expect(result.data).toEqual({
      order_no: 'RPO20260703120000001000001',
      resource_pack_code: 'tokens_1m',
      status: 'paid',
    });
  });

  it('confirms an app payment through the development endpoint outside production', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(88);
    appOrderService.confirmDevPayment.mockResolvedValue({
      orderNo: 'AO20260713000000001000001',
      appCode: 'workflow',
      amountCents: 9900,
      status: 'paid',
    });

    const result = await (controller.devConfirm as any)(
      {
        order_no: 'AO20260713000000001000001',
        order_type: 'app',
      },
      appPurchaseUser,
    );

    expect(appOrderService.confirmDevPayment).toHaveBeenCalledWith(
      88,
      'AO20260713000000001000001',
    );
    expect(result.data).toEqual({
      order_no: 'AO20260713000000001000001',
      app_code: 'workflow',
      amount_cents: 9900,
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
      (controller.devConfirm as any)(
        { order_no: 'SO20260702000000001000001' },
        billingUser,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(saasOrderService.confirmDevPayment).not.toHaveBeenCalled();
    expect(resourcePackOrderService.confirmDevPayment).not.toHaveBeenCalled();
    expect(appOrderService.confirmDevPayment).not.toHaveBeenCalled();
  });

  it('delegates Alipay notify handling to payment service', async () => {
    const body = { out_trade_no: 'SO1', trade_status: 'TRADE_SUCCESS' };
    saasPaymentService.handleAlipayNotify.mockResolvedValue({ ack: 'success', outcome: 'confirmed' });

    await expect(controller.alipayNotify(body)).resolves.toBe('success');

    expect(saasPaymentService.handleAlipayNotify).toHaveBeenCalledWith(body);
    expect(saasPaymentService.handleAlipayNotify).toHaveBeenCalledTimes(1);
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(resourcePackOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
  });

  it('returns fail when payment service rejects Alipay notify', async () => {
    const body = { out_trade_no: 'SO1', trade_status: 'TRADE_SUCCESS' };
    saasPaymentService.handleAlipayNotify.mockResolvedValue({ ack: 'fail', outcome: 'rejected' });

    await expect(controller.alipayNotify(body)).resolves.toBe('fail');

    expect(saasPaymentService.handleAlipayNotify).toHaveBeenCalledWith(body);
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(resourcePackOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
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

    const result = await (controller.createAlipayPayment as any)(
      { order_no: 'SO20260702000000001000001' },
      billingUser,
    );

    expect(saasPaymentService.createAlipayPayment).toHaveBeenCalledWith(12, 'SO20260702000000001000001', 'plan');
    expect(result.data).toEqual({
      configured: false,
      provider: 'alipay',
      order_no: 'SO20260702000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing.',
    });
  });

  it('creates an Alipay app payment in tenant context', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);
    saasPaymentService.createAlipayPayment.mockResolvedValue({
      configured: false,
      provider: 'alipay',
      order_no: 'AO20260713000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing.',
    });

    await (controller.createAlipayPayment as any)(
      {
        order_no: 'AO20260713000000001000001',
        order_type: 'app',
      },
      appPurchaseUser,
    );

    expect(saasPaymentService.createAlipayPayment).toHaveBeenCalledWith(
      12,
      'AO20260713000000001000001',
      'app',
    );
  });

  it('requires explicit tenant payment permissions for Alipay payment creation', () => {
    expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.createAlipayPayment)).toEqual([
      'tenant:billing:upgrade',
      'tenant:resource-pack-order:pay',
      'app:tenant:purchase',
    ]);
  });

  it('requires payment permission metadata on development confirmation', () => {
    expect(Reflect.getMetadata('requirePermission', SaasPaymentController.prototype.devConfirm)).toEqual([
      'tenant:billing:upgrade',
      'tenant:resource-pack-order:pay',
      'app:tenant:purchase',
    ]);
  });

  it('denies a resource pack payment when the user only has plan upgrade permission', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);

    await expect(
      (controller.createAlipayPayment as any)(
        { order_no: 'RPO20260703120000001000001', order_type: 'resource_pack' },
        billingUser,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(saasPaymentService.createAlipayPayment).not.toHaveBeenCalled();
  });

  it('denies an app development confirmation when the user only has resource pack payment permission', async () => {
    jest.spyOn(tenantUtils, 'getTenantId').mockReturnValue(12);

    await expect(
      (controller.devConfirm as any)(
        { order_no: 'AO20260713000000001000001', order_type: 'app' },
        resourcePackUser,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(appOrderService.confirmDevPayment).not.toHaveBeenCalled();
  });
});
