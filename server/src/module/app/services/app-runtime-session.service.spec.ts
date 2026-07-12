import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { AppPackageEntity } from '../entities/app-package.entity';
import { AppPackageVersionEntity } from '../entities/app-package-version.entity';
import { AppRuntimeAuditLogEntity } from '../entities/app-runtime-audit-log.entity';
import { AppRuntimeSessionEntity } from '../entities/app-runtime-session.entity';
import { TenantAppInstallEntity } from '../entities/tenant-app-install.entity';
import { AppCapabilityPolicyService } from './app-capability-policy.service';
import { AppRuntimeSessionService } from './app-runtime-session.service';

describe('AppRuntimeSessionService', () => {
  const sessionRepo = {
    create: jest.fn((value) => ({ ...value })),
    findOne: jest.fn(),
    save: jest.fn(async (value) => ({ id: value.id ?? 41, ...value })),
    update: jest.fn(),
  };
  const auditRepo = {
    create: jest.fn((value) => ({ ...value })),
    save: jest.fn(async (value) => value),
  };
  const installRepo = { findOne: jest.fn() };
  const appRepo = { findOne: jest.fn() };
  const versionRepo = { findOne: jest.fn() };
  const membershipRepo = { findOne: jest.fn() };
  const capabilityPolicy = { resolveGrantedCapabilities: jest.fn() };

  let service: AppRuntimeSessionService;

  const issueInput = {
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['context.read'] as const,
  };

  const activeSession = () => ({
    id: 41,
    tokenHash: 'a'.repeat(64),
    tenantId: 23,
    userId: 91,
    appId: 10,
    versionId: 20,
    installId: 30,
    capabilities: ['context.read'],
    expiresTime: new Date(Date.now() + 120_000),
    revokedTime: null,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.APP_RUNTIME_CAPABILITIES_ENABLED = 'true';
    delete process.env.APP_RUNTIME_SESSION_TTL_SECONDS;
    installRepo.findOne.mockResolvedValue({
      id: 30,
      tenantId: 23,
      appId: 10,
      versionId: 20,
      enabled: 1,
    });
    appRepo.findOne.mockResolvedValue({ id: 10, status: 'published' });
    versionRepo.findOne.mockResolvedValue({
      id: 20,
      appId: 10,
      reviewStatus: 'approved',
      publishStatus: 'published',
    });
    membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });
    capabilityPolicy.resolveGrantedCapabilities.mockResolvedValue(['context.read']);

    const module = await Test.createTestingModule({
      providers: [
        AppRuntimeSessionService,
        { provide: getRepositoryToken(AppRuntimeSessionEntity), useValue: sessionRepo },
        { provide: getRepositoryToken(AppRuntimeAuditLogEntity), useValue: auditRepo },
        { provide: getRepositoryToken(TenantAppInstallEntity), useValue: installRepo },
        { provide: getRepositoryToken(AppPackageEntity), useValue: appRepo },
        { provide: getRepositoryToken(AppPackageVersionEntity), useValue: versionRepo },
        { provide: getRepositoryToken(SysUserTenantEntity), useValue: membershipRepo },
        { provide: AppCapabilityPolicyService, useValue: capabilityPolicy },
      ],
    }).compile();
    service = module.get(AppRuntimeSessionService);
  });

  afterEach(() => {
    delete process.env.APP_RUNTIME_CAPABILITIES_ENABLED;
    delete process.env.APP_RUNTIME_SESSION_TTL_SECONDS;
  });

  it('issues a one-time raw token while persisting only its digest', async () => {
    const result = await service.issue({ ...issueInput, capabilities: ['context.read'] });
    const saved = sessionRepo.save.mock.calls[0][0];

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.capabilities).toEqual(['context.read']);
    expect(saved.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(saved)).not.toContain(result.token);
    expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(installRepo.findOne).toHaveBeenCalledWith({
      where: {
        id: 30,
        tenantId: 23,
        appId: 10,
        versionId: 20,
        enabled: 1,
        deleteTime: IsNull(),
      },
    });
  });

  it('refuses to issue a session when any authority binding is inactive', async () => {
    membershipRepo.findOne.mockResolvedValue(null);
    await expect(service.issue({ ...issueInput, capabilities: ['context.read'] })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('refuses to issue capabilities outside the current platform and tenant grants', async () => {
    capabilityPolicy.resolveGrantedCapabilities.mockResolvedValue([]);
    await expect(service.issue({ ...issueInput, capabilities: ['context.read'] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('clamps configured session TTL to the supported bounds', async () => {
    process.env.APP_RUNTIME_SESSION_TTL_SECONDS = '9999';
    const result = await service.issue({ ...issueInput, capabilities: ['context.read'] });
    const ttl = new Date(result.expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(890_000);
    expect(ttl).toBeLessThanOrEqual(900_000);
  });

  it('fails closed when runtime capabilities are disabled', async () => {
    process.env.APP_RUNTIME_CAPABILITIES_ENABLED = 'false';
    await expect(service.issue({ ...issueInput, capabilities: ['context.read'] })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it('authorizes a valid session and updates last use with bounded audit metadata', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());

    await expect(
      service.authorize('raw-runtime-token', 'context.read', {
        requestId: 'req-1',
        ip: '127.0.0.1',
        userAgent: 'jest',
      }),
    ).resolves.toMatchObject({ tenantId: 23, userId: 91, appId: 10, versionId: 20 });

    expect(sessionRepo.update).toHaveBeenCalledWith(41, { lastUsedTime: expect.any(Date) });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'allowed', reasonCode: 'authorized', requestId: 'req-1' }),
    );
    expect(JSON.stringify(auditRepo.create.mock.calls)).not.toContain('raw-runtime-token');
  });

  it.each([
    ['unknown token', null, 'unknown_token'],
    ['expired token', { ...activeSession(), expiresTime: new Date(Date.now() - 1) }, 'expired'],
    ['revoked token', { ...activeSession(), revokedTime: new Date() }, 'revoked'],
  ])('rejects an %s', async (_label, session, reasonCode) => {
    sessionRepo.findOne.mockResolvedValue(session);

    await expect(service.authorize('invalid-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(auditRepo.create).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'denied', reasonCode }));
  });

  it('rejects capabilities missing from the session snapshot', async () => {
    sessionRepo.findOne.mockResolvedValue({ ...activeSession(), capabilities: [] });
    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'capability_missing' }),
    );
  });

  it('rejects sessions after installation, publication, membership, or consent is lost', async () => {
    sessionRepo.findOne.mockResolvedValue(activeSession());
    membershipRepo.findOne.mockResolvedValue(null);

    await expect(service.authorize('raw-runtime-token', 'context.read', {})).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(membershipRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 23, userId: 91, deleteTime: IsNull() },
      select: { id: true },
    });
    expect(auditRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'denied', reasonCode: 'membership_inactive' }),
    );
  });

  it('revokes all active sessions bound to an installation or version', async () => {
    sessionRepo.update.mockResolvedValue({ affected: 2 });
    await expect(service.revokeInstall(23, 30, 'uninstalled')).resolves.toBe(2);
    await expect(service.revokeVersion(20, 'unpublished')).resolves.toBe(2);
    expect(sessionRepo.update).toHaveBeenNthCalledWith(
      1,
      { tenantId: 23, installId: 30, revokedTime: IsNull() },
      { revokedTime: expect.any(Date), revokeReason: 'uninstalled' },
    );
  });
});
