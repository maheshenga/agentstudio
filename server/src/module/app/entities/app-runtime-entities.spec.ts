import { getMetadataArgsStorage } from 'typeorm';

import { AppCapabilityGrantEntity } from './app-capability-grant.entity';
import { AppRuntimeAuditLogEntity } from './app-runtime-audit-log.entity';
import { AppRuntimeSessionEntity } from './app-runtime-session.entity';

describe('App runtime authority entities', () => {
  const indexNames = (target: Function) =>
    getMetadataArgsStorage()
      .indices.filter((item) => item.target === target)
      .map((item) => item.name);

  const columnNames = (target: Function) =>
    getMetadataArgsStorage()
      .columns.filter((item) => item.target === target)
      .map((item) => String(item.options.name || item.propertyName));

  it('indexes runtime token digests and expiry cleanup', () => {
    expect(indexNames(AppRuntimeSessionEntity)).toEqual(
      expect.arrayContaining(['uk_app_runtime_session_token', 'idx_app_runtime_session_expiry']),
    );
  });

  it('prevents duplicate grants for the same capability subject', () => {
    expect(indexNames(AppCapabilityGrantEntity)).toContain('uk_app_capability_subject');
  });

  it('never persists a raw token in runtime audit rows', () => {
    expect(columnNames(AppRuntimeAuditLogEntity)).not.toContain('token');
    expect(columnNames(AppRuntimeAuditLogEntity)).not.toContain('token_hash');
  });
});
