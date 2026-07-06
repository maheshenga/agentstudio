import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../../common/constant';
import { SystemModuleAccessService, type AssertModuleAccessOptions } from './services/system-module-access.service';

type SystemModuleRouteBinding = {
  prefix: string;
  moduleCode: string;
  tenantScoped: boolean;
  requiredSaasModuleCode?: string;
};

const ROUTE_BINDINGS: SystemModuleRouteBinding[] = [
  {
    prefix: '/api/saas/tenant/members',
    moduleCode: 'tenant_saas',
    tenantScoped: true,
    requiredSaasModuleCode: 'member_management',
  },
  {
    prefix: '/api/saas/tenant/resource-pack-orders',
    moduleCode: 'tenant_saas',
    tenantScoped: true,
    requiredSaasModuleCode: 'resource_pack',
  },
  {
    prefix: '/api/saas/tenant/resource-packs',
    moduleCode: 'tenant_saas',
    tenantScoped: true,
    requiredSaasModuleCode: 'resource_pack',
  },
  { prefix: '/api/ai/admin', moduleCode: 'ai_console', tenantScoped: true },
  {
    prefix: '/api/ai/sessions',
    moduleCode: 'ai_console',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/ai/models/options',
    moduleCode: 'ai_console',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/ai/agents/options',
    moduleCode: 'ai_console',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  { prefix: '/api/saas/platform', moduleCode: 'saas_platform', tenantScoped: false },
  { prefix: '/api/saas/tenant', moduleCode: 'tenant_saas', tenantScoped: true },
  { prefix: '/api/ai', moduleCode: 'ai_console', tenantScoped: true },
  {
    prefix: '/llm/chat',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/image/generate',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/agent/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/agentic/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/search/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/topic/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/travel/invoke',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/llm/chat',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/image/generate',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'ai_chat',
  },
  {
    prefix: '/api/taixu/retrieval',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/special',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/program',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/arxiv',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
  {
    prefix: '/api/taixu/document',
    moduleCode: 'taixu_workspace',
    tenantScoped: true,
    requiredSaasModuleCode: 'rag',
  },
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

    const accessOptions: AssertModuleAccessOptions = {
      moduleCode: binding.moduleCode,
      tenantId,
      userId: this.resolveUserId(user),
    };
    if (binding.requiredSaasModuleCode) {
      accessOptions.requiredSaasModuleCode = binding.requiredSaasModuleCode;
    }

    await this.accessService.assertModuleAccess(accessOptions);
    return true;
  }

  private matchBinding(path: string): SystemModuleRouteBinding | undefined {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const candidatePaths = this.buildCandidatePaths(normalizedPath);
    return ROUTE_BINDINGS.filter((binding) =>
      candidatePaths.some((candidatePath) => this.matchesRoutePrefix(candidatePath, binding.prefix)),
    ).sort((left, right) => right.prefix.length - left.prefix.length)[0];
  }

  private buildCandidatePaths(normalizedPath: string): string[] {
    const paths = new Set<string>([normalizedPath]);
    const apiIndex = normalizedPath.indexOf('/api/');
    if (apiIndex > 0) {
      paths.add(normalizedPath.slice(apiIndex));
    }
    const secondSlashIndex = normalizedPath.indexOf('/', 1);
    if (secondSlashIndex > 0) {
      paths.add(normalizedPath.slice(secondSlashIndex));
    }
    return [...paths];
  }

  private matchesRoutePrefix(path: string, prefix: string): boolean {
    return path === prefix || path.startsWith(`${prefix}/`);
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
