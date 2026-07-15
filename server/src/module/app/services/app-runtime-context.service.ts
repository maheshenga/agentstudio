import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';

import { TenantEntity } from '../../system/tenant/entities/tenant.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';

export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const;
export const APP_RUNTIME_CONTEXT_SCOPE = 'runtime:context:read' as const;

export type AppRuntimeScope = typeof APP_RUNTIME_CONTEXT_SCOPE;

export interface AppRuntimeContext {
  tenant: { id: string; name: string };
  user: { id: string; display_name: string };
  app: { code: string; name: string; version: string };
}

export interface AppRuntimeBootstrap {
  protocol_version: typeof APP_RUNTIME_PROTOCOL_VERSION;
  scopes: AppRuntimeScope[];
  context: AppRuntimeContext | null;
}

@Injectable()
export class AppRuntimeContextService {
  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysUserTenantEntity)
    private readonly membershipRepo: Repository<SysUserTenantEntity>,
    @InjectRepository(AppPackageEntity)
    private readonly appRepo?: Repository<AppPackageEntity>,
    @InjectRepository(AppPackageVersionEntity)
    private readonly versionRepo?: Repository<AppPackageVersionEntity>,
  ) {}

  async buildBootstrap(input: {
    tenantId: number;
    userId?: number;
    app: AppPackageEntity;
    version: AppPackageVersionEntity | null;
  }): Promise<AppRuntimeBootstrap | null> {
    if (!['static', 'iframe'].includes(input.app.type)) return null;

    const scopes = this.resolveScopes(input.version?.manifest);
    const unavailable: AppRuntimeBootstrap = {
      protocol_version: APP_RUNTIME_PROTOCOL_VERSION,
      scopes,
      context: null,
    };

    if (scopes.length === 0 || !input.version || !input.userId) return unavailable;

    const version = input.version;
    const userId = input.userId;

    try {
      const [tenant, user, membership] = await Promise.all([
        this.tenantRepo.findOne({
          where: { id: input.tenantId, status: 1, deleteTime: IsNull() },
          select: { id: true, tenantName: true },
        }),
        this.userRepo.findOne({
          where: { id: userId, status: 1, deleteTime: IsNull() },
          select: { id: true, realname: true },
        }),
        this.membershipRepo.findOne({
          where: { tenantId: input.tenantId, userId, deleteTime: IsNull() },
          select: { id: true },
        }),
      ]);

      if (!tenant || !user || !membership) return unavailable;

      return {
        protocol_version: APP_RUNTIME_PROTOCOL_VERSION,
        scopes,
        context: {
          tenant: { id: String(tenant.id), name: String(tenant.tenantName || '') },
          user: { id: String(user.id), display_name: String(user.realname || '') },
          app: {
            code: String(input.app.code || ''),
            name: String(input.app.name || ''),
            version: String(version.version || ''),
          },
        },
      };
    } catch {
      return unavailable;
    }
  }

  async buildAuthorizedContext(input: { tenantId: number; userId: number; appId: number; versionId: number }) {
    if (!this.appRepo || !this.versionRepo) return null;
    const [app, version] = await Promise.all([
      this.appRepo.findOne({
        where: {
          id: input.appId,
          type: In(['static', 'iframe']),
          status: 'published',
          deleteTime: IsNull(),
        },
      }),
      this.versionRepo.findOne({
        where: {
          id: input.versionId,
          appId: input.appId,
          reviewStatus: 'approved',
          publishStatus: 'published',
          deleteTime: IsNull(),
        },
      }),
    ]);
    if (!app || !version) return null;
    const bootstrap = await this.buildBootstrap({
      tenantId: input.tenantId,
      userId: input.userId,
      app,
      version,
    });
    return bootstrap?.context || null;
  }

  private resolveScopes(manifest?: Record<string, unknown> | null): AppRuntimeScope[] {
    const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
    return permissions.includes(APP_RUNTIME_CONTEXT_SCOPE) ? [APP_RUNTIME_CONTEXT_SCOPE] : [];
  }
}
