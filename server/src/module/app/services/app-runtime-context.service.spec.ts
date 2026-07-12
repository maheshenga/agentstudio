import type { Repository } from 'typeorm';

import { TenantEntity } from '../../system/tenant/entities/tenant.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppRuntimeContextService } from './app-runtime-context.service';

describe('AppRuntimeContextService', () => {
  const tenantRepo = { findOne: jest.fn() };
  const userRepo = { findOne: jest.fn() };
  const membershipRepo = { findOne: jest.fn() };

  let service: AppRuntimeContextService;

  const staticApp = {
    id: 10,
    code: 'job_board',
    name: 'Job Board',
    type: 'static',
  } as AppPackageEntity;

  const scopedVersion = {
    id: 20,
    version: '1.2.0',
    manifest: { permissions: ['job:view', 'runtime:context:read'] },
  } as unknown as AppPackageVersionEntity;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AppRuntimeContextService(
      tenantRepo as unknown as Repository<TenantEntity>,
      userRepo as unknown as Repository<UserEntity>,
      membershipRepo as unknown as Repository<SysUserTenantEntity>,
    );
  });

  it('returns allowlisted context for an active scoped static app', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 23, tenantName: 'Acme', status: 1 });
    userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

    await expect(
      service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: {
        tenant: { id: '23', name: 'Acme' },
        user: { id: '91', display_name: 'Owner' },
        app: { code: 'job_board', name: 'Job Board', version: '1.2.0' },
      },
    });
  });

  it('returns an empty bootstrap when the manifest lacks the supported scope', async () => {
    await expect(
      service.buildBootstrap({
        tenantId: 23,
        userId: 91,
        app: staticApp,
        version: {
          ...scopedVersion,
          manifest: { permissions: ['job:view'] },
        } as AppPackageVersionEntity,
      }),
    ).resolves.toEqual({ protocol_version: 1, scopes: [], context: null });
    expect(tenantRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns null for a non-static app', async () => {
    await expect(
      service.buildBootstrap({
        tenantId: 23,
        userId: 91,
        app: { ...staticApp, type: 'iframe' },
        version: scopedVersion,
      }),
    ).resolves.toBeNull();
  });

  it('returns context unavailable when the authenticated user id is missing', async () => {
    await expect(
      service.buildBootstrap({ tenantId: 23, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns context unavailable when the tenant identity is missing', async () => {
    tenantRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

    await expect(
      service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
  });

  it('returns context unavailable when the user identity is missing', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 23, tenantName: 'Acme', status: 1 });
    userRepo.findOne.mockResolvedValue(null);
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

    await expect(
      service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
  });

  it('returns context unavailable when tenant membership is missing', async () => {
    tenantRepo.findOne.mockResolvedValue({ id: 23, tenantName: 'Acme', status: 1 });
    userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
    membershipRepo.findOne.mockResolvedValue(null);

    await expect(
      service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
  });

  it('returns context unavailable when identity lookup fails', async () => {
    tenantRepo.findOne.mockRejectedValue(new Error('database password=do-not-leak'));
    userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

    await expect(
      service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
    ).resolves.toEqual({
      protocol_version: 1,
      scopes: ['runtime:context:read'],
      context: null,
    });
  });

  it('never serializes login, credential, or contact fields', async () => {
    tenantRepo.findOne.mockResolvedValue({
      id: 23,
      tenantName: 'Acme',
      tenantCode: 'acme-secret',
      contactEmail: 'owner@example.com',
      status: 1,
    });
    userRepo.findOne.mockResolvedValue({
      id: 91,
      username: 'owner-login',
      realname: '',
      email: 'owner@example.com',
      phone: '13800000000',
      password: 'secret',
      status: 1,
    });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

    const result = await service.buildBootstrap({
      tenantId: 23,
      userId: 91,
      app: staticApp,
      version: scopedVersion,
    });
    const serialized = JSON.stringify(result);

    expect(result?.context?.user.display_name).toBe('');
    expect(serialized).not.toMatch(/username|tenantCode|email|phone|password|token|authorization/i);
    expect(serialized).not.toContain('owner-login');
    expect(serialized).not.toContain('acme-secret');
    expect(userRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, realname: true } }),
    );
  });

  it('rebuilds sanitized context from an authorized runtime session binding', async () => {
    const appRepo = { findOne: jest.fn().mockResolvedValue(staticApp) };
    const versionRepo = { findOne: jest.fn().mockResolvedValue(scopedVersion) };
    tenantRepo.findOne.mockResolvedValue({ id: 23, tenantName: 'Acme', status: 1 });
    userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });
    service = new AppRuntimeContextService(
      tenantRepo as any,
      userRepo as any,
      membershipRepo as any,
      appRepo as any,
      versionRepo as any,
    );

    await expect(
      service.buildAuthorizedContext({ tenantId: 23, userId: 91, appId: 10, versionId: 20 }),
    ).resolves.toEqual({
      tenant: { id: '23', name: 'Acme' },
      user: { id: '91', display_name: 'Owner' },
      app: { code: 'job_board', name: 'Job Board', version: '1.2.0' },
    });
    expect(appRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 10, status: 'published' }) }),
    );
  });
});
