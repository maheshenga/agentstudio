import * as bcrypt from 'bcryptjs';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'login-uuid'),
}));

jest.mock('../../../common/utils/index', () => ({
  getNowDate: jest.fn(() => new Date('2026-01-01T00:00:00.000Z')),
  generateUUID: jest.fn(() => 'test-uuid'),
  uniq: jest.fn((items: unknown[]) => Array.from(new Set(items))),
  formatDateTime: jest.fn((value: unknown) => value),
}));

import { UserService } from './user.service';
import { getTenantId } from '../../../common/utils/tenant.util';

type QueryBuilderMock = {
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndMapOne: jest.Mock;
  skip: jest.Mock;
  take: jest.Mock;
  getManyAndCount: jest.Mock;
};

function createQueryBuilderMock(): QueryBuilderMock {
  const qb: QueryBuilderMock = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoinAndMapOne: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
}

function createQueryFilterService(qb: QueryBuilderMock) {
  const userRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
  };

  const roleLinkRepo = {
    find: jest.fn().mockResolvedValue([{ userId: 1 }]),
  };

  return new UserService(
    userRepo as any,
    {} as any,
    {} as any,
    {} as any,
    roleLinkRepo as any,
    {} as any,
    {} as any,
    {} as any,
    { findRoleWithDeptIds: jest.fn() } as any,
    { findDeptIdsByDataScope: jest.fn() } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

function expectParameterizedLike(qb: QueryBuilderMock, column: string, param: string, value: string) {
  expect(qb.andWhere).toHaveBeenCalledWith(`${column} LIKE :${param}`, { [param]: `%${value}%` });
  expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining(value));
}

