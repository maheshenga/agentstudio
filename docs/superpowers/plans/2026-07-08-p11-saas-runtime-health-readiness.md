# P11 SaaS Runtime Health Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an authenticated platform SaaS runtime health report that shows whether dependencies, required runtime keys, payment setup, and operational switches are ready without exposing secrets.

**Architecture:** Add a focused `SaasRuntimeHealthService` under the SaaS module. It reads sanitized runtime state from `ConfigService`, `DependencyMonitorService`, and `SaasPaymentConfigService`, then exposes it through `GET /api/saas/platform/runtime-health` on the existing platform controller with `saas:usage:index` permission and tenant context cleared through `runOutsideTenant`.

**Tech Stack:** NestJS, TypeScript, Jest, existing `ResultData`, existing backend SaaS readiness command.

## Global Constraints

- Do not expose raw secret values, tokens, passwords, private keys, or public keys in the runtime health response.
- Do not add invoice functionality.
- Do not add runtime dependencies.
- Do not require live MySQL, Redis, Alipay, or external network calls in tests.
- Keep the endpoint platform-admin scoped; do not add detailed SaaS diagnostics to the public `/api/health` endpoint.
- Use TDD: write failing service/controller tests first, verify RED, then add minimal implementation.
- Use `pnpm.cmd` on Windows PowerShell.

---

### Task 1: Add Runtime Health Service and Platform API

**Files:**
- Create: `server/src/module/saas/services/saas-runtime-health.service.ts`
- Create: `server/src/module/saas/services/saas-runtime-health.service.spec.ts`
- Modify: `server/src/module/saas/saas-platform.controller.ts`
- Modify: `server/src/module/saas/saas-platform.controller.spec.ts`
- Modify: `server/src/module/saas/saas.module.ts`

**Interfaces:**
- Produces: `SaasRuntimeHealthService.getPlatformRuntimeHealth(): Promise<SaasRuntimeHealthReport>`
- Produces: `GET /api/saas/platform/runtime-health`
- Consumes: `ConfigService`, `DependencyMonitorService.getSnapshot()`, `SaasPaymentConfigService.getAlipayConfigStatus()`

- [ ] **Step 1: Write the failing service spec**

Create `server/src/module/saas/services/saas-runtime-health.service.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';

import { DependencyMonitorService } from '../../../logging/dependency-monitor.service';
import { SaasPaymentConfigService } from './saas-payment-config.service';
import { SaasRuntimeHealthService } from './saas-runtime-health.service';

describe('SaasRuntimeHealthService', () => {
  const configValues: Record<string, unknown> = {
    'app.name': 'AgentStudio',
    'app.env': 'development',
    'app.debug': true,
    'database.host': '127.0.0.1',
    'database.port': 3306,
    'database.username': 'root',
    'database.password': 'change_me',
    'database.name': 'fssoa-net',
    'jwt.secret': 'this_is_jwt_secret_change_me_32_chars_min',
    'jwt.expiresIn': '2h',
    'redis.host': '127.0.0.1',
    'redis.port': 6379,
    'redis.db': 0,
    'payment.devConfirmEnabled': true,
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback),
  } as unknown as ConfigService;

  const dependencyMonitorService = {
    getSnapshot: jest.fn(() => ({
      mysql: { name: 'mysql', status: 'up', lastCheckedAt: '2026-07-08T08:00:00.000Z' },
      redis: { name: 'redis', status: 'up', lastCheckedAt: '2026-07-08T08:00:00.000Z' },
    })),
  } as unknown as DependencyMonitorService;

  const paymentConfigService = {
    getAlipayConfigStatus: jest.fn(),
  } as unknown as SaasPaymentConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentConfigService.getAlipayConfigStatus = jest.fn().mockResolvedValue({
      provider: 'alipay',
      enabled: true,
      configured: true,
      missing_keys: [],
      app_id_masked: '2026********0001',
      gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      notify_url_configured: true,
      return_url_configured: true,
      private_key_configured: true,
      public_key_configured: true,
    }) as any;
  });

  it('returns a sanitized ready SaaS runtime health report', async () => {
    const service = new SaasRuntimeHealthService(configService, dependencyMonitorService, paymentConfigService);

    const report = await service.getPlatformRuntimeHealth();

    expect(report.status).toBe('ready');
    expect(report.environment).toEqual({
      app_name: 'AgentStudio',
      node_env: 'development',
      debug_enabled: true,
      login_captcha_enabled: true,
      dev_payment_confirm_enabled: true,
    });
    expect(report.dependencies.mysql.status).toBe('up');
    expect(report.dependencies.redis.status).toBe('up');
    expect(report.payment.alipay.configured).toBe(true);
    expect(report.required_env.missing_keys).toEqual([]);
    expect(JSON.stringify(report)).not.toContain('this_is_jwt_secret_change_me_32_chars_min');
    expect(JSON.stringify(report)).not.toContain('change_me');
  });

  it('marks runtime health blocked when required config and dependencies are missing', async () => {
    const blockedConfig = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (['database.password', 'jwt.secret'].includes(key)) return '';
        return configValues[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const downDependencies = {
      getSnapshot: jest.fn(() => ({
        mysql: { name: 'mysql', status: 'down', lastError: 'connect ECONNREFUSED' },
        redis: { name: 'redis', status: 'down', lastError: 'NOAUTH Authentication required' },
      })),
    } as unknown as DependencyMonitorService;
    const unconfiguredPayment = {
      getAlipayConfigStatus: jest.fn().mockResolvedValue({
        provider: 'alipay',
        enabled: false,
        configured: false,
        missing_keys: ['ALIPAY_ENABLED', 'ALIPAY_APP_ID'],
        gateway_url: 'https://openapi-sandbox.dl.alipaydev.com/gateway.do',
      }),
    } as unknown as SaasPaymentConfigService;
    const service = new SaasRuntimeHealthService(blockedConfig, downDependencies, unconfiguredPayment);

    const report = await service.getPlatformRuntimeHealth();

    expect(report.status).toBe('blocked');
    expect(report.required_env.missing_keys).toEqual(['DB_PASSWORD', 'JWT_SECRET']);
    expect(report.payment.alipay.configured).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'mysql', status: 'down' }),
        expect.objectContaining({ key: 'redis', status: 'down' }),
        expect.objectContaining({ key: 'JWT_SECRET', status: 'missing' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the service spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd test -- saas-runtime-health.service.spec.ts --runInBand --forceExit
```

