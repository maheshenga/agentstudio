import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SAAS_ORDER_PENDING, SAAS_PAYMENT_ALIPAY } from '../constants';
import { SaasOrderService } from './saas-order.service';

const ALIPAY_MISSING_CONFIG_MESSAGE =
  'Alipay sandbox config is missing. Set ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY, ALIPAY_NOTIFY_URL and ALIPAY_RETURN_URL.';
const ALIPAY_PLACEHOLDER_READY_MESSAGE =
  'Alipay sandbox payment URL is ready. SDK signing will replace this placeholder before production.';
const ALIPAY_DEFAULT_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

export interface SaasAlipayPaymentResult {
  configured: boolean;
  provider: typeof SAAS_PAYMENT_ALIPAY;
  order_no: string;
  pay_url: string | null;
  message: string;
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

@Injectable()
export class SaasPaymentService {
  constructor(
    private readonly saasOrderService: SaasOrderService,
    private readonly configService: ConfigService,
  ) {}

  async createAlipayPayment(tenantId: number, orderNo: string): Promise<SaasAlipayPaymentResult> {
    const order = await this.saasOrderService.findTenantOrder(tenantId, orderNo);
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    if (order.status !== SAAS_ORDER_PENDING) {
      throw new BadRequestException('Only pending orders can be paid');
    }

    const config = this.getAlipayConfig();
    if (!this.isAlipayConfigured(config)) {
      return {
        configured: false,
        provider: SAAS_PAYMENT_ALIPAY,
        order_no: order.orderNo,
        pay_url: null,
        message: ALIPAY_MISSING_CONFIG_MESSAGE,
      };
    }

    return {
      configured: true,
      provider: SAAS_PAYMENT_ALIPAY,
      order_no: order.orderNo,
      pay_url: this.buildPlaceholderPayUrl(config, order.orderNo),
      message: ALIPAY_PLACEHOLDER_READY_MESSAGE,
    };
  }

  private getAlipayConfig(): AlipayConfig {
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
    return Boolean(
      config.enabled &&
        config.appId &&
        config.privateKey &&
        config.publicKey &&
        config.notifyUrl &&
        config.returnUrl &&
        config.gatewayUrl,
    );
  }

  private buildPlaceholderPayUrl(config: AlipayConfig, orderNo: string): string {
    const url = new URL(config.gatewayUrl);
    url.searchParams.set('app_id', config.appId);
    url.searchParams.set('method', 'alipay.trade.page.pay');
    url.searchParams.set('charset', 'utf-8');
    url.searchParams.set('sign_type', 'RSA2');
    url.searchParams.set('product_code', 'FAST_INSTANT_TRADE_PAY');
    url.searchParams.set('out_trade_no', orderNo);
    url.searchParams.set('notify_url', config.notifyUrl);
    url.searchParams.set('return_url', config.returnUrl);
    return url.toString();
  }
}
