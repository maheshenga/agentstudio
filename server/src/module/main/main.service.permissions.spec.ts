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