Expected: FAIL because `saas-runtime-health.service.ts` does not exist.

- [ ] **Step 3: Implement the runtime health service**

Create `server/src/module/saas/services/saas-runtime-health.service.ts`:

```typescript
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
    const alipay = await this.paymentConfigService.getAlipayConfigStatus();
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
        remediation: mysql.status === 'up' ? '' : 'Verify DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME and MySQL service status.',
      },
      {
        key: 'redis',
        status: redis.status === 'up' ? 'ok' : 'down',
        required: true,
        message: redis.status === 'up' ? 'Redis dependency is reachable' : redis.lastError || 'Redis dependency is down',
        remediation: redis.status === 'up' ? '' : 'Verify REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB and Redis service status.',
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
        message: configured ? 'Alipay configuration is complete' : `Alipay configuration is incomplete: ${(alipay.missing_keys || []).join(', ') || 'missing provider settings'}`,
        remediation: configured ? '' : 'Open SaaS platform payment config and complete Alipay app, key, notify, and return URL settings.',
      },
    ];
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
```

- [ ] **Step 4: Run the service spec to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd test -- saas-runtime-health.service.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 5: Write the failing controller spec**

Modify `server/src/module/saas/saas-platform.controller.spec.ts`:

```typescript
import { SaasRuntimeHealthService } from './services/saas-runtime-health.service';
```

Add mock:

```typescript
const runtimeHealthService = {
  getPlatformRuntimeHealth: jest.fn(),
};
```

Add provider:

```typescript
{ provide: SaasRuntimeHealthService, useValue: runtimeHealthService },
```

Add test:

```typescript
it('returns SaaS runtime health outside tenant scope', async () => {
  runtimeHealthService.getPlatformRuntimeHealth.mockResolvedValue({
    status: 'degraded',
    required_env: { total_required: 10, configured_keys: ['DB_HOST'], missing_keys: [] },
  });

  const result = await controller.runtimeHealth({ userId: 1 } as any);

  expect(runtimeHealthService.getPlatformRuntimeHealth).toHaveBeenCalled();
  expect(result.data).toEqual({
    status: 'degraded',
    required_env: { total_required: 10, configured_keys: ['DB_HOST'], missing_keys: [] },
  });
});
```

- [ ] **Step 6: Run the controller spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd test -- saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: FAIL because `runtimeHealth` is not implemented and the service is not registered in the controller constructor.

- [ ] **Step 7: Wire controller and module**

