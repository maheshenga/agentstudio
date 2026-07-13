import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, EntityManager, In, IsNull } from 'typeorm';

import { SysMenuEntity } from '../../system/menu/entities/menu.entity';
import { TenantEntity } from '../../system/tenant/entities/tenant.entity';
import { SysRoleEntity } from '../../system/role/entities/role.entity';
import { SysRoleMenuEntity } from '../../system/role/entities/role-width-menu.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { SysUserRoleEntity } from '../../system/user/entities/user-width-role.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import {
  SAAS_DEFAULT_TRIAL_DAYS,
  SAAS_PLAN_FREE,
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

const TENANT_BASELINE_MENU_CODES = [
  'TenantSaas',
  'TenantBilling',
  'TenantQuota',
  'TenantResourcePack',
  'TenantMember',
  'TenantSystemModules',
] as const;
const TENANT_OWNER_ADMIN_MENU_CODES = [
  ...TENANT_BASELINE_MENU_CODES,
  'AppCenter',
  'AppMarketplace',
  'AppInstalledApps',
  'AppOpenRunner',
  'AppTenantUsage',
  'AppTenantOrders',
] as const;
const TENANT_MEMBER_MENU_CODES = [
  ...TENANT_BASELINE_MENU_CODES,
  'AppCenter',
  'AppMarketplace',
  'AppInstalledApps',
  'AppOpenRunner',
  'AppTenantOrders',
] as const;
const TENANT_OWNER_ADMIN_PERMISSION_SLUGS = [
  'tenant:billing:view',
  'tenant:billing:upgrade',
  'tenant:quota:view',
  'tenant:resource:buy',
  'tenant:resource-pack:view',
  'tenant:resource-pack-order:create',
  'tenant:resource-pack-order:view',
  'tenant:resource-pack-order:pay',
  'tenant:member:index',
  'tenant:member:create',
  'tenant:member:update',
  'tenant:member:remove',
  'tenant:member:reset-password',
  'tenant:module:list',
  'app:tenant:marketplace',
  'app:tenant:install',
  'app:tenant:open',
  'app:tenant:purchase',
  'app:tenant:orders',
  'app:analytics:tenant',
] as const;
const TENANT_MEMBER_PERMISSION_SLUGS = [
  'tenant:billing:view',
  'tenant:quota:view',
  'tenant:member:index',
  'tenant:module:list',
  'app:tenant:marketplace',
  'app:tenant:open',
  'app:tenant:orders',
] as const;

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
      planCode: SAAS_PLAN_FREE,
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
      planCode: dto.plan_code,
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
    planCode?: string;
  }): Promise<ProvisioningResult> {
    const initialPlan = await this.resolveInitialPlan(input.planCode);
    const hashedPassword = bcrypt.hashSync(input.password, bcrypt.genSaltSync(10));

    try {
      const result = await this.dataSource.transaction<ProvisioningResult>(async (manager) => {
        await this.assertProvisioningInputAvailable(manager, input.username, input.tenantCode);

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
      await this.assignTenantRoleMenus(manager, roles);

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
          planId: initialPlan.id,
          billingCycle: initialPlan.billingCycle || 'monthly',
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

      await this.saasQuotaService.initializeTenantQuota(tenant.id, initialPlan.id, manager);

      return {
        userId: user.id,
        tenantId: tenant.id,
      };
      });
      return result;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (this.isDuplicateKeyError(error)) {
        throw new BadRequestException('登录账号或租户编码已存在，请更换后重试');
      }
      throw error;
    }
  }

  private async assertProvisioningInputAvailable(
    manager: EntityManager,
    username: string,
    tenantCode?: string,
  ): Promise<void> {
    const existingUser = await manager.findOne(UserEntity, {
      where: { username, deleteTime: IsNull() },
      select: { id: true, username: true } as any,
    } as any);
    if (existingUser) {
      throw new BadRequestException('登录账号已存在，请更换账号后重试');
    }

    if (!tenantCode) {
      return;
    }

    const existingTenant = await manager.findOne(TenantEntity, {
      where: { tenantCode, deleteTime: IsNull() },
      select: { id: true, tenantCode: true } as any,
    } as any);
    if (existingTenant) {
      throw new BadRequestException('租户编码已存在，请更换编码后重试');
    }
  }

  private isDuplicateKeyError(error: any): boolean {
    return error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062;
  }

  private async createDefaultRoles(manager: EntityManager, tenantId: number): Promise<SysRoleEntity[]> {
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

  private async assignTenantRoleMenus(manager: EntityManager, roles: SysRoleEntity[]): Promise<void> {
    const menuMap = await this.loadTenantBaselineMenuMap(manager);
    const ownerRole = roles.find((role) => role.code.endsWith(':owner'));
    const adminRole = roles.find((role) => role.code.endsWith(':admin'));
    const memberRole = roles.find((role) => role.code.endsWith(':member'));

    if (!ownerRole || !adminRole || !memberRole) {
      throw new Error('Tenant baseline roles are incomplete');
    }

    await this.insertRoleMenus(
      manager,
      ownerRole.id,
      this.collectMenuIds(menuMap, TENANT_OWNER_ADMIN_MENU_CODES, TENANT_OWNER_ADMIN_PERMISSION_SLUGS),
    );
    await this.insertRoleMenus(
      manager,
      adminRole.id,
      this.collectMenuIds(menuMap, TENANT_OWNER_ADMIN_MENU_CODES, TENANT_OWNER_ADMIN_PERMISSION_SLUGS),
    );
    await this.insertRoleMenus(
      manager,
      memberRole.id,
      this.collectMenuIds(menuMap, TENANT_MEMBER_MENU_CODES, TENANT_MEMBER_PERMISSION_SLUGS),
    );
  }

  private async loadTenantBaselineMenuMap(manager: EntityManager): Promise<Map<string, number>> {
    const menus = await manager.find(SysMenuEntity, {
      where: [
        {
          code: In([...TENANT_OWNER_ADMIN_MENU_CODES]),
          status: 1,
          deleteTime: IsNull(),
        },
        {
          slug: In([...TENANT_OWNER_ADMIN_PERMISSION_SLUGS]),
          status: 1,
          deleteTime: IsNull(),
        },
      ],
    });

    const menuMap = new Map<string, number>();
    for (const menu of menus) {
      if (menu.code) {
        menuMap.set(`code:${menu.code}`, Number(menu.id));
      }
      if (menu.slug) {
        menuMap.set(`slug:${menu.slug}`, Number(menu.id));
      }
    }

    const expectedCount = TENANT_OWNER_ADMIN_MENU_CODES.length + TENANT_OWNER_ADMIN_PERMISSION_SLUGS.length;
    if (menuMap.size < expectedCount) {
      throw new Error('Tenant SaaS menus are not configured');
    }

    return menuMap;
  }

  private collectMenuIds(
    menuMap: Map<string, number>,
    menuCodes: readonly string[],
    permissionSlugs: readonly string[],
  ): number[] {
    return [...menuCodes.map((code) => this.getRequiredMenuId(menuMap, 'code', code)), ...permissionSlugs.map((slug) => this.getRequiredMenuId(menuMap, 'slug', slug))];
  }

  private getRequiredMenuId(menuMap: Map<string, number>, keyType: 'code' | 'slug', value: string): number {
    const menuId = menuMap.get(`${keyType}:${value}`);

    if (!menuId) {
      throw new Error('Tenant SaaS menus are not configured');
    }

    return menuId;
  }

  private async insertRoleMenus(manager: EntityManager, roleId: number, menuIds: number[]): Promise<void> {
    if (!menuIds.length) {
      return;
    }

    await manager.insert(
      SysRoleMenuEntity,
      menuIds.map((menuId) => ({
        roleId,
        menuId,
      })),
    );
  }

  private async resolveInitialPlan(planCode?: string) {
    if (!planCode || planCode === SAAS_PLAN_FREE) {
      return this.saasPlanService.getFreePlan();
    }

    return this.saasPlanService.getPlanByCode(planCode);
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
