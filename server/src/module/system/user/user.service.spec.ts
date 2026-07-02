import * as bcrypt from 'bcryptjs';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'login-uuid'),
}));

import { UserService } from './user.service';

describe('UserService login', () => {
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
});
