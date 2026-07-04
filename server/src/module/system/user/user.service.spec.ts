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

  afterEach(() => {
    if (originalLoginCaptchaEnabled === undefined) {
      delete process.env.LOGIN_CAPTCHA_ENABLED;
    } else {
      process.env.LOGIN_CAPTCHA_ENABLED = originalLoginCaptchaEnabled;
    }
  });

  it('logs in a SaaS user without a department', async () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 125,
        password: bcrypt.hashSync('Passw0rd!', 10),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const sysDeptEntityRep = {
      findOne: jest.fn(() => {
        throw new Error('dept lookup should not run when deptId is null');
      }),
    };
    const menuService = {
      getMenuListByUserId: jest.fn().mockResolvedValue([{ id: 1, name: 'SaaS' }]),
    };
    const redisService = {
      get: jest.fn().mockResolvedValue('1234'),
    };

    const service = new UserService(
      userRepo as any,
      sysDeptEntityRep as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      menuService as any,
      { sign: jest.fn().mockReturnValue('access-token') } as any,
      redisService as any,
      {} as any,
      {} as any,
      {} as any,
    );

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
    jest.spyOn(service as any, 'getUserPermissions').mockResolvedValue(['tenant:billing:view']);
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
    expect(userData.deptName).toBe('');
    expect(sysDeptEntityRep.findOne).not.toHaveBeenCalled();
    expect(menuService.getMenuListByUserId).toHaveBeenCalledWith(125, 12);
  });

  it('logs in without captcha when login captcha is disabled', async () => {
    process.env.LOGIN_CAPTCHA_ENABLED = 'false';

    const userRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 125,
        password: bcrypt.hashSync('Passw0rd!', 10),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const sysDeptEntityRep = {
      findOne: jest.fn().mockResolvedValue({ id: 3, deptName: 'Tech' }),
    };
    const menuService = {
      getMenuListByUserId: jest.fn().mockResolvedValue([{ id: 1, name: 'SaaS' }]),
    };
    const redisService = {
      get: jest.fn().mockResolvedValue('1234'),
    };

    const service = new UserService(
      userRepo as any,
      sysDeptEntityRep as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      menuService as any,
      { sign: jest.fn().mockReturnValue('access-token') } as any,
      redisService as any,
      {} as any,
      {} as any,
      {} as any,
    );

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
