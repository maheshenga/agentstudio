import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DependencyMonitorService } from '../../../logging/dependency-monitor.service';
import type { DependencyStatusSnapshot } from '../../../logging/interfaces/dependency-status.interface';
import { SaasPaymentConfigService } from './saas-payment-config.service';

type RuntimeHealthStatus = 'ready' | 'degraded' | 'blocked';
type RuntimeCheckStatus = 'ok' | 'warning' | 'missing' | 'down';

type RuntimeCheck = {
  key: string;
  status: RuntimeCheckStatus;
  required: boolean;
  message: string;
  remediation: string;
};

type RequiredConfig = {
  envKey: string;
  configKey: string;
  required: boolean;
};

export type SaasRuntimeHealthReport = {
  status: RuntimeHealthStatus;
  generated_at: string;
  environment: {
    app_name: string;
    node_env: string;
    debug_enabled: boolean;
    login_captcha_enabled: boolean;
    dev_payment_confirm_enabled: boolean;
  };
  dependencies: {
    mysql: DependencyStatusSnapshot;
    redis: DependencyStatusSnapshot;
  };
  payment: {
    alipay: Record<string, unknown>;
  };
  required_env: {
    total_required: number;
    configured_keys: string[];
    missing_keys: string[];
  };
  checks: RuntimeCheck[];
};

const REQUIRED_CONFIGS: RequiredConfig[] = [
  { envKey: 'DB_HOST', configKey: 'database.host', required: true },
  { envKey: 'DB_PORT', configKey: 'database.port', required: true },
  { envKey: 'DB_USERNAME', configKey: 'database.username', required: true },
  { envKey: 'DB_PASSWORD', configKey: 'database.password', required: true },
  { envKey: 'DB_NAME', configKey: 'database.name', required: true },
  { envKey: 'JWT_SECRET', configKey: 'jwt.secret', required: true },
  { envKey: 'JWT_EXPIRES_IN', configKey: 'jwt.expiresIn', required: true },
  { envKey: 'REDIS_HOST', configKey: 'redis.host', required: true },
  { envKey: 'REDIS_PORT', configKey: 'redis.port', required: true },
  { envKey: 'REDIS_DB', configKey: 'redis.db', required: true },
];

@Injectable()
export class SaasRuntimeHealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dependencyMonitorService: DependencyMonitorService,
    private readonly paymentConfigService: SaasPaymentConfigService,
  ) {}

  async getPlatformRuntimeHealth(): Promise<SaasRuntimeHealthReport> {
    const dependencies = this.dependencyMonitorService.getSnapshot();
    const alipay = this.sanitizeAlipayStatus(await this.paymentConfigService.getAlipayConfigStatus());
    const envChecks = this.buildEnvChecks();
    const dependencyChecks = this.buildDependencyChecks(dependencies.mysql, dependencies.redis);
    const paymentChecks = this.buildPaymentChecks(alipay);
    const checks = [...envChecks, ...dependencyChecks, ...paymentChecks];
    const missingKeys = envChecks.filter((check) => check.status === 'missing').map((check) => check.key);

    return {
      status: this.resolveStatus(checks),
      generated_at: new Date().toISOString(),
      environment: {
        app_name: this.configService.get<string>('app.name', 'nextjs-server'),
        node_env: this.configService.get<string>('app.env', 'development'),
        debug_enabled: this.configService.get<boolean>('app.debug', true),
        login_captcha_enabled: this.readBooleanEnv('LOGIN_CAPTCHA_ENABLED', true),
        dev_payment_confirm_enabled: this.configService.get<boolean>('payment.devConfirmEnabled', false),
      },
      dependencies: {
        mysql: dependencies.mysql,
        redis: dependencies.redis,
      },
      payment: {
        alipay,
      },
      required_env: {
        total_required: REQUIRED_CONFIGS.filter((item) => item.required).length,
        configured_keys: REQUIRED_CONFIGS.filter((item) => this.hasConfigValue(item.configKey)).map((item) => item.envKey),
        missing_keys: missingKeys,
      },
      checks,
    };
  }

  private buildEnvChecks(): RuntimeCheck[] {
    return REQUIRED_CONFIGS.map((item) => {
      const configured = this.hasConfigValue(item.configKey);
      return {
        key: item.envKey,
        status: configured ? 'ok' : 'missing',
        required: item.required,
        message: configured ? `${item.envKey} is configured` : `${item.envKey} is missing`,
        remediation: configured ? '' : `Set ${item.envKey} in server environment before demo or release.`,
      };
    });
  }

  private buildDependencyChecks(mysql: DependencyStatusSnapshot, redis: DependencyStatusSnapshot): RuntimeCheck[] {
    return [
      {
        key: 'mysql',
        status: mysql.status === 'up' ? 'ok' : 'down',
        required: true,
        message: mysql.status === 'up' ? 'MySQL dependency is reachable' : mysql.lastError || 'MySQL dependency is down',
        remediation:
          mysql.status === 'up'
            ? ''
            : 'Verify DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME and MySQL service status.',
      },
      {
        key: 'redis',
        status: redis.status === 'up' ? 'ok' : 'down',
        required: true,
        message: redis.status === 'up' ? 'Redis dependency is reachable' : redis.lastError || 'Redis dependency is down',
        remediation:
          redis.status === 'up'
            ? ''
            : 'Verify REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB and Redis service status.',
      },
    ];
  }

  private buildPaymentChecks(alipay: Record<string, any>): RuntimeCheck[] {
    const configured = alipay.configured === true;
    return [
      {
        key: 'alipay',
        status: configured ? 'ok' : 'warning',
        required: false,
        message: configured
          ? 'Alipay configuration is complete'
          : `Alipay configuration is incomplete: ${(alipay.missing_keys || []).join(', ') || 'missing provider settings'}`,
        remediation: configured
          ? ''
          : 'Open SaaS platform payment config and complete Alipay app, key, notify, and return URL settings.',
      },
    ];
  }

  private sanitizeAlipayStatus(status: Record<string, any>): Record<string, unknown> {
    return {
      provider: status.provider,
      enabled: status.enabled === true,
      configured: status.configured === true,
      missing_keys: Array.isArray(status.missing_keys) ? status.missing_keys : [],
      app_id_masked: status.app_id_masked || '',
      gateway_url: status.gateway_url || '',
      notify_url_configured: status.notify_url_configured === true,
      return_url_configured: status.return_url_configured === true,
      private_key_configured: status.private_key_configured === true,
      public_key_configured: status.public_key_configured === true,
      remark: status.remark || '',
    };
  }

  private resolveStatus(checks: RuntimeCheck[]): RuntimeHealthStatus {
    if (checks.some((check) => check.required && ['missing', 'down'].includes(check.status))) {
      return 'blocked';
    }
    if (checks.some((check) => check.status === 'warning')) {
      return 'degraded';
    }
    return 'ready';
  }

  private hasConfigValue(configKey: string): boolean {
    const value = this.configService.get<unknown>(configKey);
    if (value === undefined || value === null) return false;
    if (typeof value === 'string') return value.trim() !== '';
    return true;
  }

  private readBooleanEnv(key: string, fallback: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return value === 'true';
  }
}
