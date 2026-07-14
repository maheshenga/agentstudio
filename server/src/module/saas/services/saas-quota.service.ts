import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { SAAS_QUOTA_AI_CALLS, SAAS_QUOTA_TOKENS } from '../constants';
import { SaasPlanQuotaEntity } from '../entities/saas-plan-quota.entity';
import { SaasQuotaLedgerEntity } from '../entities/saas-quota-ledger.entity';
import { SaasQuotaReservationEntity } from '../entities/saas-quota-reservation.entity';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';

export interface SaasQuotaLedgerOptions {
  changeType?: string;
  sourceType?: string;
  sourceId?: string;
  remark?: string;
  message?: string;
}

export interface SaasQuotaLedgerListQuery {
  page?: string | number;
  limit?: string | number;
  resource_type?: string;
  change_type?: string;
}

export interface SaasQuotaLedgerPlatformListQuery extends SaasQuotaLedgerListQuery {
  tenant_id?: string | number;
  source_type?: string;
  source_id?: string;
}

@Injectable()
export class SaasQuotaService {
  constructor(
    @InjectRepository(SaasPlanQuotaEntity)
    private readonly saasPlanQuotaRepo: Repository<SaasPlanQuotaEntity>,
    @InjectRepository(SaasTenantResourceEntity)
    private readonly saasTenantResourceRepo: Repository<SaasTenantResourceEntity>,
    @InjectRepository(SaasQuotaLedgerEntity)
    private readonly saasQuotaLedgerRepo: Repository<SaasQuotaLedgerEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async initializeTenantQuota(tenantId: number, planId: number, manager?: EntityManager): Promise<void> {
    const planQuotaRepo = this.resolvePlanQuotaRepo(manager);
    const tenantResourceRepo = this.resolveTenantResourceRepo(manager);

    const planQuotas = await planQuotaRepo.find({
      where: {
        planId,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });

    if (planQuotas.length === 0) {
      return;
    }

    const resources: Array<Partial<SaasTenantResourceEntity>> = [];
    for (const item of planQuotas) {
      const existing = await tenantResourceRepo.findOne({
        where: { tenantId, resourceType: item.quotaType },
      });
      resources.push({
        ...(existing || {}),
        tenantId,
        resourceType: item.quotaType,
        totalQuota: Number(item.totalQuota),
        usedQuota: existing ? Number(existing.usedQuota) || 0 : 0,
        status: 1,
      });
    }

    await tenantResourceRepo.save(resources);
  }

  async getTenantUsageSummary(tenantId: number): Promise<Array<{ resource_type: string; quota: number; used: number; remaining: number }>> {
    const resources = await this.saasTenantResourceRepo.find({
      where: {
        tenantId,
        status: 1,
      },
      order: {
        id: 'ASC',
      },
    });

    const hasUserQuota = resources.some((item) => item.resourceType === 'users');
    const activeUsers = hasUserQuota
      ? await this.dataSource.getRepository(SysUserTenantEntity).count({
          where: { tenantId, status: 1, deleteTime: IsNull() },
        })
      : 0;

    return resources.map((item) => {
      const used = item.resourceType === 'users' ? activeUsers : Number(item.usedQuota);
      return {
        resource_type: item.resourceType,
        quota: Number(item.totalQuota),
        used,
        remaining: Math.max(Number(item.totalQuota) - used, 0),
      };
    });
  }

  async listTenantQuotaLedgers(tenantId: number, query: SaasQuotaLedgerListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasQuotaLedgerEntity> = { tenantId };
    if (query.resource_type) where.resourceType = query.resource_type;
    if (query.change_type) where.changeType = query.change_type;

    const [list, total] = await this.saasQuotaLedgerRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return {
      list: list.map((item) => this.toLedgerResponse(item)),
      total,
      page,
      limit,
    };
  }

  async listPlatformQuotaLedgers(query: SaasQuotaLedgerPlatformListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasQuotaLedgerEntity> = {};
    const tenantId = this.resolveTenantId(query.tenant_id);
    if (tenantId !== undefined) where.tenantId = tenantId;
    if (query.resource_type) where.resourceType = query.resource_type;
    if (query.change_type) where.changeType = query.change_type;
    if (query.source_type) where.sourceType = query.source_type;
    if (query.source_id) where.sourceId = query.source_id;

    const [list, total] = await this.saasQuotaLedgerRepo.findAndCount({
      where,
      order: { createTime: 'DESC', id: 'DESC' },
      skip,
      take: limit,
    });

    return {
      list: list.map((item) => this.toLedgerResponse(item)),
      total,
      page,
      limit,
    };
  }

  async assertTenantQuotaAvailable(
    tenantId: number,
    resourceType: string,
    amount: number,
    message = '资源额度不足',
  ): Promise<void> {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    if (normalizedAmount <= 0) {
      return;
    }
    if (!tenantId) {
      throw new BadRequestException('缺少租户上下文');
    }

    const resource = await this.saasTenantResourceRepo.findOne({
      where: {
        tenantId,
        resourceType,
        status: 1,
      },
    });

    if (!resource) {
      throw new BadRequestException(message);
    }

    const totalQuota = Number(resource.totalQuota);
    if (totalQuota <= 0) {
      return;
    }

    const usedQuota = Number(resource.usedQuota);
    if (totalQuota - usedQuota < normalizedAmount) {
      throw new BadRequestException(message);
    }
  }

  async consumeTenantQuota(
    tenantId: number,
    resourceType: string,
    amount: number,
    options: SaasQuotaLedgerOptions = {},
    manager?: EntityManager,
  ): Promise<void> {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    if (normalizedAmount <= 0) {
      return;
    }
    if (!tenantId) {
      throw new BadRequestException('缺少租户上下文');
    }

    const tenantResourceRepo = this.resolveTenantResourceRepo(manager);
    const updateResult = await tenantResourceRepo
      .createQueryBuilder()
      .update(SaasTenantResourceEntity)
      .set({ usedQuota: () => 'used_quota + :amount' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('resource_type = :resourceType', { resourceType })
      .andWhere('status = 1')
      .andWhere('(total_quota <= 0 OR total_quota - used_quota >= :amount)')
      .setParameters({ amount: normalizedAmount })
      .execute();

    if ((updateResult.affected ?? 0) <= 0) {
      throw new BadRequestException(options.message || '资源额度不足');
    }

    const resource = await tenantResourceRepo.findOne({
      where: {
        tenantId,
        resourceType,
        status: 1,
      },
    });
    await this.writeLedger(
      tenantId,
      resourceType,
      options.changeType || 'consume',
      0,
      normalizedAmount,
      Number(resource?.totalQuota || 0),
      Number(resource?.usedQuota || 0),
      options,
      manager,
    );
  }

  async grantTenantQuota(
    tenantId: number,
    resourceType: string,
    amount: number,
    options: SaasQuotaLedgerOptions = {},
    manager?: EntityManager,
  ): Promise<void> {
    const normalizedAmount = Math.max(Number(amount || 0), 0);
    if (normalizedAmount <= 0) {
      return;
    }
    if (!tenantId) {
      throw new BadRequestException('缺少租户上下文');
    }

    const tenantResourceRepo = this.resolveTenantResourceRepo(manager);
    const updateResult = await tenantResourceRepo
      .createQueryBuilder()
      .update(SaasTenantResourceEntity)
      .set({
        totalQuota: () => 'total_quota + :amount',
        status: 1,
      })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('resource_type = :resourceType', { resourceType })
      .setParameters({ amount: normalizedAmount })
      .execute();

    if ((updateResult.affected ?? 0) <= 0) {
      await tenantResourceRepo.save({
        tenantId,
        resourceType,
        totalQuota: normalizedAmount,
        usedQuota: 0,
        status: 1,
      });
    }

    const resource = await tenantResourceRepo.findOne({
      where: {
        tenantId,
        resourceType,
      },
    });
    await this.writeLedger(
      tenantId,
      resourceType,
      'grant',
      normalizedAmount,
      0,
      Number(resource?.totalQuota || normalizedAmount),
      Number(resource?.usedQuota || 0),
      options,
      manager,
    );
  }

  async consumeAiUsage(tenantId: number, usage: { totalTokens?: number }): Promise<void> {
    const totalTokens = Math.max(Number(usage.totalTokens || 0), 0);

    await this.dataSource.transaction(async (manager) => {
      await this.consumeTenantQuota(
        tenantId,
        SAAS_QUOTA_AI_CALLS,
        1,
        { message: 'AI 调用次数额度不足', sourceType: 'ai_chat', remark: 'AI chat completed' },
        manager,
      );
      await this.consumeTenantQuota(
        tenantId,
        SAAS_QUOTA_TOKENS,
        totalTokens,
        { message: 'Token 额度不足', sourceType: 'ai_chat', remark: 'AI chat completed' },
        manager,
      );
    });
  }

  async reserveAiUsage(
    tenantId: number,
    input: { estimatedTokens: number; sourceId: string },
  ): Promise<{ id: string; reservedTokens: number }> {
    const reservedTokens = Math.max(Math.ceil(Number(input.estimatedTokens) || 0), 1);
    const reservationId = randomUUID();

    return this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(SaasQuotaReservationEntity);
      const reservation = reservationRepo.create({
        id: reservationId,
        tenantId,
        sourceType: 'ai_chat',
        sourceId: String(input.sourceId || reservationId),
        status: 'pending',
        reservedCalls: 1,
        reservedTokens,
        actualTokens: 0,
      });
      await reservationRepo.save(reservation);

      await this.consumeTenantQuota(
        tenantId,
        SAAS_QUOTA_AI_CALLS,
        1,
        {
          changeType: 'reserve',
          message: 'AI 调用次数额度不足',
          sourceType: 'ai_chat_reservation',
          sourceId: reservationId,
          remark: 'AI call reserved',
        },
        manager,
      );
      await this.consumeTenantQuota(
        tenantId,
        SAAS_QUOTA_TOKENS,
        reservedTokens,
        {
          changeType: 'reserve',
          message: 'Token 额度不足',
          sourceType: 'ai_chat_reservation',
          sourceId: reservationId,
          remark: 'AI tokens reserved',
        },
        manager,
      );

      return { id: reservationId, reservedTokens };
    });
  }

  async finalizeAiUsage(reservationId: string, actualTokens: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(SaasQuotaReservationEntity);
      const reservation = await reservationRepo.findOne({
        where: { id: reservationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reservation || reservation.status !== 'pending') return;

      const normalizedActual = Math.max(Math.ceil(Number(actualTokens) || 0), 0);
      const tokenDelta = normalizedActual - Number(reservation.reservedTokens || 0);
      if (tokenDelta > 0) {
        await this.consumeTenantQuota(
          reservation.tenantId,
          SAAS_QUOTA_TOKENS,
          tokenDelta,
          {
            changeType: 'finalize',
            message: 'Token 额度不足',
            sourceType: 'ai_chat_reservation',
            sourceId: reservation.id,
            remark: 'AI token reservation exceeded',
          },
          manager,
        );
      } else if (tokenDelta < 0) {
        await this.releaseTenantQuotaUsage(
          reservation.tenantId,
          SAAS_QUOTA_TOKENS,
          Math.abs(tokenDelta),
          {
            changeType: 'release',
            sourceType: 'ai_chat_reservation',
            sourceId: reservation.id,
            remark: 'Unused AI tokens released',
          },
          manager,
        );
      }

      reservation.status = 'finalized';
      reservation.actualTokens = normalizedActual;
      await reservationRepo.save(reservation);
    });
  }

  async releaseAiUsage(reservationId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const reservationRepo = manager.getRepository(SaasQuotaReservationEntity);
      const reservation = await reservationRepo.findOne({
        where: { id: reservationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!reservation || reservation.status !== 'pending') return;

      const options = {
        changeType: 'release',
        sourceType: 'ai_chat_reservation',
        sourceId: reservation.id,
        remark: 'Failed AI reservation released',
      };
      await this.releaseTenantQuotaUsage(
        reservation.tenantId,
        SAAS_QUOTA_AI_CALLS,
        Number(reservation.reservedCalls || 0),
        options,
        manager,
      );
      await this.releaseTenantQuotaUsage(
        reservation.tenantId,
        SAAS_QUOTA_TOKENS,
        Number(reservation.reservedTokens || 0),
        options,
        manager,
      );

      reservation.status = 'released';
      await reservationRepo.save(reservation);
    });
  }

  private async releaseTenantQuotaUsage(
    tenantId: number,
    resourceType: string,
    amount: number,
    options: SaasQuotaLedgerOptions,
    manager: EntityManager,
  ): Promise<void> {
    const normalizedAmount = Math.max(Math.ceil(Number(amount) || 0), 0);
    if (normalizedAmount <= 0) return;

    const tenantResourceRepo = this.resolveTenantResourceRepo(manager);
    const updateResult = await tenantResourceRepo
      .createQueryBuilder()
      .update(SaasTenantResourceEntity)
      .set({ usedQuota: () => 'GREATEST(used_quota - :amount, 0)' })
      .where('tenant_id = :tenantId', { tenantId })
      .andWhere('resource_type = :resourceType', { resourceType })
      .andWhere('status = 1')
      .setParameters({ amount: normalizedAmount })
      .execute();
    if ((updateResult.affected ?? 0) <= 0) {
      throw new BadRequestException('Quota reservation resource is unavailable');
    }

    const resource = await tenantResourceRepo.findOne({ where: { tenantId, resourceType, status: 1 } });
    await this.writeLedger(
      tenantId,
      resourceType,
      options.changeType || 'release',
      0,
      -normalizedAmount,
      Number(resource?.totalQuota || 0),
      Number(resource?.usedQuota || 0),
      options,
      manager,
    );
  }

  private resolvePlanQuotaRepo(manager?: EntityManager) {
    return manager ? manager.getRepository(SaasPlanQuotaEntity) : this.saasPlanQuotaRepo;
  }

  private resolveTenantResourceRepo(manager?: EntityManager) {
    return manager ? manager.getRepository(SaasTenantResourceEntity) : this.saasTenantResourceRepo;
  }

  private resolveQuotaLedgerRepo(manager?: EntityManager) {
    return manager ? manager.getRepository(SaasQuotaLedgerEntity) : this.saasQuotaLedgerRepo;
  }

  private resolvePagination(query: SaasQuotaLedgerListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return { page, limit, skip: (page - 1) * limit };
  }

  private resolveTenantId(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const tenantId = Number(value);
    return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : undefined;
  }

  private toLedgerResponse(item: Partial<SaasQuotaLedgerEntity>) {
    return {
      id: item.id,
      tenant_id: item.tenantId,
      resource_type: item.resourceType,
      change_type: item.changeType,
      quota_delta: Number(item.quotaDelta) || 0,
      used_delta: Number(item.usedDelta) || 0,
      balance_total_quota: Number(item.balanceTotalQuota) || 0,
      balance_used_quota: Number(item.balanceUsedQuota) || 0,
      source_type: item.sourceType,
      source_id: item.sourceId,
      remark: item.remark,
      create_time: item.createTime,
    };
  }

  private async writeLedger(
    tenantId: number,
    resourceType: string,
    changeType: string,
    quotaDelta: number,
    usedDelta: number,
    balanceTotalQuota: number,
    balanceUsedQuota: number,
    options: SaasQuotaLedgerOptions,
    manager?: EntityManager,
  ) {
    const ledgerRepo = this.resolveQuotaLedgerRepo(manager);
    await ledgerRepo.save(
      ledgerRepo.create({
        tenantId,
        resourceType,
        changeType,
        quotaDelta,
        usedDelta,
        balanceTotalQuota,
        balanceUsedQuota,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        remark: options.remark,
      }),
    );
  }
}
