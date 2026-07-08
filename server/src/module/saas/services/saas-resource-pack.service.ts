import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';

import { SaveSaasResourcePackDto, UpdateSaasResourcePackDto } from '../dto/save-saas-resource-pack.dto';
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

  async createPlatformResourcePack(dto: SaveSaasResourcePackDto) {
    const code = dto.code?.trim();
    if (!code) {
      throw new BadRequestException('Resource pack code is required');
    }
    this.assertResourcePackCode(code);

    const existing = await this.resourcePackRepo.findOne({ where: { code }, withDeleted: true });
    if (existing) {
      throw new BadRequestException(`Resource pack ${code} already exists`);
    }

    const resourcePack = this.resourcePackRepo.create({
      code,
      name: dto.name,
      resourceType: dto.resource_type,
      quotaAmount: Number(dto.quota_amount),
      priceCents: Number(dto.price_cents),
      currency: dto.currency || 'CNY',
      status: dto.status ?? 1,
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });

    return this.toResponse(await this.resourcePackRepo.save(resourcePack));
  }

  async updatePlatformResourcePack(code: string, dto: UpdateSaasResourcePackDto) {
    const resourcePack = await this.findActiveResourcePack(code);

    if (dto.name !== undefined) resourcePack.name = dto.name;
    if (dto.resource_type !== undefined) resourcePack.resourceType = dto.resource_type;
    if (dto.quota_amount !== undefined) resourcePack.quotaAmount = Number(dto.quota_amount);
    if (dto.price_cents !== undefined) resourcePack.priceCents = Number(dto.price_cents);
    if (dto.currency !== undefined) resourcePack.currency = dto.currency || 'CNY';
    if (dto.status !== undefined) resourcePack.status = Number(dto.status);
    if (dto.sort !== undefined) resourcePack.sort = Number(dto.sort);
    if (dto.remark !== undefined) resourcePack.remark = dto.remark;

    return this.toResponse(await this.resourcePackRepo.save(resourcePack));
  }

  async updatePlatformResourcePackStatus(code: string, status: number) {
    const resourcePack = await this.findActiveResourcePack(code);
    resourcePack.status = Number(status);
    return this.toResponse(await this.resourcePackRepo.save(resourcePack));
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

  private async findActiveResourcePack(code: string) {
    const resourcePack = await this.resourcePackRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!resourcePack) {
      throw new NotFoundException(`Resource pack ${code} not found`);
    }
    return resourcePack;
  }

  private assertResourcePackCode(code: string) {
    if (!/^[a-z0-9_-]+$/.test(code)) {
      throw new BadRequestException('Resource pack code must use lowercase letters, numbers, underscore, or hyphen');
    }
  }
}
