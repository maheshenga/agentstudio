import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource } from 'typeorm';

import { TenantEntity } from '../../system/tenant/entities/tenant.entity';
import { SysRoleEntity } from '../../system/role/entities/role.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { SysUserRoleEntity } from '../../system/user/entities/user-width-role.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import {
  SAAS_DEFAULT_TRIAL_DAYS,
  SAAS_SUBSCRIPTION_ACTIVE,
  SAAS_SUBSCRIPTION_TRIALING,
} from '../constants';
import { SaasSubscriptionEntity } from '../entities/saas-subscription.entity';
import { SaasTrialEntity } from '../entities/saas-trial.entity';
import { TenantProvisionDto } from '../dto/tenant-provision.dto';
import { SaasSignupDto } from '../dto/signup.dto';
import { SaasPlanService } from './saas-plan.service';
import { SaasQuotaService } from './saas-quota.service';

type ProvisioningResult = { userId: number; tenantId: number };

@Injectable()
export class SaasProvisioningService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly saasPlanService: SaasPlanService,
    private readonly saasQuotaService: SaasQuotaService,
  ) {}

  async signup(dto: SaasSignupDto): Promise<ProvisioningResult> {
    return this.provisionTenant({
      tenantName: dto.tenant_name,
      tenantCode: undefined,
      username: dto.username,
      password: dto.password,
      realname: dto.realname,
      phone: dto.phone,
      email: dto.email,
      tenantRemark: this.buildSignupRemark(dto),
      withTrial: true,
    });
  }

  async createTenantFromPlatform(dto: TenantProvisionDto): Promise<ProvisioningResult> {
    return this.provisionTenant({
      tenantName: dto.tenant_name,
      tenantCode: dto.tenant_code,
      username: dto.owner_username,
      password: dto.owner_password,
      realname: dto.owner_realname,
      withTrial: dto.with_trial ?? true,
    });
  }

  private async provisionTenant(input: {
    tenantName: string;
    tenantCode?: string;
    username: string;
    password: string;
    realname?: string;
    phone?: string;
    email?: string;
    tenantRemark?: string;
    withTrial: boolean;
  }): Promise<ProvisioningResult> {
    const freePlan = await this.saasPlanService.getFreePlan();
    const hashedPassword = bcrypt.hashSync(input.password, bcrypt.genSaltSync(10));

    const result = await this.dataSource.transaction<ProvisioningResult>(async (manager) => {
      const user = await manager.save(
        UserEntity,
        manager.create(UserEntity, {
          username: input.username,
          password: hashedPassword,
          realname: input.realname || input.username,
          phone: input.phone || '',
          email: input.email || '',
          status: 1,
          dashboard: 'work',
          remark: '',
        }),
      );

      const tenant = await manager.save(
        TenantEntity,
        manager.create(TenantEntity, {
          tenantName: input.tenantName,
          tenantCode: input.tenantCode || this.generateTenantCode(input.tenantName),
          contactName: input.realname || input.username,
          contactPhone: input.phone || '',
          contactEmail: input.email || '',
          status: 1,
          maxUsers: 0,
          maxDepts: 0,
          maxRoles: 0,
          remark: input.tenantRemark || '',
        }),
      );

      await manager.save(
        SysUserTenantEntity,
        manager.create(SysUserTenantEntity, {
          userId: user.id,
          tenantId: tenant.id,
          isDefault: 1,
          isSuper: 0,
        }),
      );

      const roles = await this.createDefaultRoles(manager, tenant.id);
      const ownerRole = roles[0];

      await manager.save(
        SysUserRoleEntity,
        manager.create(SysUserRoleEntity, {
          userId: user.id,
          roleId: ownerRole.id,
          tenantId: tenant.id,
          status: 1,
        }),
      );

      const subscription = await manager.save(
        SaasSubscriptionEntity,
        manager.create(SaasSubscriptionEntity, {
          tenantId: tenant.id,
          planId: freePlan.id,
          billingCycle: freePlan.billingCycle || 'monthly',
          status: SAAS_SUBSCRIPTION_ACTIVE,
          startTime: new Date(),
          endTime: null,
          cancelAtPeriodEnd: 0,
          remark: 'Initial free plan subscription',
        }),
      );

      if (input.withTrial) {
        const trialStartTime = new Date();
        const trialEndTime = new Date(trialStartTime.getTime() + SAAS_DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);

        await manager.save(
          SaasTrialEntity,
          manager.create(SaasTrialEntity, {
            tenantId: tenant.id,
            subscriptionId: subscription.id,
            status: SAAS_SUBSCRIPTION_TRIALING,
            startTime: trialStartTime,
            endTime: trialEndTime,
            remark: 'Initial tenant trial',
          }),
        );
      }

      return {
        userId: user.id,
        tenantId: tenant.id,
      };
    });

    await this.saasQuotaService.initializeTenantQuota(result.tenantId, freePlan.id);
    return result;
  }

  private async createDefaultRoles(manager: DataSource['manager'], tenantId: number): Promise<SysRoleEntity[]> {
    const roleDefinitions = [
      { name: 'Owner', code: `tenant:${tenantId}:owner`, sort: 1 },
      { name: 'Admin', code: `tenant:${tenantId}:admin`, sort: 2 },
      { name: 'Member', code: `tenant:${tenantId}:member`, sort: 3 },
    ];

    const roles: SysRoleEntity[] = [];
    for (const roleDefinition of roleDefinitions) {
      const role = await manager.save(
        SysRoleEntity,
        manager.create(SysRoleEntity, {
          parentId: 0,
          name: roleDefinition.name,
          code: roleDefinition.code,
          level: 1,
          dataScope: 1,
          remark: '',
          sort: roleDefinition.sort,
          tenantId,
          status: 1,
        }),
      );
      roles.push(role);
    }

    return roles;
  }

  private generateTenantCode(tenantName: string): string {
    const prefix = (tenantName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12);

    return `${prefix || 'tenant'}-${Date.now()}`;
  }

  private buildSignupRemark(dto: SaasSignupDto): string {
    const parts = [dto.industry ? `industry:${dto.industry}` : '', dto.team_size ? `team_size:${dto.team_size}` : ''].filter(Boolean);
    return parts.join(';');
  }
}
