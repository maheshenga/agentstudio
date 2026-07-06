import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createVerify } from 'crypto';

import { SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { SaasOrderService } from './saas-order.service';
import { SaasPaymentConfigService } from './saas-payment-config.service';
import { SaasResourcePackOrderService } from './saas-resource-pack-order.service';

const ALIPAY_MISSING_CONFIG_MESSAGE =
  'Alipay sandbox config is missing. Set ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, ALIPAY_NOTIFY_URL and ALIPAY_RETURN_URL.';
const ALIPAY_PAGE_PAY_READY_MESSAGE = 'Alipay page payment URL is ready.';
const ALIPAY_DEFAULT_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
const ALIPAY_PAGE_PAY_METHOD = 'alipay.trade.page.pay';
const ALIPAY_PAGE_PAY_PRODUCT_CODE = 'FAST_INSTANT_TRADE_PAY';
const ALIPAY_PAID_TRADE_STATUSES = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED']);

export interface SaasAlipayPaymentResult {
  configured: boolean;
  provider: typeof SAAS_PAYMENT_ALIPAY;
  order_no: string;
  pay_url: string | null;
  message: string;
}

export interface SaasAlipayConfigStatus {
  enabled: boolean;
  configured: boolean;
  missing_keys: string[];
  app_id_masked: string;
  gateway_url: string;
  notify_url_configured: boolean;
  return_url_configured: boolean;
}

export type SaasAlipayPaidNotifyValidationReason =
  | 'invalid_signature'
  | 'app_id_mismatch'
  | 'trade_not_paid'
  | 'order_mismatch'
  | 'amount_mismatch';

export interface SaasAlipayExpectedOrder {
  orderNo: string;
  amountCents: number;
}

export interface SaasAlipayPaidNotifyValidationResult {
  valid: boolean;
  reason?: SaasAlipayPaidNotifyValidationReason;
  tradeNo?: string;
}

interface AlipayConfig {
  enabled: boolean;
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
  gatewayUrl: string;
}

export type SaasPaymentOrderType = 'plan' | 'resource_pack';

type SaasPayableOrder = {
  orderNo: string;
  amountCents: number;
  subject: string;
};

@Injectable()
export class SaasPaymentService {
  constructor(
    private readonly saasOrderService: SaasOrderService,
    private readonly saasResourcePackOrderService: SaasResourcePackOrderService,
    private readonly configService: ConfigService,
    private readonly paymentConfigService: SaasPaymentConfigService,
  ) {}

  async createAlipayPayment(
    tenantId: number,
    orderNo: string,
    orderType: SaasPaymentOrderType = 'plan',
  ): Promise<SaasAlipayPaymentResult> {
    const order = await this.resolvePayableOrder(tenantId, orderNo, orderType);
    const config = await this.resolveAlipayConfig();
    if (!this.isAlipayConfigured(config)) {
      return {
        configured: false,
        provider: SAAS_PAYMENT_ALIPAY,
        order_no: order.orderNo,
        pay_url: null,
        message: ALIPAY_MISSING_CONFIG_MESSAGE,
      };
    }

    const payUrl = this.buildSignedPagePayUrl(config, order);
    await this.markPaymentRequested(tenantId, order.orderNo, orderType, new Date());

    return {
      configured: true,
      provider: SAAS_PAYMENT_ALIPAY,
      order_no: order.orderNo,
      pay_url: payUrl,
      message: ALIPAY_PAGE_PAY_READY_MESSAGE,
    };
  }

  async verifyAlipayNotify(body: Record<string, any>): Promise<boolean> {
    const sign = String(body.sign || '');
    const config = await this.resolveAlipayConfig();
    const publicKey = config.publicKey;
    if (!sign || !publicKey) {
      return false;
    }

    const signType = String(body.sign_type || 'RSA2').toUpperCase();
    const algorithm = signType === 'RSA' ? 'RSA-SHA1' : 'RSA-SHA256';
    const signContent = this.buildAlipaySignContent(body);
    const normalizedPublicKey = this.normalizePublicKey(publicKey);

    try {
      return createVerify(algorithm).update(signContent, 'utf8').verify(normalizedPublicKey, sign, 'base64');
    } catch {
      return false;
    }
  }

  async verifyAlipayPaidNotify(
    body: Record<string, any>,
    expected: SaasAlipayExpectedOrder,
  ): Promise<SaasAlipayPaidNotifyValidationResult> {
    if (!(await this.verifyAlipayNotify(body))) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const config = await this.resolveAlipayConfig();
    if (String(body.app_id || '') !== config.appId) {
      return { valid: false, reason: 'app_id_mismatch' };
    }

    const tradeStatus = String(body.trade_status || '');
    if (!ALIPAY_PAID_TRADE_STATUSES.has(tradeStatus)) {
      return { valid: false, reason: 'trade_not_paid' };
    }

    if (String(body.out_trade_no || '') !== expected.orderNo) {
      return { valid: false, reason: 'order_mismatch' };
    }

    if (this.parseAlipayAmountCents(body.total_amount) !== expected.amountCents) {
      return { valid: false, reason: 'amount_mismatch' };
    }

    return {
      valid: true,
      tradeNo: String(body.trade_no || ''),
    };
  }

  async getAlipayConfigStatus(): Promise<SaasAlipayConfigStatus> {
    const dbConfig = await this.paymentConfigService.resolveAlipayConfig();
    if (dbConfig) {
      const missingKeys = this.getMissingAlipayConfigKeys(dbConfig);
      return {
        enabled: dbConfig.enabled,
        configured: missingKeys.length === 0,
        missing_keys: missingKeys,
        app_id_masked: this.maskConfigValue(dbConfig.appId),
        gateway_url: dbConfig.gatewayUrl,
        notify_url_configured: Boolean(dbConfig.notifyUrl),
        return_url_configured: Boolean(dbConfig.returnUrl),
      };
    }

    const config = this.getEnvironmentAlipayConfig();
    const missingKeys = this.getMissingAlipayConfigKeys(config);

    return {
      enabled: config.enabled,
      configured: missingKeys.length === 0,
      missing_keys: missingKeys,
      app_id_masked: this.maskConfigValue(config.appId),
      gateway_url: config.gatewayUrl,
      notify_url_configured: Boolean(config.notifyUrl),
      return_url_configured: Boolean(config.returnUrl),
    };
  }

  private async resolveAlipayConfig(): Promise<AlipayConfig> {
    const dbConfig = await this.paymentConfigService.resolveAlipayConfig();
    if (dbConfig) {
      return {
        enabled: dbConfig.enabled,
        appId: dbConfig.appId,
        privateKey: dbConfig.privateKey,
        publicKey: dbConfig.publicKey,
        notifyUrl: dbConfig.notifyUrl,
        returnUrl: dbConfig.returnUrl,
        gatewayUrl: dbConfig.gatewayUrl,
      };
    }

    return this.getEnvironmentAlipayConfig();
  }

  private getEnvironmentAlipayConfig(): AlipayConfig {
    return {
      enabled: this.configService.get<boolean>('payment.alipay.enabled') === true,
      appId: this.configService.get<string>('payment.alipay.appId') || '',
      privateKey: this.configService.get<string>('payment.alipay.privateKey') || '',
      publicKey: this.configService.get<string>('payment.alipay.publicKey') || '',
      notifyUrl: this.configService.get<string>('payment.alipay.notifyUrl') || '',
      returnUrl: this.configService.get<string>('payment.alipay.returnUrl') || '',
      gatewayUrl: this.configService.get<string>('payment.alipay.gatewayUrl') || ALIPAY_DEFAULT_GATEWAY,
    };
  }

  private isAlipayConfigured(config: AlipayConfig): boolean {
    return this.getMissingAlipayConfigKeys(config).length === 0;
  }

  private getMissingAlipayConfigKeys(config: AlipayConfig): string[] {
    const checks: Array<[string, boolean]> = [
      ['ALIPAY_ENABLED', config.enabled],
      ['ALIPAY_APP_ID', Boolean(config.appId)],
      ['ALIPAY_PRIVATE_KEY', Boolean(config.privateKey)],
      ['ALIPAY_PUBLIC_KEY', Boolean(config.publicKey)],
      ['ALIPAY_NOTIFY_URL', Boolean(config.notifyUrl)],
      ['ALIPAY_RETURN_URL', Boolean(config.returnUrl)],
    ];

    return checks.filter(([, present]) => !present).map(([key]) => key);
  }

  private async resolvePayableOrder(
    tenantId: number,
    orderNo: string,
    orderType: SaasPaymentOrderType,
  ): Promise<SaasPayableOrder> {
    if (orderType === 'resource_pack') {
      const order = await this.saasResourcePackOrderService.findTenantOrder(tenantId, orderNo);
      if (!order) {
        throw new NotFoundException('Resource pack order not found');
      }
      if (order.status !== SAAS_ORDER_PENDING) {
        throw new BadRequestException('Only pending orders can be paid');
      }
      return {
        orderNo: order.orderNo,
        amountCents: order.amountCents,
        subject: `SaaS resource pack ${order.resourcePackCode}`,
      };
    }

    const order = await this.saasOrderService.findTenantOrder(tenantId, orderNo);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== SAAS_ORDER_PENDING) {
      throw new BadRequestException('Only pending orders can be paid');
    }
    return {
      orderNo: order.orderNo,
      amountCents: order.amountCents,
      subject: `SaaS plan ${order.planCode}`,
    };
  }

  private async markPaymentRequested(
    tenantId: number,
    orderNo: string,
    orderType: SaasPaymentOrderType,
    now: Date,
  ): Promise<void> {
    if (orderType === 'resource_pack') {
      await this.saasResourcePackOrderService.markTenantPaymentRequested(tenantId, orderNo, now);
      return;
    }

    await this.saasOrderService.markTenantPaymentRequested(tenantId, orderNo, now);
  }

  private buildSignedPagePayUrl(config: AlipayConfig, order: SaasPayableOrder): string {
    const params: Record<string, string> = {
      app_id: config.appId,
      method: ALIPAY_PAGE_PAY_METHOD,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: this.formatAlipayTimestamp(new Date()),
      version: '1.0',
      notify_url: config.notifyUrl,
      return_url: config.returnUrl,
      biz_content: JSON.stringify({
        out_trade_no: order.orderNo,
        total_amount: this.formatAmountYuan(order.amountCents),
        subject: order.subject,
        product_code: ALIPAY_PAGE_PAY_PRODUCT_CODE,
      }),
    };
    params.sign = createSign('RSA-SHA256')
      .update(this.buildAlipaySignContent(params), 'utf8')
      .sign(this.normalizePrivateKey(config.privateKey), 'base64');

    const url = new URL(config.gatewayUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return url.toString();
  }

  private buildAlipaySignContent(body: Record<string, any>): string {
    return Object.keys(body)
      .filter((key) => key !== 'sign' && key !== 'sign_type' && body[key] !== undefined && body[key] !== null && body[key] !== '')
      .sort()
      .map((key) => `${key}=${body[key]}`)
      .join('&');
  }

  private normalizePublicKey(publicKey: string): string {
    const trimmed = publicKey.trim().replace(/\\n/g, '\n');
    if (trimmed.includes('BEGIN PUBLIC KEY')) {
      return trimmed;
    }

    const compact = trimmed.replace(/\s+/g, '');
    const lines = compact.match(/.{1,64}/g) || [];
    return ['-----BEGIN PUBLIC KEY-----', ...lines, '-----END PUBLIC KEY-----'].join('\n');
  }

  private normalizePrivateKey(privateKey: string): string {
    const trimmed = privateKey.trim().replace(/\\n/g, '\n');
    if (trimmed.includes('BEGIN PRIVATE KEY')) {
      return trimmed;
    }

    const compact = trimmed.replace(/\s+/g, '');
    const lines = compact.match(/.{1,64}/g) || [];
    return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n');
  }

  private formatAmountYuan(amountCents: number): string {
    return ((Number(amountCents) || 0) / 100).toFixed(2);
  }

  private parseAlipayAmountCents(value: unknown): number | null {
    const normalized = String(value ?? '').trim();
    const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) {
      return null;
    }

    const yuan = Number(match[1]);
    const cents = Number((match[2] || '').padEnd(2, '0'));
    if (!Number.isSafeInteger(yuan) || !Number.isSafeInteger(cents)) {
      return null;
    }
    return yuan * 100 + cents;
  }

  private formatAlipayTimestamp(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      ' ',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes()),
      ':',
      pad(date.getSeconds()),
    ].join('');
  }

  private maskConfigValue(value: string): string {
    if (!value) {
      return '';
    }
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return `${value.slice(0, 4)}${'*'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}`;
  }
}