describe('UserService login', () => {
  const originalLoginCaptchaEnabled = process.env.LOGIN_CAPTCHA_ENABLED;

  function createLoginService(overrides: Record<string, any> = {}) {
    const userRepo = overrides.userRepo || {
      findOne: jest.fn().mockResolvedValue({
        id: 125,
        password: bcrypt.hashSync('Passw0rd!', 10),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const sysDeptEntityRep = overrides.sysDeptEntityRep || {
      findOne: jest.fn().mockResolvedValue({ id: 3, deptName: 'Tech' }),
    };
    const sysUserTenantEntityRep = overrides.sysUserTenantEntityRep || {
      findOne: jest.fn().mockResolvedValue({ id: 99, userId: 125, tenantId: 12 }),
    };
    const tenantEntityRep = overrides.tenantEntityRep || {
      findOne: jest.fn().mockResolvedValue({ id: 12, status: 1, tenantName: 'Acme' }),
    };
    const menuService = overrides.menuService || {
      getMenuListByUserId: jest.fn().mockResolvedValue([{ id: 1, name: 'SaaS' }]),
    };
    const redisService = overrides.redisService || {
      get: jest.fn().mockResolvedValue('1234'),
    };

    const service = new UserService(
      userRepo as any,
      sysDeptEntityRep as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      sysUserTenantEntityRep as any,
      tenantEntityRep as any,
      {} as any,
      {} as any,
      menuService as any,
      { sign: jest.fn().mockReturnValue('access-token') } as any,
      redisService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    return {
      service,
      userRepo,
      sysDeptEntityRep,
      sysUserTenantEntityRep,
      tenantEntityRep,
      menuService,
      redisService,
    };
  }

  afterEach(() => {
    if (originalLoginCaptchaEnabled === undefined) {
      delete process.env.LOGIN_CAPTCHA_ENABLED;
    } else {
      process.env.LOGIN_CAPTCHA_ENABLED = originalLoginCaptchaEnabled;
    }
  });

  it('logs in a SaaS user without a department', async () => {
    const { service, sysDeptEntityRep, menuService } = createLoginService({
      sysDeptEntityRep: {
        findOne: jest.fn(() => {
          throw new Error('dept lookup should not run when deptId is null');
        }),
      },
    });

    const userData: any = {
      id: 125,
      username: 'saas_owner_0702115553',
      realname: 'SaaS Owner',
      avatar: '',
      deptId: null,
      deleteTime: null,
      status: 1,
      isSuper: 0,
      roles: [{ code: 'tenant:12:owner' }],
    };

    jest.spyOn(service as any, 'getUserinfo').mockResolvedValue(userData);
    jest.spyOn(service as any, 'getUserPermissions').mockImplementation(async () => [`tenant:${getTenantId()}:billing:view`]);
    jest.spyOn(service as any, 'createToken').mockReturnValue('access-token');
    jest.spyOn(service as any, 'createRefreshToken').mockResolvedValue('refresh-token');
    jest.spyOn(service as any, 'resolveLoginLocationFast').mockResolvedValue('unknown');
    jest.spyOn(service as any, 'updateRedisToken').mockResolvedValue(undefined);

    const result = await service.login(
      {
        username: 'saas_owner_0702115553',
        password: 'Passw0rd!',
        tenant_id: 12,
        uuid: 'captcha-uuid',
        code: '1234',
      },
      { ipaddr: '127.0.0.1', browser: 'Chrome', os: 'Windows' } as any,
    );

    expect(result.code).toBe(200);
    expect(result.data.permissions).toEqual(['tenant:12:billing:view']);
    expect(userData.deptName).toBe('');
    expect(sysDeptEntityRep.findOne).not.toHaveBeenCalled();
    expect(menuService.getMenuListByUserId).toHaveBeenCalledWith(125, 12);
  });

  it('logs in without captcha when login captcha is disabled', async () => {
    process.env.LOGIN_CAPTCHA_ENABLED = 'false';

    const { service, redisService } = createLoginService({
      tenantEntityRep: {
        findOne: jest.fn().mockResolvedValue({ id: 1, status: 1, tenantName: 'Platform Tenant' }),
      },
      sysUserTenantEntityRep: {
        findOne: jest.fn().mockResolvedValue({ id: 100, userId: 125, tenantId: 1 }),
      },
    });

    jest.spyOn(service as any, 'getUserinfo').mockResolvedValue({
      id: 125,
      username: 'admin',
      realname: 'Admin',
      avatar: '',
      deptId: 3,
      deleteTime: null,
      status: 1,
      isSuper: 1,
      roles: [{ code: 'admin' }],
    });
    jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue(['*']);
    jest.spyOn(service as any, 'createToken').mockReturnValue('access-token');
    jest.spyOn(service as any, 'createRefreshToken').mockResolvedValue('refresh-token');
    jest.spyOn(service as any, 'resolveLoginLocationFast').mockResolvedValue('unknown');
    jest.spyOn(service as any, 'updateRedisToken').mockResolvedValue(undefined);

    const result = await service.login(
      {
        username: 'admin',
        password: 'Passw0rd!',
        tenant_id: 1,
      },
      { ipaddr: '127.0.0.1', browser: 'Chrome', os: 'Windows' } as any,
    );

    expect(result.code).toBe(200);
    expect(redisService.get).not.toHaveBeenCalled();
  });

  it('rejects login when the selected tenant is not linked to the user', async () => {
    process.env.LOGIN_CAPTCHA_ENABLED = 'false';

    const { service, userRepo, sysUserTenantEntityRep, tenantEntityRep, menuService } = createLoginService({
      sysUserTenantEntityRep: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    });

    jest.spyOn(service as any, 'getUserinfo').mockResolvedValue({
      id: 125,
      username: 'alice',
      realname: 'Alice',
      avatar: '',
      deptId: null,
      deleteTime: null,
      status: 1,
      isSuper: 0,
      roles: [{ code: 'tenant:12:member' }],
    });
    jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue(['tenant:billing:view']);
    jest.spyOn(service as any, 'createToken').mockReturnValue('access-token');
    jest.spyOn(service as any, 'createRefreshToken').mockResolvedValue('refresh-token');
    jest.spyOn(service as any, 'resolveLoginLocationFast').mockResolvedValue('unknown');
    jest.spyOn(service as any, 'updateRedisToken').mockResolvedValue(undefined);

    const result = await service.login(
      {
        username: 'alice',
        password: 'Passw0rd!',
        tenant_id: 12,
      },
      { ipaddr: '127.0.0.1', browser: 'Chrome', os: 'Windows' } as any,
    );

    expect(result).toMatchObject({ code: 403, msg: '您不属于该租户' });
    expect(sysUserTenantEntityRep.findOne).toHaveBeenCalled();
    expect(tenantEntityRep.findOne).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(menuService.getMenuListByUserId).not.toHaveBeenCalled();
  });

  it('rejects login when the selected tenant is inactive', async () => {
    process.env.LOGIN_CAPTCHA_ENABLED = 'false';

    const { service, userRepo, tenantEntityRep, menuService } = createLoginService({
      tenantEntityRep: {
        findOne: jest.fn().mockResolvedValue(null),
      },
    });

    jest.spyOn(service as any, 'getUserinfo').mockResolvedValue({
      id: 125,
      username: 'alice',
      realname: 'Alice',
      avatar: '',
      deptId: null,
      deleteTime: null,
      status: 1,
      isSuper: 0,
      roles: [{ code: 'tenant:12:member' }],
    });
    jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue(['tenant:billing:view']);
    jest.spyOn(service as any, 'createToken').mockReturnValue('access-token');
    jest.spyOn(service as any, 'createRefreshToken').mockResolvedValue('refresh-token');
    jest.spyOn(service as any, 'resolveLoginLocationFast').mockResolvedValue('unknown');
    jest.spyOn(service as any, 'updateRedisToken').mockResolvedValue(undefined);

    const result = await service.login(
      {
        username: 'alice',
        password: 'Passw0rd!',
        tenant_id: 12,
      },
      { ipaddr: '127.0.0.1', browser: 'Chrome', os: 'Windows' } as any,
    );

    expect(result).toMatchObject({ code: 403, msg: '租户无效或已过期' });
    expect(tenantEntityRep.findOne).toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
    expect(menuService.getMenuListByUserId).not.toHaveBeenCalled();
  });
});

describe('UserService query filters', () => {
  it('parameterizes username and phone filters in user list queries', async () => {
    const qb = createQueryBuilderMock();
    const service = createQueryFilterService(qb);

    await service.findAll({ username: `admin%" OR 1=1 --`, phone: `138%" OR 1=1 --` } as any, null as any);

    expectParameterizedLike(qb, 'user.username', 'username', `admin%" OR 1=1 --`);
    expectParameterizedLike(qb, 'user.phone', 'phone', `138%" OR 1=1 --`);
  });

  it('parameterizes username and phone filters in allocated user queries', async () => {
    const qb = createQueryBuilderMock();
    const service = createQueryFilterService(qb);

    await service.allocatedList({
      role_id: 1,
      username: `allocated%" OR 1=1 --`,
      phone: `139%" OR 1=1 --`,
      pageNum: 1,
      pageSize: 10,
    } as any);

    expectParameterizedLike(qb, 'user.username', 'username', `allocated%" OR 1=1 --`);
    expectParameterizedLike(qb, 'user.phone', 'phone', `139%" OR 1=1 --`);
  });

  it('parameterizes username and phone filters in unallocated user queries', async () => {
    const qb = createQueryBuilderMock();
    const service = createQueryFilterService(qb);

    await service.unallocatedList({
      role_id: 1,
      username: `unallocated%" OR 1=1 --`,
      phone: `137%" OR 1=1 --`,
      pageNum: 1,
      pageSize: 10,
    } as any);

    expectParameterizedLike(qb, 'user.username', 'username', `unallocated%" OR 1=1 --`);
    expectParameterizedLike(qb, 'user.phone', 'phone', `137%" OR 1=1 --`);
  });
});

describe('UserService tenant lookup before login', () => {
  function createTenantLookupService(userRepo: any, userTenantRepo: any, tenantRepo: any) {
    return new UserService(
      userRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      userTenantRepo as any,
      tenantRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('does not query the database for blank or one-character usernames', async () => {
    const userRepo = {
      findOne: jest.fn(),
    };
    const service = createTenantLookupService(userRepo, {}, {});

    const blank = await service.getTenantsByUsername(' ');
    const short = await service.getTenantsByUsername('a');

    expect(blank.code).toBe(200);
    expect(blank.data).toEqual([]);
    expect(short.data).toEqual([]);
    expect(userRepo.findOne).not.toHaveBeenCalled();
  });

  it('does not expose tenant memberships from username-only lookup', async () => {
    const userRepo = {
      findOne: jest.fn(),
    };
    const userTenantRepo = {
      find: jest.fn(),
    };
    const tenantRepo = {
      find: jest.fn(),
    };
    const service = createTenantLookupService(userRepo, userTenantRepo, tenantRepo);

    const result = await service.getTenantsByUsername(' founder ');

    expect(result.code).toBe(200);
    expect(result.data).toEqual([]);
    expect(userRepo.findOne).not.toHaveBeenCalled();
    expect(userTenantRepo.find).not.toHaveBeenCalled();
    expect(tenantRepo.find).not.toHaveBeenCalled();
  });

  it('trims usernames before credential-gated tenant lookup', async () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        username: 'founder',
        password: bcrypt.hashSync('Passw0rd!', 10),
      }),
    };
    const userTenantRepo = {
      find: jest.fn().mockResolvedValue([{ userId: 7, tenantId: 9, isDefault: 1 }]),
    };
    const tenantRepo = {
      find: jest.fn().mockResolvedValue([{ id: 9, tenantName: 'Acme', tenantCode: 'acme', status: 1 }]),
    };
    const service = createTenantLookupService(userRepo, userTenantRepo, tenantRepo);

    const result = await service.getTenantsByCredentials(' founder ', 'Passw0rd!');

    expect(result.data).toEqual([
      {
        id: 9,
        name: 'Acme',
        code: 'acme',
        is_default: true,
        status: 1,
      },
    ]);
    expect(userRepo.findOne).toHaveBeenCalledWith({
      where: { username: 'founder' },
      select: { id: true, username: true, password: true },
    });
  });

  it('returns an empty tenant list for invalid credentials without revealing account existence', async () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 7,
        username: 'founder',
        password: bcrypt.hashSync('Passw0rd!', 10),
      }),
    };
    const userTenantRepo = {
      find: jest.fn(),
    };
    const tenantRepo = {
      find: jest.fn(),
    };
    const service = createTenantLookupService(userRepo, userTenantRepo, tenantRepo);

    const result = await service.getTenantsByCredentials('founder', 'wrong-password');

    expect(result.code).toBe(200);
    expect(result.data).toEqual([]);
    expect(userTenantRepo.find).not.toHaveBeenCalled();
    expect(tenantRepo.find).not.toHaveBeenCalled();
  });
});

