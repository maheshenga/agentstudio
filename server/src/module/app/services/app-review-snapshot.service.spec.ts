import { AppDeveloperProfileEntity } from '../entities/app-developer-profile.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppReviewSnapshotService } from './app-review-snapshot.service';

describe('AppReviewSnapshotService', () => {
  const service = new AppReviewSnapshotService();
  const app = {
    id: 9,
    code: 'workflow_service',
    name: 'Workflow Service',
    type: 'service',
    runtimeType: 'service',
    trustLevel: 'developer_restricted',
    category: 'Automation',
    summary: 'Runs approved workflows',
    description: 'Tenant-scoped workflow execution.',
    developerId: 17,
    developerName: 'Alice',
  } as AppPackageEntity;
  const profile = {
    id: 5,
    userId: 17,
    certificationStatus: 'certified',
    approvedRuntimeTypes: ['service', 'static'],
    riskLevel: 'low',
    certificationExpiry: new Date('2030-01-01T00:00:00.000Z'),
    disabled: 0,
  } as AppDeveloperProfileEntity;
  const version = {
    id: 12,
    appId: 9,
    version: '1.0.0',
    manifest: {
      manifestVersion: 2,
      code: 'workflow_service',
      version: '1.0.0',
      runtime: 'service',
      entry: 'dist/index.js',
      capabilities: ['context.read', 'service.invoke'],
      serviceTargets: ['reporting_service'],
    },
    fileHash: 'a'.repeat(64),
    fileSize: 1024,
    serviceTargets: ['reporting_service'],
    scanResult: {
      passed: true,
      scannedFiles: 1,
      entrySha256: 'b'.repeat(64),
      findings: [
        {
          code: 'warning_only',
          severity: 'warning',
          line: 3,
          column: 4,
          snippet: 'process.env.SECRET',
        },
      ],
      source: 'raw uploaded source',
    },
    packagePath: '/runtime/workflow_service/1.0.0',
    submittedTime: new Date('2026-07-13T08:00:00.000Z'),
  } as unknown as AppPackageVersionEntity;

  it('freezes only sanitized service review content', () => {
    const snapshot = service.create(app, version, profile);

    expect(snapshot).toEqual({
      schema_version: 1,
      app: {
        id: '9',
        code: 'workflow_service',
        name: 'Workflow Service',
        type: 'service',
        runtime_type: 'service',
        trust_level: 'developer_restricted',
        category: 'Automation',
        summary: 'Runs approved workflows',
        description: 'Tenant-scoped workflow execution.',
        developer_id: '17',
        developer_name: 'Alice',
      },
      version: {
        id: '12',
        version: '1.0.0',
        manifest: version.manifest,
        package_sha256: 'a'.repeat(64),
        entry_sha256: 'b'.repeat(64),
        file_size: 1024,
        requested_capabilities: ['context.read', 'service.invoke'],
        service_targets: ['reporting_service'],
        scan: {
          passed: true,
          scanned_files: 1,
          findings: [
            { code: 'warning_only', severity: 'warning', line: 3, column: 4 },
          ],
        },
      },
      developer: {
        profile_id: '5',
        certification_status: 'certified',
        approved_runtime_types: ['service', 'static'],
        risk_level: 'low',
        certification_expiry: '2030-01-01T00:00:00.000Z',
      },
      submitted_at: '2026-07-13T08:00:00.000Z',
    });
    expect(JSON.stringify(snapshot)).not.toContain('/runtime/');
    expect(JSON.stringify(snapshot)).not.toContain('raw uploaded source');
    expect(JSON.stringify(snapshot)).not.toContain('process.env.SECRET');
  });

  it('produces one SHA-256 hash for semantically identical snapshots', () => {
    const first = service.create(app, version, profile);
    const reordered = {
      submitted_at: first.submitted_at,
      developer: first.developer,
      version: first.version,
      app: first.app,
      schema_version: first.schema_version,
    };

    expect(service.hash(reordered)).toBe(service.hash(first));
    expect(service.hash(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects mutation when the stored snapshot hash no longer matches', () => {
    const snapshot = service.create(app, version, profile);
    const stored = {
      ...version,
      reviewSnapshot: snapshot,
      reviewSnapshotHash: service.hash(snapshot),
    } as unknown as AppPackageVersionEntity;

    expect(() => service.verify(stored)).not.toThrow();
    stored.reviewSnapshot = {
      ...snapshot,
      app: { ...snapshot.app, summary: 'Changed after submission' },
    };
    expect(() => service.verify(stored)).toThrow('Frozen review content integrity check failed');
  });
});
