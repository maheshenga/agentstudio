import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Like, Repository } from 'typeorm';

import { SaveSaasModuleDto } from '../dto/save-saas-module.dto';
import { SaasModuleEntity } from '../entities/saas-module.entity';
import { SaasPlanFeatureEntity } from '../entities/saas-plan-feature.entity';
import { SaasPlanEntity } from '../entities/saas-plan.entity';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';

export interface SaasModuleListQuery {
  keyword?: string;
  status?: string | number;
}

@Injectable()
export class SaasModuleService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SaasModuleEntity)
    private readonly moduleRepo: Repository<SaasModuleEntity>,
    @InjectRepository(SaasPlanEntity)
    private readonly planRepo: Repository<SaasPlanEntity>,
    @InjectRepository(SaasPlanFeatureEntity)
    private readonly planFeatureRepo: Repository<SaasPlanFeatureEntity>,
    @InjectRepository(SaasSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SaasSubscriptionEntity>,
  ) {}

  async listPlatformModules(query: SaasModuleListQuery = {}) {
    const baseWhere: Record<string, unknown> = { deleteTime: IsNull() };
    if (query.status !== undefined && query.status !== '') {
      baseWhere.status = Number(query.status);
    }

    const where = query.keyword
      ? [
          { ...baseWhere, code: Like(`%${query.keyword}%`) },
          { ...baseWhere, name: Like(`%${query.keyword}%`) },
        ]
      : baseWhere;

    const modules = await this.moduleRepo.find({
      where,
      order: { sort: 'ASC', id: 'ASC' },
    });

    return modules.map((module) => this.toResponse(module));
  }

  async createPlatformModule(dto: SaveSaasModuleDto) {
    const code = dto.code?.trim();
    if (!code) {
      throw new BadRequestException('Module code is required');
    }

    const existing = await this.moduleRepo.findOne({ where: { code }, withDeleted: true });
    if (existing) {
      throw new BadRequestException(`Module ${code} already exists`);
    }

    const module = this.moduleRepo.create({
      code,
      name: dto.name,
      description: dto.description || '',
      category: dto.category || '',
      icon: dto.icon || '',
      routePath: dto.route_path || '',
      status: dto.status ?? 1,
      sort: dto.sort ?? 100,
      remark: dto.remark || '',
    });

    return this.toResponse(await this.moduleRepo.save(module));
  }

  async updatePlatformModule(code: string, dto: SaveSaasModuleDto) {
    const module = await this.findActiveModule(code);

    if (dto.name !== undefined) module.name = dto.name;
    if (dto.description !== undefined) module.description = dto.description;
    if (dto.category !== undefined) module.category = dto.category;
    if (dto.icon !== undefined) module.icon = dto.icon;
    if (dto.route_path !== undefined) module.routePath = dto.route_path;
    if (dto.status !== undefined) module.status = Number(dto.status);
    if (dto.sort !== undefined) module.sort = Number(dto.sort);
    if (dto.remark !== undefined) module.remark = dto.remark;

    return this.toResponse(await this.moduleRepo.save(module));
  }

  async updatePlatformModuleStatus(code: string, status: number) {
    const module = await this.findActiveModule(code);
    module.status = Number(status);
    return this.toResponse(await this.moduleRepo.save(module));
  }

  async updatePlanModules(planCode: string, moduleCodes: string[] = []) {
    const plan = await this.planRepo.findOne({
      where: { code: planCode, deleteTime: IsNull() },
    });
    if (!plan) {
      throw new NotFoundException(`Plan ${planCode} not found`);
    }

    const uniqueCodes = [...new Set((moduleCodes || []).filter(Boolean))];
    const modules = uniqueCodes.length
      ? await this.moduleRepo.find({
          where: { code: In(uniqueCodes), status: 1, deleteTime: IsNull() },
          order: { sort: 'ASC', id: 'ASC' },
        })
      : [];

    const foundCodes = new Set(modules.map((module) => module.code));
    const missingCodes = uniqueCodes.filter((code) => !foundCodes.has(code));
    if (missingCodes.length) {
      throw new BadRequestException(`Unknown or disabled module: ${missingCodes.join(', ')}`);
    }

    await this.dataSource.transaction(async (manager) => {
      const planFeatureRepo = manager.getRepository(SaasPlanFeatureEntity);
      await planFeatureRepo.delete({ planId: plan.id });
      if (modules.length) {
        await planFeatureRepo.save(modules.map((module) => ({ planId: plan.id, featureKey: module.code, enabled: 1 })));
      }
    });

    return { code: plan.code, module_codes: modules.map((module) => module.code) };
  }

  async listTenantModules(tenantId: number) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { tenantId, status: 'active', deleteTime: IsNull() },
      order: { id: 'DESC' },
    });
    if (!subscription) return [];

    const features = await this.planFeatureRepo.find({
      where: { planId: subscription.planId, enabled: 1, deleteTime: IsNull() },
      order: { id: 'ASC' },
    });
    const moduleCodes = features.map((feature) => feature.featureKey);
    if (!moduleCodes.length) return [];

    const modules = await this.moduleRepo.find({
      where: { code: In(moduleCodes), status: 1, deleteTime: IsNull() },
      order: { sort: 'ASC', id: 'ASC' },
    });

    return modules.map((module) => this.toResponse(module));
  }

  async assertTenantModuleEnabled(tenantId: number, moduleCode: string) {
    const modules = await this.listTenantModules(tenantId);
    if (!modules.some((module) => module.code === moduleCode)) {
      throw new BadRequestException('Current plan has not enabled this module');
    }
    return true;
  }

  private async findActiveModule(code: string) {
    const module = await this.moduleRepo.findOne({ where: { code, deleteTime: IsNull() } });
    if (!module) {
      throw new NotFoundException(`Module ${code} not found`);
    }
    return module;
  }

  private toResponse(module: Partial<SaasModuleEntity>) {
    return {
      id: module.id,
      code: module.code,
      name: module.name,
      description: module.description || '',
      category: module.category || '',
      icon: module.icon || '',
      route_path: module.routePath || '',
      status: Number(module.status) || 0,
      sort: Number(module.sort) || 0,
      remark: module.remark,
      create_time: module.createTime,
      update_time: module.updateTime,
    };
  }
}
