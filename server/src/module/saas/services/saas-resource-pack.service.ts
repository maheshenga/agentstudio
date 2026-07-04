import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { SaasResourcePackEntity } from '../entities/saas-resource-pack.entity';

export interface SaasResourcePackListQuery {
  page?: string | number;
  limit?: string | number;
  status?: string | number;
  resource_type?: string;
}

@Injectable()
export class SaasResourcePackService {
  constructor(
    @InjectRepository(SaasResourcePackEntity)
    private readonly resourcePackRepo: Repository<SaasResourcePackEntity>,
  ) {}

  async listPlatformResourcePacks(query: SaasResourcePackListQuery = {}) {
    const { page, limit, skip } = this.resolvePagination(query);
    const where: FindOptionsWhere<SaasResourcePackEntity> = {};

    const status = this.resolveStatus(query.status);
    if (status !== undefined) {
      where.status = status;
    }

    if (query.resource_type) {
      where.resourceType = query.resource_type;
    }

    const [list, total] = await this.resourcePackRepo.findAndCount({
      where,
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
      skip,
      take: limit,
    });

    return {
      list: list.map((item) => this.toResponse(item)),
      total,
      page,
      limit,
    };
  }

  async listTenantResourcePacks() {
    const list = await this.resourcePackRepo.find({
      where: { status: 1 },
      order: { resourceType: 'ASC', sort: 'ASC', id: 'ASC' },
    });

    return list.map((item) => this.toResponse(item));
  }

  private toResponse(item: SaasResourcePackEntity) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      resource_type: item.resourceType,
      quota_amount: Number(item.quotaAmount),
      price_cents: Number(item.priceCents),
      currency: item.currency,
      status: item.status,
      sort: item.sort,
      remark: item.remark,
    };
  }

  private resolvePagination(query: SaasResourcePackListQuery) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit || 20)));

    return {
      page,
      limit,
      skip: (page - 1) * limit,
    };
  }

  private resolveStatus(value: string | number | undefined): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const status = Number(value);
    return Number.isFinite(status) ? status : undefined;
  }
}
