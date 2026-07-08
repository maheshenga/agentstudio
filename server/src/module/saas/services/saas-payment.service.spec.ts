import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify, generateKeyPairSync, type KeyObject } from 'crypto';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING } from '../constants';
import { SaasOrderService } from './saas-order.service';
import { SaasPaymentConfigService } from './saas-payment-config.service';
import { SaasPaymentService } from './saas-payment.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

describe('SaasPaymentService', () => {
  const saasOrderService = {
    findTenantOrder: jest.fn(),
    markTenantPaymentRequested: jest.fn(),
    findPlatformOrder: jest.fn(),
    confirmAlipayPayment: jest.fn(),
  };
  const resourcePackOrderService = {
    findTenantOrder: jest.fn(),
    markTenantPaymentRequested: jest.fn(),
    findPlatformOrder: jest.fn(),
    confirmAlipayPayment: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const paymentConfigService = {
    resolveAlipayConfig: jest.fn(),
    getAlipayConfigStatus: jest.fn(),
  };
  const paymentNotifyLogRepo = {
    create: jest.fn((input) => input),
    save: jest.fn(async (input) => input),
  };

  let service: SaasPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaasPaymentService(
      saasOrderService as unknown as SaasOrderService,
      resourcePackOrderService as unknown as SaasResourcePackOrderService,
      configService as unknown as ConfigService,
      paymentConfigService as unknown as SaasPaymentConfigService,
      paymentNotifyLogRepo as any,
    );
    paymentConfigService.resolveAlipayConfig.mockResolvedValue(null);
    saasOrderService.markTenantPaymentRequested.mockResolvedValue(undefined);
    resourcePackOrderService.markTenantPaymentRequested.mockResolvedValue(undefined);
    paymentNotifyLogRepo.save.mockImplementation(async (input) => input);
  });

  it('returns an unconfigured Alipay result when sandbox keys are missing', async () => {
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000001',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
    });
    configService.get.mockImplementation((key: string) => {
      if (key === 'payment.alipay.gatewayUrl') {
        return 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
      }
      return '';
    });

    const result = await service.createAlipayPayment(12, 'SO20260702000000001000001');

    expect(result).toEqual({
      configured: false,
      provider: 'alipay',
      order_no: 'SO20260702000000001000001',
      pay_url: null,
      message: 'Alipay sandbox config is missing. Set ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, ALIPAY_NOTIFY_URL and ALIPAY_RETURN_URL.',
    });
    expect(saasOrderService.markTenantPaymentRequested).not.toHaveBeenCalled();
  });

  it('marks a plan order payment requested before returning a signed Alipay page payment URL', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000002',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      planCode: 'pro',
      amountCents: 99000,
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        'payment.alipay.enabled': true,
        'payment.alipay.appId': '2026070200000001',
        'payment.alipay.privateKey': privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        'payment.alipay.publicKey': publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
        'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/plan',
        'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      };
      return values[key];
    });

    const result = await service.createAlipayPayment(12, 'SO20260702000000001000002');

    expect(saasOrderService.markTenantPaymentRequested).toHaveBeenCalledWith(
      12,
      'SO20260702000000001000002',
      expect.any(Date),
    );
    expect(result.configured).toBe(true);
    expect(result.provider).toBe('alipay');
    expect(result.order_no).toBe('SO20260702000000001000002');
    expect(result.message).toBe('Alipay page payment URL is ready.');

    const payUrl = new URL(result.pay_url || '');
    const params = Object.fromEntries(payUrl.searchParams.entries());
    const sign = params.sign;
    expect(payUrl.origin + payUrl.pathname).toBe('https://openapi-sandbox.dl.alipaydev.com/gateway.do');
    expect(params.app_id).toBe('2026070200000001');
    expect(params.method).toBe('alipay.trade.page.pay');
    expect(params.sign_type).toBe('RSA2');
    expect(params.notify_url).toBe('http://127.0.0.1:8181/api/saas/payment/alipay/notify');
    expect(params.return_url).toBe('http://127.0.0.1:5731/#/tenant-saas/plan');

    const bizContent = JSON.parse(params.biz_content);
    expect(bizContent).toEqual({
      out_trade_no: 'SO20260702000000001000002',
      total_amount: '990.00',
      subject: 'SaaS plan pro',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    });
    expect(
      createVerify('RSA-SHA256')
        .update(buildAlipaySignContent(params), 'utf8')
        .verify(publicKey, sign, 'base64'),
    ).toBe(true);
  });

  it('marks a resource pack order payment requested before returning a signed Alipay URL', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    resourcePackOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'RPO20260703120000001000001',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      resourcePackCode: 'tokens_1m',
      amountCents: 19900,
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        'payment.alipay.enabled': true,
        'payment.alipay.appId': '2026070200000001',
        'payment.alipay.privateKey': privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        'payment.alipay.publicKey': publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
        'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/resource-packs',
        'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      };
      return values[key];
    });

    const result = await service.createAlipayPayment(12, 'RPO20260703120000001000001', 'resource_pack');

    expect(resourcePackOrderService.findTenantOrder).toHaveBeenCalledWith(12, 'RPO20260703120000001000001');
    expect(resourcePackOrderService.markTenantPaymentRequested).toHaveBeenCalledWith(
      12,
      'RPO20260703120000001000001',
      expect.any(Date),
    );
    const payUrl = new URL(result.pay_url || '');
    const params = Object.fromEntries(payUrl.searchParams.entries());
    expect(JSON.parse(params.biz_content)).toEqual({
      out_trade_no: 'RPO20260703120000001000001',
      total_amount: '199.00',
      subject: 'SaaS resource pack tokens_1m',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    });
    expect(
      createVerify('RSA-SHA256')
        .update(buildAlipaySignContent(params), 'utf8')
        .verify(publicKey, params.sign, 'base64'),
    ).toBe(true);
  });

  it('rejects without returning an Alipay URL when a plan order is no longer pending while marking payment requested', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000004',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      planCode: 'pro',
      amountCents: 99000,
    });
    saasOrderService.markTenantPaymentRequested.mockRejectedValue(new BadRequestException('Only pending orders can be paid'));
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        'payment.alipay.enabled': true,
        'payment.alipay.appId': '2026070200000001',
        'payment.alipay.privateKey': privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
        'payment.alipay.publicKey': publicKey.export({ type: 'spki', format: 'pem' }).toString(),
        'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
        'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/plan',
        'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      };
      return values[key];
    });

    await expect(service.createAlipayPayment(12, 'SO20260702000000001000004')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not mark payment requested when Alipay URL signing fails', async () => {
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000005',
      tenantId: 12,
      status: SAAS_ORDER_PENDING,
      planCode: 'pro',
      amountCents: 99000,
    });
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        'payment.alipay.enabled': true,
        'payment.alipay.appId': '2026070200000001',
        'payment.alipay.privateKey': 'not-a-valid-private-key',
        'payment.alipay.publicKey': 'public-key-present',
        'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
        'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/plan',
        'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      };
      return values[key];
    });

    await expect(service.createAlipayPayment(12, 'SO20260702000000001000005')).rejects.toThrow();

    expect(saasOrderService.markTenantPaymentRequested).not.toHaveBeenCalled();
  });

  it('uses database Alipay config before environment config', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    paymentConfigService.resolveAlipayConfig.mockResolvedValue({
      enabled: true,
      appId: '2026070200000001',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      notifyUrl: 'http://db-notify/api/saas/payment/alipay/notify',
      returnUrl: 'http://db-return/#/tenant-saas/plan',
      gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      source: 'database',
    });
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000002',
      tenantId: 12,
      amountCents: 19900,
      planCode: 'pro',
      status: SAAS_ORDER_PENDING,
    });

    const result = await service.createAlipayPayment(12, 'SO20260702000000001000002');
    const payUrl = new URL(result.pay_url || '');

    expect(payUrl.searchParams.get('notify_url')).toBe('http://db-notify/api/saas/payment/alipay/notify');
  });

  it('rejects payment initiation for missing orders', async () => {
    saasOrderService.findTenantOrder.mockResolvedValue(null);

    await expect(service.createAlipayPayment(12, 'SO404')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects payment initiation for non-pending orders', async () => {
    saasOrderService.findTenantOrder.mockResolvedValue({
      orderNo: 'SO20260702000000001000003',
      tenantId: 12,
      status: SAAS_ORDER_PAID,
    });

    await expect(service.createAlipayPayment(12, 'SO20260702000000001000003')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('verifies a valid RSA2 Alipay notify signature', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    const body = {
      app_id: '2026070200000001',
      out_trade_no: 'SO20260702000000001000001',
      trade_no: '2026070222000000000001',
      trade_status: 'TRADE_SUCCESS',
      total_amount: '990.00',
      sign_type: 'RSA2',
    };
    const signContent = buildAlipaySignContent(body);
    const sign = createSign('RSA-SHA256').update(signContent, 'utf8').sign(privateKey, 'base64');

    configService.get.mockImplementation((key: string) => {
      if (key === 'payment.alipay.publicKey') {
        return publicKey.export({ type: 'spki', format: 'pem' }).toString();
      }
      return '';
    });

    await expect(service.verifyAlipayNotify({ ...body, sign })).resolves.toBe(true);
  });

  it('accepts a paid Alipay notify only when signature, app, order, status, and amount match', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    paymentConfigService.resolveAlipayConfig.mockResolvedValue({
      enabled: true,
      appId: '2026070200000001',
      privateKey: 'unused-private-key',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      notifyUrl: 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
      returnUrl: 'http://127.0.0.1:5731/#/tenant-saas/plan',
      gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      source: 'database',
    });
    const body = signAlipayNotify(
      {
        app_id: '2026070200000001',
        out_trade_no: 'SO20260702000000001000001',
        trade_no: '2026070222000000000001',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '990.00',
        sign_type: 'RSA2',
      },
      privateKey,
    );

    await expect(
      service.verifyAlipayPaidNotify(body, {
        orderNo: 'SO20260702000000001000001',
        amountCents: 99000,
      }),
    ).resolves.toEqual({
      valid: true,
      tradeNo: '2026070222000000000001',
    });
  });

  it.each([
    ['mismatched app id', { app_id: 'wrong-app' }, 'app_id_mismatch'],
    ['unpaid trade status', { trade_status: 'WAIT_BUYER_PAY' }, 'trade_not_paid'],
    ['mismatched order number', { out_trade_no: 'SO20260702000000001000999' }, 'order_mismatch'],
    ['mismatched amount', { total_amount: '9.90' }, 'amount_mismatch'],
    ['malformed amount', { total_amount: 'not-a-number' }, 'amount_mismatch'],
  ])('rejects paid Alipay notify validation for %s', async (_name, overrides, reason) => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    paymentConfigService.resolveAlipayConfig.mockResolvedValue({
      enabled: true,
      appId: '2026070200000001',
      privateKey: 'unused-private-key',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      notifyUrl: 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
      returnUrl: 'http://127.0.0.1:5731/#/tenant-saas/plan',
      gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      source: 'database',
    });
    const body = signAlipayNotify(
      {
        app_id: '2026070200000001',
        out_trade_no: 'SO20260702000000001000001',
        trade_no: '2026070222000000000001',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '990.00',
        sign_type: 'RSA2',
        ...overrides,
      },
      privateKey,
    );

    await expect(
      service.verifyAlipayPaidNotify(body, {
        orderNo: 'SO20260702000000001000001',
        amountCents: 99000,
      }),
    ).resolves.toEqual({
      valid: false,
      reason,
    });
  });

  it('rejects paid Alipay notify validation when the signature is invalid', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
    });
    paymentConfigService.resolveAlipayConfig.mockResolvedValue({
      enabled: true,
      appId: '2026070200000001',
      privateKey: 'unused-private-key',
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      notifyUrl: 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
      returnUrl: 'http://127.0.0.1:5731/#/tenant-saas/plan',
      gatewayUrl: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      source: 'database',
    });
    const body = signAlipayNotify(
      {
        app_id: '2026070200000001',
        out_trade_no: 'SO20260702000000001000001',
        trade_no: '2026070222000000000001',
        trade_status: 'TRADE_SUCCESS',
        total_amount: '990.00',
        sign_type: 'RSA2',
      },
      privateKey,
    );

    await expect(
      service.verifyAlipayPaidNotify(
        {
          ...body,
          total_amount: '990.01',
        },
        {
          orderNo: 'SO20260702000000001000001',
          amountCents: 99000,
        },
      ),
    ).resolves.toEqual({
      valid: false,
      reason: 'invalid_signature',
    });
  });

  it('handles a paid plan notify by confirming and recording audit', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
      status: SAAS_ORDER_PENDING,
    });
    jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: true, tradeNo: 'TRADE-1' });
    saasOrderService.confirmAlipayPayment.mockResolvedValue({ status: SAAS_ORDER_PAID });

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'success',
        outcome: 'confirmed',
        order_type: 'plan',
        order_no: 'SO20260702000000001000001',
      }),
    );

    expect(saasOrderService.confirmAlipayPayment).toHaveBeenCalledWith('SO20260702000000001000001', 'TRADE-1');
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'confirmed' }));
  });

  it('handles a paid resource pack notify by confirming the resource pack order', async () => {
    resourcePackOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'RPO20260703120000001000001',
      amount_cents: 19900,
      status: SAAS_ORDER_PENDING,
    });
    jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: true, tradeNo: 'TRADE-RPO-1' });
    resourcePackOrderService.confirmAlipayPayment.mockResolvedValue({ status: SAAS_ORDER_PAID });

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'RPO20260703120000001000001',
        trade_no: 'TRADE-RPO-1',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'success',
        outcome: 'confirmed',
        order_type: 'resource_pack',
        order_no: 'RPO20260703120000001000001',
      }),
    );

    expect(resourcePackOrderService.confirmAlipayPayment).toHaveBeenCalledWith(
      'RPO20260703120000001000001',
      'TRADE-RPO-1',
    );
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'confirmed' }));
  });

  it('handles duplicate paid plan notify without confirming again', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
      status: SAAS_ORDER_PAID,
    });
    jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: true, tradeNo: 'TRADE-1' });

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'success',
        outcome: 'duplicate',
        reason: 'order_already_paid',
      }),
    );

    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'duplicate' }));
  });

  it('ignores signed non-paid Alipay notify without mutating orders', async () => {
    jest.spyOn(service, 'verifyAlipayNotify').mockResolvedValue(true);

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'WAIT_BUYER_PAY',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'success',
        outcome: 'ignored',
        reason: 'trade_not_paid',
      }),
    );

    expect(saasOrderService.findPlatformOrder).not.toHaveBeenCalled();
    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'ignored' }));
  });

  it('rejects paid Alipay notify when signed payload does not match local order', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue({
      order_no: 'SO20260702000000001000001',
      amount_cents: 99000,
      status: SAAS_ORDER_PENDING,
    });
    jest.spyOn(service, 'verifyAlipayPaidNotify').mockResolvedValue({ valid: false, reason: 'amount_mismatch' });

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'fail',
        outcome: 'rejected',
        reason: 'amount_mismatch',
      }),
    );

    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'rejected' }));
  });

  it('fails paid Alipay notify for unknown local orders and records audit', async () => {
    saasOrderService.findPlatformOrder.mockResolvedValue(null);

    await expect(
      service.handleAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_no: 'TRADE-1',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        ack: 'fail',
        outcome: 'failed',
        reason: 'order_not_found',
      }),
    );

    expect(saasOrderService.confirmAlipayPayment).not.toHaveBeenCalled();
    expect(paymentNotifyLogRepo.save).toHaveBeenCalledWith(expect.objectContaining({ result: 'failed' }));
  });

  it('rejects Alipay notify payloads without a usable signature', async () => {
    configService.get.mockReturnValue('');

    await expect(
      service.verifyAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).resolves.toBe(false);
  });

  it('reports missing Alipay config without exposing secret values', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'payment.alipay.gatewayUrl') {
        return 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
      }
      return '';
    });

    await expect(service.getAlipayConfigStatus()).resolves.toEqual({
      enabled: false,
      configured: false,
      missing_keys: [
        'ALIPAY_ENABLED',
        'ALIPAY_APP_ID',
        'ALIPAY_PRIVATE_KEY',
        'ALIPAY_PUBLIC_KEY',
        'ALIPAY_NOTIFY_URL',
        'ALIPAY_RETURN_URL',
      ],
      app_id_masked: '',
      gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notify_url_configured: false,
      return_url_configured: false,
    });
  });

  it('reports complete Alipay config with masked app id', async () => {
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | boolean> = {
        'payment.alipay.enabled': true,
        'payment.alipay.appId': '2026070200000001',
        'payment.alipay.privateKey': 'private-key',
        'payment.alipay.publicKey': 'public-key',
        'payment.alipay.notifyUrl': 'http://127.0.0.1:8181/api/saas/payment/alipay/notify',
        'payment.alipay.returnUrl': 'http://127.0.0.1:5731/#/tenant-saas/plan',
        'payment.alipay.gatewayUrl': 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      };
      return values[key];
    });

    await expect(service.getAlipayConfigStatus()).resolves.toEqual({
      enabled: true,
      configured: true,
      missing_keys: [],
      app_id_masked: '2026********0001',
      gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notify_url_configured: true,
      return_url_configured: true,
    });
  });
});

function buildAlipaySignContent(body: Record<string, string>) {
  return Object.keys(body)
    .filter((key) => key !== 'sign' && key !== 'sign_type' && body[key] !== undefined && body[key] !== '')
    .sort()
    .map((key) => `${key}=${body[key]}`)
    .join('&');
}

function signAlipayNotify(body: Record<string, string>, privateKey: KeyObject) {
  const sign = createSign('RSA-SHA256').update(buildAlipaySignContent(body), 'utf8').sign(privateKey, 'base64');
  return { ...body, sign };
}
