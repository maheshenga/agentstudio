jest.mock('uuid', () => ({
  v4: jest.fn(() => 'main-service-test-uuid'),
}));

import { MainService } from './main.service';

describe('MainService permissions', () => {
  it('returns wildcard permissions for super admins without querying all menu slugs', async () => {
    const userService = {
      isSuperAdmin: jest.fn().mockResolvedValue(true),
      getUserPermissions: jest.fn().mockResolvedValue(['*:*:*']),
    };
    const menuService = {
      findMany: jest.fn(() => {
        throw new Error('menu slug lookup should not run for super admins');
      }),
    };

    const service = new MainService(
      {} as any,
      {} as any,
      userService as any,
      menuService as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getPermissions({ user: { userId: 1 } });

    expect(result.code).toBe(200);
    expect(result.data).toEqual(['*:*:*']);
    expect(userService.getUserPermissions).toHaveBeenCalledWith(1);
    expect(menuService.findMany).not.toHaveBeenCalled();
  });
});

describe('MainService auth safety', () => {
  function createService(overrides: { userService?: any; redisService?: any; jwtService?: any } = {}) {
    return new MainService(
      overrides.jwtService || {},
      overrides.redisService || {},
      overrides.userService || {},
      {} as any,
      {} as any,
      {} as any,
      { create: jest.fn() } as any,
      {} as any,
      {} as any,
      { findOne: jest.fn(), save: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('rejects legacy username/password-only registration because SaaS users need a tenant', async () => {
    const userService = {
      register: jest.fn(),
    };
    const service = createService({ userService });

    const result = await service.register({
      username: 'standalone',
      password: 'Secret123!',
    } as any);

    expect(result.code).toBe(400);
    expect(result.msg).toContain('SaaS 注册');
    expect(userService.register).not.toHaveBeenCalled();
  });

  it('revokes refresh token on logout when the client sends it', async () => {
    const userService = {
      deleteRefreshToken: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      verify: jest.fn().mockReturnValue({ uuid: 'access-uuid' }),
    };
    const redisService = {
      del: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService({ userService, jwtService, redisService });

    const result = await service.logout(
      {
        headers: { authorization: 'Bearer access-token' },
        body: { refreshToken: 'refresh-token' },
      },
      undefined,
      'admin',
    );

    expect(result.code).toBe(200);
    expect(redisService.del).toHaveBeenCalledWith(expect.stringContaining('access-uuid'));
    expect(userService.deleteRefreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('returns account identity context for the current logged-in user', async () => {
    const redisService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    const userService = {
      getUserinfo: jest.fn().mockResolvedValue({
        id: 7,
        username: 'founder',
        realname: 'Founder',
        email: 'founder@example.com',
        phone: '13800000000',
        avatar: '',
        gender: '0',
        remark: '',
        dashboard: 'work',
        loginTime: null,
        loginIp: '',
        isSuper: 0,
        roles: [{ code: 'tenant:9:owner' }],
        posts: [],
      }),
      getUserPermissions: jest.fn().mockResolvedValue(['tenant:billing:view']),
      getTenantInfo: jest.fn().mockResolvedValue({
        id: 9,
        tenantName: 'Acme',
        tenantCode: 'acme',
      }),
    };
    const service = createService({ userService, redisService });

    const result = await service.getCurrentUser({ userId: 7, tenantId: 9 });

    expect(redisService.get).toHaveBeenCalledWith(expect.stringMatching(/profile:7:9$/));
    expect(redisService.set).toHaveBeenCalledWith(
      expect.stringMatching(/profile:7:9$/),
      expect.any(Object),
      expect.any(Number),
    );
    expect(result.data).toEqual(
      expect.objectContaining({
        tenant_id: 9,
        account_scope: 'tenant',
        is_platform_admin: false,
        is_tenant_owner: true,
      }),
    );
  });

  it('proxies credential-gated tenant lookup before login', async () => {
    const userService = {
      getTenantsByCredentials: jest.fn().mockResolvedValue({
        code: 200,
        data: [{ id: 9, name: 'Acme' }],
      }),
    };
    const service = createService({ userService });

    const result = await service.getTenantsByCredentials({
      username: 'founder',
      password: 'Passw0rd!',
    });

    expect(result).toEqual({
      code: 200,
      data: [{ id: 9, name: 'Acme' }],
    });
    expect(userService.getTenantsByCredentials).toHaveBeenCalledWith('founder', 'Passw0rd!');
  });
});
