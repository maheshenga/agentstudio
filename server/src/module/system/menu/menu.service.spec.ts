jest.mock('../../../common/utils/index', () => ({
  uniq: (items: unknown[]) => Array.from(new Set(items)),
  listToTree: jest.fn(),
}));

import { MenuService } from './menu.service';

describe('MenuService', () => {
  const userService = {
    isSuperAdmin: jest.fn(),
    getRoleIds: jest.fn(),
  };

  const menuRepo = {
    createQueryBuilder: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const roleMenuRepo = {
    find: jest.fn(),
  };

  const redisService = {
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
  };

  let service: MenuService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MenuService(userService as any, menuRepo as any, roleMenuRepo as any, redisService as any);

    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ version: '2026-07-05T14:02:41.000Z' }),
    };
    menuRepo.createQueryBuilder.mockReturnValue(queryBuilder);
  });

  it('uses the menu update version in cache keys so stale route trees are bypassed after migrations', async () => {
    redisService.get.mockImplementation(async (key: string) => {
      if (key === 'sys_menu:13:42') {
        return [{ name: '订阅服务', children: [{ name: '套餐概览', path: 'plan' }] }];
      }
      return null;
    });
    userService.isSuperAdmin.mockResolvedValue(false);
    userService.getRoleIds.mockResolvedValue([211]);
    roleMenuRepo.find.mockResolvedValue([{ menuId: 351 }]);
    menuRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 351) return { id: 351, parentId: 340 };
      if (where.id === 340) return { id: 340, parentId: 0 };
      return null;
    });
    menuRepo.find.mockResolvedValue([
      {
        id: 340,
        parentId: 0,
        name: '订阅服务',
        code: 'TenantSaas',
        type: 1,
        path: '/tenant-saas',
        component: '',
        sort: 95,
        status: 1,
      },
      {
        id: 351,
        parentId: 340,
        name: '资源包',
        code: 'TenantResourcePack',
        type: 2,
        path: 'resource-packs',
        component: '/saas/tenant/resource-pack',
        sort: 30,
        status: 1,
      },
    ]);

    const result = await service.getMenuListByUserId(42, 13);

    expect(redisService.get).toHaveBeenCalledWith('sys_menu:13:42:2026-07-05T14:02:41.000Z');
    expect(redisService.get).not.toHaveBeenCalledWith('sys_menu:13:42');
    expect(result[0].children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '资源包',
          path: 'resource-packs',
        }),
      ]),
    );
    expect(redisService.set).toHaveBeenCalledWith(
      'sys_menu:13:42:2026-07-05T14:02:41.000Z',
      expect.any(Array),
      7200 * 1000,
    );
  });
});
