import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

import { normalizeAppCapabilities } from '../app-runtime.constants';
import {
  type AppDeveloperRiskLevel,
  type AppDeveloperRuntimeType,
  AppDeveloperProfileEntity,
} from '../entities/app-developer-profile.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppPackageEntity } from '../entities/app-package.entity';

export interface FrozenAppReviewSnapshot {
  schema_version: 1;
  app: {
    id: string;
    code: string;
    name: string;
    type: 'service';
    runtime_type: 'service';
    trust_level: 'developer_restricted';
    category: string;
    summary: string;
    description: string;
    developer_id: string;
    developer_name: string;
  };
  version: {
    id: string;
    version: string;
    manifest: Record<string, unknown>;
    package_sha256: string;
    entry_sha256: string;
    file_size: number;
    requested_capabilities: string[];
    service_targets: string[];
    scan: {
      passed: boolean;
      scanned_files: number;
      findings: Array<{
        code: string;
        severity: string;
        line?: number;
        column?: number;
      }>;
    };
  };
  developer: {
    profile_id: string;
    certification_status: 'certified';
    approved_runtime_types: AppDeveloperRuntimeType[];
    risk_level: AppDeveloperRiskLevel;
    certification_expiry: string;
  };
  submitted_at: string;
}

@Injectable()
export class AppReviewSnapshotService {
  create(
    app: AppPackageEntity,
    version: AppPackageVersionEntity,
    profile: AppDeveloperProfileEntity,
  ): FrozenAppReviewSnapshot {
    if (
      app.type !== 'service' ||
      app.runtimeType !== 'service' ||
      app.trustLevel !== 'developer_restricted'
    ) {
      throw new BadRequestException('Frozen review snapshots require a restricted service app');
    }
    if (
      profile.certificationStatus !== 'certified' ||
      profile.disabled === 1 ||
      !profile.certificationExpiry ||
      profile.certificationExpiry.getTime() <= Date.now() ||
      !profile.approvedRuntimeTypes.includes('service')
    ) {
      throw new BadRequestException('Developer service certification is not active');
    }

    const scan = this.sanitizeScanResult(version.scanResult);
    const submittedAt = version.submittedTime || new Date();
    return {
      schema_version: 1,
      app: {
        id: String(app.id),
        code: app.code,
        name: app.name,
        type: 'service',
        runtime_type: 'service',
        trust_level: 'developer_restricted',
        category: app.category || '',
        summary: app.summary || '',
        description: app.description || '',
        developer_id: String(app.developerId || ''),
        developer_name: app.developerName || '',
      },
      version: {
        id: String(version.id),
        version: version.version,
        manifest: this.canonicalize(version.manifest || {}) as Record<string, unknown>,
        package_sha256: version.fileHash,
        entry_sha256: scan.entrySha256,
        file_size: Math.max(0, Math.trunc(Number(version.fileSize) || 0)),
        requested_capabilities: normalizeAppCapabilities(version.manifest),
        service_targets: [...(version.serviceTargets || [])],
        scan: {
          passed: scan.passed,
          scanned_files: scan.scannedFiles,
          findings: scan.findings,
        },
      },
      developer: {
        profile_id: String(profile.id),
        certification_status: 'certified',
        approved_runtime_types: [...profile.approvedRuntimeTypes],
        risk_level: profile.riskLevel,
        certification_expiry: profile.certificationExpiry.toISOString(),
      },
      submitted_at: submittedAt.toISOString(),
    };
  }

  hash(snapshot: unknown) {
    return createHash('sha256')
      .update(JSON.stringify(this.canonicalize(snapshot)), 'utf8')
      .digest('hex');
  }

  verify(
    version: Pick<
      AppPackageVersionEntity,
      | 'id'
      | 'version'
      | 'manifest'
      | 'fileHash'
      | 'fileSize'
      | 'serviceTargets'
      | 'scanResult'
      | 'reviewSnapshot'
      | 'reviewSnapshotHash'
    >,
  ) {
    const storedHash = String(version.reviewSnapshotHash || '');
    if (!version.reviewSnapshot || !/^[a-f0-9]{64}$/.test(storedHash)) {
      this.throwIntegrityFailure();
    }
    const computedHash = this.hash(version.reviewSnapshot);
    if (!timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(computedHash, 'hex'))) {
      this.throwIntegrityFailure();
    }

    const snapshot = version.reviewSnapshot as Record<string, unknown>;
    const frozenVersion = snapshot.version;
    if (!frozenVersion || typeof frozenVersion !== 'object' || Array.isArray(frozenVersion)) {
      this.throwIntegrityFailure();
    }
    const scan = this.sanitizeScanResult(version.scanResult);
    const currentEvidence = {
      id: String(version.id),
      version: version.version,
      manifest: this.canonicalize(version.manifest || {}),
      package_sha256: version.fileHash,
      entry_sha256: scan.entrySha256,
      file_size: Math.max(0, Math.trunc(Number(version.fileSize) || 0)),
      requested_capabilities: normalizeAppCapabilities(version.manifest),
      service_targets: [...(version.serviceTargets || [])],
      scan: {
        passed: scan.passed,
        scanned_files: scan.scannedFiles,
        findings: scan.findings,
      },
    };
    if (this.hash(frozenVersion) !== this.hash(currentEvidence)) {
      this.throwIntegrityFailure();
    }
  }

  sanitizeScanResult(value: Record<string, unknown> | null | undefined) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { passed: false, findings: [], scannedFiles: 0, entrySha256: '' };
    }
    const findings = Array.isArray(value.findings)
      ? value.findings
          .filter(
            (finding): finding is Record<string, unknown> =>
              Boolean(finding) && typeof finding === 'object' && !Array.isArray(finding),
          )
          .slice(0, 50)
          .map((finding) => ({
            code: String(finding.code || '').slice(0, 80),
            severity: finding.severity === 'warning' ? 'warning' : 'error',
            ...(Number.isInteger(Number(finding.line))
              ? { line: Math.max(1, Number(finding.line)) }
              : {}),
            ...(Number.isInteger(Number(finding.column))
              ? { column: Math.max(0, Number(finding.column)) }
              : {}),
          }))
      : [];
    const entrySha256 = String(value.entrySha256 || '');
    return {
      passed: value.passed === true,
      findings,
      scannedFiles: Math.max(0, Math.trunc(Number(value.scannedFiles) || 0)),
      entrySha256: /^[a-f0-9]{64}$/.test(entrySha256) ? entrySha256 : '',
    };
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined) result[key] = this.canonicalize(item);
        return result;
      }, {});
  }

  private throwIntegrityFailure(): never {
    throw new BadRequestException('Frozen review content integrity check failed');
  }
}
