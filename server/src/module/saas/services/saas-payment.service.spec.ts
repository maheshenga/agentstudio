import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify, generateKeyPairSync } from 'crypto';

import { SAAS_ORDER_PAID, SAAS_ORDER_PENDING } from '../constants';
import { SaasOrderService } from './saas-order.service';
import { SaasPaymentService } from './saas-payment.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

describe('SaasPaymentService', () => {
  const saasOrderService = {
    findTenantOrder: jest.fn(),
  };
  const resourcePackOrderService = {
    findTenantOrder: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  let service: SaasPaymentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SaasPaymentService(
      saasOrderService as unknown as SaasOrderService,
      resourcePackOrderService as unknown as SaasResourcePackOrderService,
      configService as unknown as ConfigService,
    );
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
  });

  it('returns a signed Alipay page payment URL when config is complete', async () => {
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

  it('returns a signed Alipay URL for resource pack orders with resource pack subject', async () => {
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

  it('verifies a valid RSA2 Alipay notify signature', () => {
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

    expect(service.verifyAlipayNotify({ ...body, sign })).toBe(true);
  });

  it('rejects Alipay notify payloads without a usable signature', () => {
    configService.get.mockReturnValue('');

    expect(
      service.verifyAlipayNotify({
        out_trade_no: 'SO20260702000000001000001',
        trade_status: 'TRADE_SUCCESS',
      }),
    ).toBe(false);
  });

  it('reports missing Alipay config without exposing secret values', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'payment.alipay.gatewayUrl') {
        return 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
      }
      return '';
    });

    expect(service.getAlipayConfigStatus()).toEqual({
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

  it('reports complete Alipay config with masked app id', () => {
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

    expect(service.getAlipayConfigStatus()).toEqual({
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
