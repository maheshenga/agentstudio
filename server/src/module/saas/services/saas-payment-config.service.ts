import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UpdateAlipayConfigDto } from '../dto/update-alipay-config.dto';
import { SaasPaymentConfigEntity } from '../entities/saas-payment-config.entity';

export const SAAS_PAYMENT_PROVIDER_ALIPAY = 'alipay';
export const SAAS_PAYMENT_SCOPE_PLATFORM = 'platform';
export const ALIPAY_DEFAULT_GATEWAY = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

export interface ResolvedAlipayConfig {
  enabled: boolean;
  appId: string;
  privateKey: string;
  publicKey: string;
  notifyUrl: string;
  returnUrl: string;
  gatewayUrl: string;
  source: 'database';
}

@Injectable()
export class SaasPaymentConfigService {
  constructor(
    @InjectRepository(SaasPaymentConfigEntity)
    private readonly paymentConfigRepo: Repository<SaasPaymentConfigEntity>,
  ) {}

  async getAlipayConfigStatus() {
    const config = await this.findAlipayConfig();
    const resolved = this.toResolvedConfig(config);
    const missingKeys = this.getMissingAlipayConfigKeys(resolved);

    return {
      provider: SAAS_PAYMENT_PROVIDER_ALIPAY,
      enabled: resolved.enabled,
      configured: missingKeys.length === 0,
      missing_keys: missingKeys,
      app_id_masked: this.maskConfigValue(resolved.appId),
      gateway_url: resolved.gatewayUrl,
      notify_url: resolved.notifyUrl,
      return_url: resolved.returnUrl,
      notify_url_configured: Boolean(resolved.notifyUrl),
      return_url_configured: Boolean(resolved.returnUrl),
      private_key_configured: Boolean(resolved.privateKey),
      public_key_configured: Boolean(resolved.publicKey),
      remark: config?.remark || '',
    };
  }

  async updateAlipayConfig(dto: UpdateAlipayConfigDto) {
    const config =
      (await this.findAlipayConfig()) ||
      this.paymentConfigRepo.create({
        provider: SAAS_PAYMENT_PROVIDER_ALIPAY,
        scope: SAAS_PAYMENT_SCOPE_PLATFORM,
      });

    config.enabled = dto.enabled ? 1 : 0;
    if (dto.app_id !== undefined && dto.app_id.trim() !== '') {
      config.appId = dto.app_id;
    } else {
      config.appId = config.appId || '';
    }
    if (dto.private_key !== undefined && dto.private_key.trim() !== '') {
      config.privateKey = dto.private_key;
    } else {
      config.privateKey = config.privateKey || '';
    }
    if (dto.public_key !== undefined && dto.public_key.trim() !== '') {
      config.publicKey = dto.public_key;
    } else {
      config.publicKey = config.publicKey || '';
    }
    config.gatewayUrl = dto.gateway_url || ALIPAY_DEFAULT_GATEWAY;
    config.notifyUrl = dto.notify_url || '';
    config.returnUrl = dto.return_url || '';
    config.remark = dto.remark || '';

    const saved = await this.paymentConfigRepo.save(config);
    return this.getStatusFromConfig(saved);
  }

  async resolveAlipayConfig(): Promise<ResolvedAlipayConfig | null> {
    const config = await this.findAlipayConfig();
    if (!config) {
      return null;
    }
    return this.toResolvedConfig(config);
  }

  private findAlipayConfig() {
    return this.paymentConfigRepo.findOne({
      where: {
        provider: SAAS_PAYMENT_PROVIDER_ALIPAY,
        scope: SAAS_PAYMENT_SCOPE_PLATFORM,
      },
    });
  }

  private getStatusFromConfig(config: SaasPaymentConfigEntity) {
    const resolved = this.toResolvedConfig(config);
    const missingKeys = this.getMissingAlipayConfigKeys(resolved);
    return {
      provider: SAAS_PAYMENT_PROVIDER_ALIPAY,
      enabled: resolved.enabled,
      configured: missingKeys.length === 0,
      missing_keys: missingKeys,
      app_id_masked: this.maskConfigValue(resolved.appId),
      gateway_url: resolved.gatewayUrl,
      notify_url: resolved.notifyUrl,
      return_url: resolved.returnUrl,
      notify_url_configured: Boolean(resolved.notifyUrl),
      return_url_configured: Boolean(resolved.returnUrl),
      private_key_configured: Boolean(resolved.privateKey),
      public_key_configured: Boolean(resolved.publicKey),
      remark: config.remark || '',
    };
  }

  private toResolvedConfig(config?: SaasPaymentConfigEntity | null): ResolvedAlipayConfig {
    return {
      enabled: config?.enabled === 1,
      appId: config?.appId || '',
      privateKey: config?.privateKey || '',
      publicKey: config?.publicKey || '',
      notifyUrl: config?.notifyUrl || '',
      returnUrl: config?.returnUrl || '',
      gatewayUrl: config?.gatewayUrl || ALIPAY_DEFAULT_GATEWAY,
      source: 'database',
    };
  }

  private getMissingAlipayConfigKeys(config: ResolvedAlipayConfig): string[] {
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
