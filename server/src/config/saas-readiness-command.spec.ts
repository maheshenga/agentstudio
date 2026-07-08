import { readFileSync } from 'fs';
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
    expect(command).toContain('--forceExit');
  });
});
