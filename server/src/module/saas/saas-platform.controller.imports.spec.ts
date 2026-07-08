import { readFileSync } from 'fs';
import { join } from 'path';

describe('SaasPlatformController imports', () => {
  it('uses type-only imports for query interfaces so Bun can start the server', () => {
    const source = readFileSync(join(__dirname, 'saas-platform.controller.ts'), 'utf8');
    const platformServiceImports = source
      .split(/\r?\n/)
      .filter((line) => line.includes("from './services/saas-platform.service'"));

    expect(source).toContain("import { SaasPlatformService } from './services/saas-platform.service';");
    expect(platformServiceImports).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^import type .*SaasPlatformListQuery.*from '\.\/services\/saas-platform\.service';$/),
        expect.stringMatching(/^import type .*SaasPaymentNotifyLogListQuery.*from '\.\/services\/saas-platform\.service';$/),
      ]),
    );
    expect(source).toContain("import { SaasRevenueReportService } from './services/saas-revenue-report.service';");
    expect(source).toContain('private readonly revenueReportService: SaasRevenueReportService');
    expect(platformServiceImports).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^import (?!type).*SaasPlatformListQuery/),
        expect.stringMatching(/^import (?!type).*SaasPaymentNotifyLogListQuery/),
      ]),
    );
  });
});
