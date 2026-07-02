import { PATH_METADATA } from '@nestjs/common/constants';

import { SaasPlatformController } from './saas-platform.controller';
import { SaasPublicController } from './saas-public.controller';
import { SaasTenantController } from './saas-tenant.controller';

describe('SaaS route prefixes', () => {
  it('uses the existing /api controller route convention', () => {
    expect(Reflect.getMetadata(PATH_METADATA, SaasPublicController)).toBe('api/saas');
    expect(Reflect.getMetadata(PATH_METADATA, SaasPlatformController)).toBe('api/saas/platform');
    expect(Reflect.getMetadata(PATH_METADATA, SaasTenantController)).toBe('api/saas/tenant');
  });
});
