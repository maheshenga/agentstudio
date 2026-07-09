import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../../..');

const REQUIRED_BACKEND_SAAS_READINESS_SPECS = [
  'saas-main-flow.integration.spec.ts',
  'saas-route-consistency.spec.ts',
  'saas-route-prefix.spec.ts',
  'saas-tenant.controller.spec.ts',
  'saas-platform.controller.spec.ts',
  'saas-platform.controller.imports.spec.ts',
  'saas-platform.service.spec.ts',
  'saas-payment.controller.spec.ts',
  'saas-payment.service.spec.ts',
  'saas-payment-config.service.spec.ts',
  'create-saas-payment-notify-logs.spec.ts',
  'create-saas-payment-configs.spec.ts',
  'align-saas-payment-config-menu.spec.ts',
  'create-tenant-member.dto.spec.ts',
  'saas-tenant-member.service.spec.ts',
  'align-saas-tenant-member-menu.spec.ts',
  'saas-visible-text-encoding.spec.ts',
  'saas-resource-pack.service.spec.ts',
  'saas-resource-pack-order.service.spec.ts',
  'save-saas-resource-pack.dto.spec.ts',
  'align-saas-resource-pack-crud-permissions.spec.ts',
  'saas-order.service.spec.ts',
  'saas-order-risk.service.spec.ts',
  'add-saas-order-close-metadata.spec.ts',
  'add-saas-order-payment-requested-at.spec.ts',
  'saas-plan.service.spec.ts',
  'saas-quota.service.spec.ts',
  'saas-module.service.spec.ts',
  'align-saas-module-routes.spec.ts',
  'saas-subscription-lifecycle.service.spec.ts',
  'enforce-single-active-saas-subscription.spec.ts',
  'saas-revenue-report.service.spec.ts',
  'align-saas-revenue-report-menu.spec.ts',
  'signup.dto.spec.ts',
  'saas-env-contract.spec.ts',
  'saas-runtime-health.service.spec.ts',
  'safe-url.util.spec.ts',
  'ai-admin.service.spec.ts',
  'taixu-document.service.spec.ts',
  'auth-rate-limit.config.spec.ts',
  'auth.strategy.spec.ts',
  'user.service.spec.ts',
  'main.service.permissions.spec.ts',
  'menu.service.spec.ts',
  'built-in-modules.spec.ts',
  'system-module-access.service.spec.ts',
  'system-module-registry.service.spec.ts',
  'system-module.guard.spec.ts',
  'system-module-platform.controller.spec.ts',
  'system-module-tenant.controller.spec.ts',
  'system-module-route-consistency.spec.ts',
  'database-init-bootstrap-security.spec.ts',
  'database-init-sanitization.spec.ts',
  'verify-db-init-script.spec.ts',
  'seed-saas-foundation-data.spec.ts',
  'seed-saas-modules.spec.ts',
  'seed-system-modules.spec.ts',
  'create-saas-modules.spec.ts',
  'create-system-modules.spec.ts',
  'create-system-module-saas-bridge.spec.ts',
  'create-saas-orders-and-plan-prices.spec.ts',
  'create-saas-quota-ledger.spec.ts',
  'create-saas-resource-pack-orders.spec.ts',
  'align-saas-plan-operations-menu.spec.ts',
  'align-saas-platform-permissions.spec.ts',
  'align-saas-resource-pack-catalog.spec.ts',
  'align-saas-resource-pack-order-menu.spec.ts',
  'align-tenant-resource-pack-role-grants-and-labels.spec.ts',
  'align-tenant-system-module-role-grants.spec.ts',
  'widen-log-username-columns.spec.ts',
  'configuration.spec.ts',
  'ai-admin.controller.spec.ts',
  'openai-stream.util.spec.ts',
  'chat.service.spec.ts',
  'llm-provider.service.spec.ts',
  'taixu-llm-runtime.service.spec.ts',
  'taixu-model.service.spec.ts',
  'upload.service.spec.ts',
  'task.service.spec.ts',
  'log-username-length.spec.ts',
  'saas-provisioning.service.spec.ts',
] as const;

describe('SaaS backend readiness command', () => {
  it('runs all high-value SaaS regression specs', () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'server/package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    const command = packageJson.scripts?.['verify:saas-readiness'] || '';

    for (const spec of REQUIRED_BACKEND_SAAS_READINESS_SPECS) {
      expect(command).toContain(spec);
    }

    expect(command).toContain('--runInBand');
    expect(command).not.toContain('--forceExit');

    const [jestCommand, specPatternSegment] = command.split(' -- ');
    expect(jestCommand).toContain('--runInBand');
    expect(jestCommand).not.toContain('--forceExit');
    expect(specPatternSegment).not.toContain('--runInBand');
    expect(specPatternSegment).not.toContain('--forceExit');

    const liveE2eScript = join(REPO_ROOT, 'server/scripts/verify-saas-live-e2e.ts');
    expect(existsSync(liveE2eScript)).toBe(true);
    expect(packageJson.scripts?.['verify:saas-live-e2e']).toBe('tsx scripts/verify-saas-live-e2e.ts');

    const checklist = readFileSync(join(REPO_ROOT, 'docs/saas-launch-readiness-checklist.md'), 'utf8');
    expect(checklist).toContain('pnpm.cmd run verify:saas-live-e2e');
    expect(checklist).toContain('SAAS_LIVE_E2E_BASE_URL');
    expect(checklist).toContain('SAAS_LIVE_E2E_USERNAME');
    expect(checklist).toContain('SAAS_LIVE_E2E_PASSWORD');
    expect(checklist).toContain('SAAS_LIVE_E2E_RUN_PAYMENT=1');
  });
});