describe('UserService refresh token tenant context', () => {
  function createRefreshService(redisService: any) {
    return new UserService(
      {} as any,
      { findOne: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { findOne: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { sign: jest.fn().mockReturnValue('new-access-token'), verify: jest.fn() } as any,
      redisService as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('stores tenant metadata with new refresh tokens', async () => {
    const redisService = {
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = createRefreshService(redisService);

    const rawToken = await service.createRefreshToken(7, 12);

    expect(rawToken).toHaveLength(128);
    expect(redisService.set).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh_tokens:/),
      { userId: 7, tenantId: 12 },
      expect.any(Number),
    );
  });

  it('preserves tenant metadata while rotating a refresh token without falling back to another default tenant', async () => {
    const redisService = {
      get: jest.fn(async (key: string) => {
        if (key.startsWith('refresh_tokens:')) {
          return { userId: 7, tenantId: 12 };
        }
        return null;
      }),
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };
    const service = createRefreshService(redisService);
    const defaultTenantSpy = jest.spyOn(service as any, 'getDefaultTenantId').mockImplementation(() => {
      throw new Error('default tenant fallback should not run');
    });
    jest.spyOn(service as any, 'getUserinfo').mockResolvedValue({
      id: 7,
      username: 'alice',
      realname: 'Alice',
      avatar: '',
      deptId: null,
      deleteTime: null,
      status: 1,
      roles: [{ code: 'tenant:12:owner' }],
    });
    jest.spyOn(service as any, 'getUserPermissions').mockImplementation(async () => [`tenant:${getTenantId()}:billing:view`]);
    jest.spyOn(service as any, 'createToken').mockReturnValue('new-access-token');
    const createRefreshTokenSpy = jest.spyOn(service as any, 'createRefreshToken').mockResolvedValue('new-refresh-token');
    const updateRedisTokenSpy = jest.spyOn(service as any, 'updateRedisToken').mockResolvedValue(undefined);

    const result = await service.refreshToken({ refreshToken: 'old-refresh-token' });

    expect(result.code).toBe(200);
    expect(result.data).toEqual({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: expect.any(Number),
    });
    expect(defaultTenantSpy).not.toHaveBeenCalled();
    expect(createRefreshTokenSpy).toHaveBeenCalledWith(7, 12);
    expect(updateRedisTokenSpy).toHaveBeenCalledWith(
      'test-uuid',
      expect.objectContaining({
        tenantId: 12,
        permissions: ['tenant:12:billing:view'],
      }),
    );
  });
});

describe('UserService runtime cache eviction', () => {
  it('clears all tenant-scoped profile cache entries for a user', async () => {
    const redisService = {
      keys: jest.fn().mockResolvedValue(['user:profile:7:0', 'user:profile:7:9']),
      del: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UserService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      redisService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await (service as any).clearUserRuntimeCache(7);

    expect(redisService.keys).toHaveBeenCalledWith('user:profile:7:*');
    expect(redisService.del).toHaveBeenCalledWith(['user:profile:7:0', 'user:profile:7:9']);
  });
});