Modify `server/src/module/saas/saas-platform.controller.ts`:

```typescript
import { SaasRuntimeHealthService } from './services/saas-runtime-health.service';
```

Add constructor parameter:

```typescript
private readonly runtimeHealthService: SaasRuntimeHealthService,
```

Add endpoint near `usageOverview`:

```typescript
@Get('runtime-health')
@ApiOperation({ summary: 'Get SaaS platform runtime health' })
@RequirePermission('saas:usage:index')
runtimeHealth(@User() user: UserDto) {
  return this.runOutsideTenant(user, () => this.runtimeHealthService.getPlatformRuntimeHealth().then((data) => ResultData.ok(data)));
}
```

Modify `server/src/module/saas/saas.module.ts` providers and exports:

```typescript
SaasRuntimeHealthService,
```

- [ ] **Step 8: Run controller and service specs to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd test -- saas-runtime-health.service.spec.ts saas-platform.controller.spec.ts --runInBand --forceExit
```

Expected: PASS.

### Task 2: Include Runtime Health in Readiness Gates

**Files:**
- Modify: `server/src/module/saas/saas-route-consistency.spec.ts`
- Modify: `server/package.json`
- Modify: `server/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `GET /api/saas/platform/runtime-health`
- Produces: route/permission/readiness coverage for the new runtime health API

- [ ] **Step 1: Extend route consistency expectations**

Modify `server/src/module/saas/saas-route-consistency.spec.ts` by adding this assertion inside `keeps SaaS controller permissions backed by seeded menu permissions`:

```typescript
expect(findRoutePermissions(routePermissions, 'GET', '/api/saas/platform/runtime-health')).toEqual(['saas:usage:index']);
```

- [ ] **Step 2: Run route consistency to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd test -- saas-route-consistency.spec.ts --runInBand --forceExit
```

Expected: PASS because the new route reuses already seeded `saas:usage:index`.

- [ ] **Step 3: Add the service spec to backend readiness**

In `server/package.json`, append `saas-runtime-health.service.spec.ts` to `verify:saas-readiness`.

In `server/scripts/verify-saas-readiness-command.ts`, append `saas-runtime-health.service.spec.ts` to `expectedSuites`.

In `docs/saas-launch-readiness-checklist.md`, add `saas-runtime-health.service.spec.ts` to the expanded backend gate and add this manual admin flow item:

```markdown
10. Open or call `GET /api/saas/platform/runtime-health` and confirm dependencies, required env keys, payment config, and operational switches render without exposing secret values.
```

- [ ] **Step 4: Run backend command verifier**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

### Task 3: Full P11 Verification and Commit

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: Task 1 and Task 2 changes.
- Produces: local commit if all gates pass.

- [ ] **Step 1: Run focused P11 tests**

Run:

```powershell
cd server
pnpm.cmd test -- saas-runtime-health.service.spec.ts saas-platform.controller.spec.ts saas-route-consistency.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 2: Run backend SaaS readiness**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 3: Run root repository readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: PASS.

- [ ] **Step 4: Review diff and whitespace**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-08-p11-saas-runtime-health-readiness.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/saas-route-consistency.spec.ts server/src/module/saas/saas.module.ts server/src/module/saas/services/saas-runtime-health.service.ts server/src/module/saas/services/saas-runtime-health.service.spec.ts
```

Expected: no whitespace errors; diff limited to P11 runtime health readiness.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p11-saas-runtime-health-readiness.md docs/saas-launch-readiness-checklist.md server/package.json server/scripts/verify-saas-readiness-command.ts server/src/module/saas/saas-platform.controller.ts server/src/module/saas/saas-platform.controller.spec.ts server/src/module/saas/saas-route-consistency.spec.ts server/src/module/saas/saas.module.ts server/src/module/saas/services/saas-runtime-health.service.ts server/src/module/saas/services/saas-runtime-health.service.spec.ts
git commit -m "feat: add saas runtime health readiness"
```

## Self-Review

- Spec coverage: The plan covers sanitized runtime diagnostics, platform-admin API exposure, dependency snapshots, required config checks, payment status, route permission coverage, readiness gate inclusion, and checklist documentation.
- Placeholder scan: No placeholders remain.
- Type consistency: `SaasRuntimeHealthService.getPlatformRuntimeHealth()` is used consistently by the controller and tests.
- Scope check: This P deliberately avoids frontend UI and public health changes; a future P can add a platform UI panel once the backend contract is stable.
