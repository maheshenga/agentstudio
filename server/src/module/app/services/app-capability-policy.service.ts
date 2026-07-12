import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import {
  type AppRuntimeCapability,
  normalizeApprovedCapabilities,
} from '../app-runtime.constants';
import { AppCapabilityGrantEntity } from '../entities/app-capability-grant.entity';

type GrantRepository = Pick<Repository<AppCapabilityGrantEntity>, 'create' | 'delete' | 'find' | 'save'>;

interface PlatformCapabilityInput {
  appId: number;
  versionId: number;
  requestedCapabilities: AppRuntimeCapability[];
  approvedCapabilities: string[];
  operatorId?: number;
}

interface TenantCapabilityInput {
  tenantId: number;
  appId: number;
  versionId: number;
  capabilities: string[];
  operatorId?: number;
}

@Injectable()
export class AppCapabilityPolicyService {
  constructor(
    @InjectRepository(AppCapabilityGrantEntity)
    private readonly grantRepo: Repository<AppCapabilityGrantEntity>,
  ) {}

  async approvePlatformCapabilities(input: PlatformCapabilityInput, repository: GrantRepository = this.grantRepo) {
    const requested = [...new Set(input.requestedCapabilities)].sort();
    const approved = normalizeApprovedCapabilities(input.approvedCapabilities);
    this.assertSubset(approved, requested, 'Platform approval');

    await repository.delete({
      versionId: input.versionId,
      subjectType: 'platform',
      subjectId: 0,
    });
    if (!requested.length) return [];

    const approvedSet = new Set(approved);
    const grantedTime = new Date();
    const rows = requested.map((capability) =>
      repository.create({
        appId: input.appId,
        versionId: input.versionId,
        subjectType: 'platform',
        subjectId: 0,
        capability,
        status: approvedSet.has(capability) ? 'approved' : 'denied',
        operatorId: input.operatorId ?? null,
        grantedTime,
        revokedTime: null,
      }),
    );
    await repository.save(rows);
    return approved;
  }

  async setTenantCapabilities(input: TenantCapabilityInput, repository: GrantRepository = this.grantRepo) {
    const requested = normalizeApprovedCapabilities(input.capabilities);
    const platformRows = await repository.find({
      where: {
        versionId: input.versionId,
        subjectType: 'platform',
        subjectId: 0,
        status: 'approved',
      },
    });
    const platformApproved = platformRows.map((row) => row.capability as AppRuntimeCapability).sort();
    this.assertSubset(requested, platformApproved, 'Tenant consent');

    await repository.delete({
      versionId: input.versionId,
      subjectType: 'tenant',
      subjectId: input.tenantId,
    });
    if (!requested.length) return [];

    const grantedTime = new Date();
    const rows = requested.map((capability) =>
      repository.create({
        appId: input.appId,
        versionId: input.versionId,
        subjectType: 'tenant',
        subjectId: input.tenantId,
        capability,
        status: 'approved',
        operatorId: input.operatorId ?? null,
        grantedTime,
        revokedTime: null,
      }),
    );
    await repository.save(rows);
    return requested;
  }

  async resolveGrantedCapabilities(
    tenantId: number,
    versionId: number,
    repository: GrantRepository = this.grantRepo,
  ): Promise<AppRuntimeCapability[]> {
    const [platformRows, tenantRows] = await Promise.all([
      repository.find({
        where: { versionId, subjectType: 'platform', subjectId: 0, status: 'approved' },
      }),
      repository.find({
        where: { versionId, subjectType: 'tenant', subjectId: tenantId, status: 'approved' },
      }),
    ]);
    const tenantApproved = new Set(tenantRows.map((row) => row.capability));
    return platformRows
      .map((row) => row.capability as AppRuntimeCapability)
      .filter((capability) => tenantApproved.has(capability))
      .sort();
  }

  async getCapabilityState(
    tenantId: number,
    versionId: number,
    requestedCapabilities: AppRuntimeCapability[],
    repository: GrantRepository = this.grantRepo,
  ) {
    const [platformRows, tenantRows] = await Promise.all([
      repository.find({
        where: { versionId, subjectType: 'platform', subjectId: 0, status: 'approved' },
      }),
      repository.find({
        where: { versionId, subjectType: 'tenant', subjectId: tenantId, status: 'approved' },
      }),
    ]);
    const platformApproved = platformRows.map((row) => row.capability as AppRuntimeCapability).sort();
    const tenantApproved = tenantRows.map((row) => row.capability as AppRuntimeCapability).sort();
    const tenantSet = new Set(tenantApproved);
    return {
      requested: [...new Set(requestedCapabilities)].sort(),
      platform_approved: platformApproved,
      tenant_approved: tenantApproved,
      effective: platformApproved.filter((capability) => tenantSet.has(capability)),
    };
  }

  private assertSubset(values: AppRuntimeCapability[], allowed: AppRuntimeCapability[], label: string) {
    const allowedSet = new Set(allowed);
    const denied = values.find((value) => !allowedSet.has(value));
    if (denied) {
      throw new BadRequestException(`${label} cannot include ${denied}`);
    }
  }
}
