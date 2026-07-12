import { getMetadataArgsStorage } from 'typeorm';

import { AppCapabilityGrantEntity } from './app-capability-grant.entity';
import { AppRuntimeAuditLogEntity } from './app-runtime-audit-log.entity';
import { AppRuntimeSessionEntity } from './app-runtime-session.entity';
import { AppRuntimeKvEntity } from './app-runtime-kv.entity';
import { AppStorageObjectEntity } from './app-storage-object.entity';

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

  it('isolates KV rows by tenant, app, namespace, and key', () => {
    expect(indexNames(AppRuntimeKvEntity)).toEqual(
      expect.arrayContaining(['uk_app_runtime_kv_scope', 'idx_app_runtime_kv_expiry']),
    );
    expect(columnNames(AppRuntimeKvEntity)).toEqual(
      expect.arrayContaining([
        'tenant_id',
        'app_id',
        'namespace',
        'key',
        'value',
        'size_byte',
        'version',
        'expires_time',
      ]),
    );
  });

  it('stores only opaque object metadata without a public URL or runtime token', () => {
    expect(indexNames(AppStorageObjectEntity)).toEqual(
      expect.arrayContaining(['uk_app_storage_object_id', 'idx_app_storage_object_scope']),
    );
    const columns = columnNames(AppStorageObjectEntity);
    expect(columns).toEqual(
      expect.arrayContaining([
        'object_id',
        'tenant_id',
        'app_id',
        'owner_user_id',
        'storage_key',
        'mime_type',
        'size_byte',
        'checksum',
        'status',
        'expires_time',
      ]),
    );
    expect(columns).not.toEqual(expect.arrayContaining(['token', 'token_hash', 'url']));
  });
});
