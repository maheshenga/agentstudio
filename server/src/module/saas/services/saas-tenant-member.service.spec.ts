import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

import { SAAS_QUOTA_USERS } from '../constants';
import { SaasTenantMemberService } from './saas-tenant-member.service';

describe('SaasTenantMemberService', () => {
  let service: SaasTenantMemberService;

  const manager = {
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn(),
    create: jest.fn((_entity, value) => value),
  };

  const dataSource = {
    transaction: jest.fn((callback) => callback(manager)),
    query: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaasTenantMemberService,
        { provide: getDataSourceToken(), useValue: dataSource },
      ],
    }).compile();

    service = module.get(SaasTenantMemberService);
  });

  it('lists tenant members with their tenant role names', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          user_id: 7,
          username: 'alice',
          realname: 'Alice',
          email: 'a@example.com',
          phone: '13800000000',
          status: 1,
          role_code: 'tenant:12:admin',
          create_time: new Date('2026-07-04T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ total: 1 }]);

    await expect(service.listMembers(12, { page: '1', limit: '20' })).resolves.toMatchObject({
      total: 1,
      list: [{ user_id: 7, username: 'alice', role: 'admin' }],
    });

    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('sa_system_user_tenant'), [12, 20, 0]);
  });

  it('creates a tenant member when user quota allows it', async () => {
    manager.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ totalQuota: 3 })
      .mockResolvedValueOnce({ id: 22, code: 'tenant:12:member' });
    manager.count.mockResolvedValue(1);
    manager.save
      .mockResolvedValueOnce({ id: 8, username: 'bob', realname: 'Bob', status: 1 })
      .mockResolvedValueOnce({ id: 30 })
      .mockResolvedValueOnce({ id: 31 });

    const result = await service.createMember(12, {
      username: 'bob',
      password: '123456',
      realname: 'Bob',
      role: 'member',
    });

    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), { where: { username: 'bob' } });
    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), {
      where: { tenantId: 12, resourceType: SAAS_QUOTA_USERS, status: 1 },
    });
    expect(manager.count).toHaveBeenCalledWith(expect.any(Function), { where: { tenantId: 12 } });
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ username: 'bob', password: expect.not.stringMatching(/^123456$/), status: 1 }),
    );
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ userId: 8, tenantId: 12 }));
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ userId: 8, roleId: 22, tenantId: 12 }));
    expect(result).toMatchObject({ user_id: 8, username: 'bob', role: 'member' });
  });

  it('rejects member creation when tenant user quota is full', async () => {
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ totalQuota: 1 });
    manager.count.mockResolvedValue(1);

    await expect(
      service.createMember(12, {
        username: 'bob',
        password: '123456',
        role: 'member',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
