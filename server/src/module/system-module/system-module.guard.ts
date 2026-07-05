import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/constant';
import { SystemModuleAccessService } from './services/system-module-access.service';

type SystemModuleRouteBinding = {
  prefix: string;
  moduleCode: string;
  tenantScoped: boolean;
};

const ROUTE_BINDINGS: SystemModuleRouteBinding[] = [
  { prefix: '/api/saas/platform', moduleCode: 'saas_platform', tenantScoped: false },
  { prefix: '/api/saas/tenant', moduleCode: 'tenant_saas', tenantScoped: true },
  { prefix: '/api/ai', moduleCode: 'ai_console', tenantScoped: true },
  { prefix: '/api/taixu', moduleCode: 'taixu_workspace', tenantScoped: true },
];

@Injectable()
export class SystemModuleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessService: SystemModuleAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const binding = this.matchBinding(request.path || request.route?.path || '');
    if (!binding) {
      return true;
    }

    const user = request.user || {};
    const tenantId = binding.tenantScoped ? this.resolveTenantId(user) : undefined;
    if (binding.tenantScoped && tenantId === undefined) {
      throw new BadRequestException('Tenant context is required for this module');
    }

    await this.accessService.assertModuleAccess({
      moduleCode: binding.moduleCode,
      tenantId,
      userId: this.resolveUserId(user),
    });
    return true;
  }

  private matchBinding(path: string): SystemModuleRouteBinding | undefined {
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const apiIndex = normalizedPath.indexOf('/api/');
    if (apiIndex > 0) {
      normalizedPath = normalizedPath.slice(apiIndex);
    }
    return ROUTE_BINDINGS.find((binding) => normalizedPath.startsWith(binding.prefix));
  }

  private resolveTenantId(user: Record<string, any>): number | undefined {
    const value = user.tenantId ?? user.user?.tenantId;
    const tenantId = Number(value);
    return Number.isFinite(tenantId) && tenantId > 0 ? tenantId : undefined;
  }

  private resolveUserId(user: Record<string, any>): number | undefined {
    const value = user.userId ?? user.user?.id;
    const userId = Number(value);
    return Number.isFinite(userId) && userId > 0 ? userId : undefined;
  }
}
