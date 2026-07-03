import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify, generateKeyPairSync } from 'crypto';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING } from '../constants';
import { SaasOrderService } from './saas-order.service';
import { SaasPaymentConfigService } from './saas-payment-config.service';
import { SaasPaymentService } from './saas-payment.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

describe('SaasPaymentService', () => {
  const saasOrderService = {
    findTenantOrder: jest.fn(),
    markTenantPaymentRequested: jest.fn(),
  };
  const resourcePackOrderService = {
    findTenantOrder: jest.fn(),
    markTenantPaymentRequested: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const paymentConfigService = {
    resolveAlipayConfig: jest.fn(),
    getAlipayConfigStatus: jest.fn(),
  };

  let service: SaasPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaasPaymentService(
      saasOrderService as unknown as SaasOrderService,
      resourcePackOrderService as unknown as SaasResourcePackOrderService,
      configService as unknown as ConfigService,
      paymentConfigService as unknown as SaasPaymentConfigService,
    );
    paymentConfigService.resolveAlipayConfig.mockResolvedValue(null);
    saasOrderService.markTenantPaymentRequested.mockResolvedValue(undefined);
    resourcePackOrderService.markTenantPaymentRequested.mockResolvedValue(undefined);
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
