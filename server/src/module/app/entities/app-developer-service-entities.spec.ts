import { getMetadataArgsStorage } from 'typeorm';

import { AppDeveloperProfileEntity } from './app-developer-profile.entity';
import { AppPackageVersionEntity } from './app-package-version.entity';
import { AppServiceInvocationEntity } from './app-service-invocation.entity';
import { AppServiceInstanceEntity } from './app-service-instance.entity';

describe('Certified developer service entities', () => {
  const indexNames = (target: Function) =>
    getMetadataArgsStorage()
      .indices.filter((item) => item.target === target)
      .map((item) => item.name);

  const columnNames = (target: Function) =>
    getMetadataArgsStorage()
      .columns.filter((item) => item.target === target)
      .map((item) => String(item.options.name || item.propertyName));

  it('stores one governed certification profile per user', () => {
    expect(indexNames(AppDeveloperProfileEntity)).toEqual(
      expect.arrayContaining([
        'uk_app_developer_profile_user',
        'idx_app_developer_profile_status',
      ]),
    );
    expect(columnNames(AppDeveloperProfileEntity)).toEqual(
      expect.arrayContaining([
        'user_id',
        'display_name',
        'website',
        'application_statement',
        'certification_status',
        'requested_runtime_types',
        'approved_runtime_types',
        'risk_level',
        'reviewer_id',
        'review_message',
        'certification_time',
        'certification_expiry',
        'disabled',
      ]),
    );
  });

  it('stores payload-free invocation outcomes with bounded query indexes', () => {
    expect(indexNames(AppServiceInvocationEntity)).toEqual(
      expect.arrayContaining([
        'idx_app_service_invocation_tenant_app_time',
        'idx_app_service_invocation_developer_time',
      ]),
    );
    const columns = columnNames(AppServiceInvocationEntity);
    expect(columns).toEqual(
      expect.arrayContaining([
        'tenant_id',
        'caller_app_id',
        'caller_version_id',
        'target_app_id',
        'target_version_id',
        'developer_id',
        'outcome',
        'status_code',
        'duration_ms',
        'error_code',
        'create_time',
      ]),
    );
    expect(columns).not.toEqual(
      expect.arrayContaining([
        'request_body',
        'response_body',
        'headers',
        'token',
        'cookie',
        'error_message',
      ]),
    );
  });

  it('stores immutable submission and independent candidate review metadata', () => {
    expect(columnNames(AppPackageVersionEntity)).toEqual(
      expect.arrayContaining([
        'review_snapshot',
        'review_snapshot_hash',
        'submitted_time',
        'service_targets',
        'candidate_reviewed_by',
        'candidate_reviewed_time',
      ]),
    );
  });

  it('stores bounded circuit and invocation state on service instances', () => {
    const columns = columnNames(AppServiceInstanceEntity);
    expect(columns).toEqual(
      expect.arrayContaining([
        'runtime_driver',
        'consecutive_failures',
        'circuit_state',
        'circuit_open_until',
        'active_invocations',
        'last_invoke_time',
        'last_success_time',
      ]),
    );
    expect(columns).not.toEqual(
      expect.arrayContaining(['request_body', 'response_body', 'runtime_context']),
    );
  });

  it('defaults historical service instances to the PM2 runtime driver', () => {
    const column = getMetadataArgsStorage().columns.find(
      (item) => item.target === AppServiceInstanceEntity && item.propertyName === 'runtimeDriver',
    );

    expect(column?.options).toEqual(
      expect.objectContaining({
        name: 'runtime_driver',
        type: 'varchar',
        length: 20,
        default: 'pm2',
      }),
    );
  });

  it('keeps the runtime driver status index aligned with the migration', () => {
    const index = getMetadataArgsStorage().indices.find(
      (item) =>
        item.target === AppServiceInstanceEntity &&
        item.name === 'idx_app_service_instance_driver_status',
    );

    expect(index?.columns).toEqual(['runtimeDriver', 'processStatus']);
  });
});
