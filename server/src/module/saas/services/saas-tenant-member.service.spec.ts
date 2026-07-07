import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';

import { SAAS_QUOTA_USERS } from '../constants';
import { SaasTenantMemberService } from './saas-tenant-member.service';

describe('SaasTenantMemberService', () => {
  let service: SaasTenantMemberService;

  const manager = {
    findOne: jest.fn(),
    query: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    softDelete: jest.fn(),
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
      password: 'Secret123',
      realname: 'Bob',
      role: 'member',
    });

    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), { where: { username: 'bob' } });
    expect(manager.findOne).toHaveBeenCalledWith(expect.any(Function), {
      where: { tenantId: 12, resourceType: SAAS_QUOTA_USERS, status: 1 },
    });
    expect(manager.count).toHaveBeenCalledWith(expect.any(Function), {
      where: { tenantId: 12, deleteTime: IsNull() },
    });
    expect(manager.save).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ username: 'bob', password: expect.not.stringMatching(/^123456$/), status: 1 }),
    );
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ userId: 8, tenantId: 12 }));
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ userId: 8, roleId: 22, tenantId: 12 }));
    expect(result).toMatchObject({ user_id: 8, username: 'bob', role: 'member' });
  });

  it('excludes soft-deleted tenant memberships from user quota checks', async () => {
    manager.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ totalQuota: 2 })
      .mockResolvedValueOnce({ id: 22, code: 'tenant:12:member' });
    manager.count.mockResolvedValue(1);
    manager.save
      .mockResolvedValueOnce({ id: 8, username: 'bob', realname: 'Bob', status: 1 })
      .mockResolvedValueOnce({ id: 30 })
      .mockResolvedValueOnce({ id: 31 });

    await service.createMember(12, {
      username: 'bob',
      password: 'Secret123',
      realname: 'Bob',
      role: 'member',
    });

    expect(manager.count).toHaveBeenCalledWith(expect.any(Function), {
      where: { tenantId: 12, deleteTime: IsNull() },
    });
  });

  it('rejects member creation when tenant user quota is full', async () => {
    manager.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ totalQuota: 1 });
    manager.count.mockResolvedValue(1);

    await expect(
      service.createMember(12, {
        username: 'bob',
        password: 'Secret123',
        role: 'member',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects weak tenant member passwords before opening a transaction', async () => {
    await expect(
      service.createMember(12, {
        username: 'bob',
        password: '123456',
        role: 'member',
      }),
    ).rejects.toThrow('成员密码至少 8 位且需要包含字母和数字');

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('changes a tenant member role within the same tenant', async () => {
    manager.findOne
      .mockResolvedValueOnce({ id: 70, userId: 8, tenantId: 12 })
      .mockResolvedValueOnce({ id: 22, code: 'tenant:12:admin' });
    manager.query.mockResolvedValueOnce([{ role_code: 'tenant:12:member' }]);
    manager.delete.mockResolvedValue({ affected: 1 });
    manager.save.mockResolvedValue({ id: 33 });

    await service.changeMemberRole(12, 8, 'admin');

    expect(manager.delete).toHaveBeenCalledWith(expect.any(Function), { tenantId: 12, userId: 8 });
    expect(manager.save).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ tenantId: 12, userId: 8, roleId: 22 }));
  });

  it('does not change the tenant owner through member role management', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 70, userId: 8, tenantId: 12 });
    manager.query.mockResolvedValueOnce([{ role_code: 'tenant:12:owner' }]);

    await expect(service.changeMemberRole(12, 8, 'member')).rejects.toThrow('租户负责人不能通过成员管理修改');

    expect(manager.delete).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('updates a tenant member status', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 70, userId: 8, tenantId: 12 });
    manager.query.mockResolvedValueOnce([{ role_code: 'tenant:12:member' }]);
    manager.update.mockResolvedValue({ affected: 1 });

    await service.updateMemberStatus(12, 8, 0);

    expect(manager.update).toHaveBeenCalledWith(expect.any(Function), { id: 8 }, { status: 0 });
  });

  it('removes a tenant member and soft deletes the user when no tenant remains', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 70, userId: 8, tenantId: 12 });
    manager.query.mockResolvedValueOnce([{ role_code: 'tenant:12:member' }]);
    manager.count.mockResolvedValueOnce(0);

    await service.removeMember(12, 8);

    expect(manager.softDelete).toHaveBeenCalledWith(expect.any(Function), 70);
    expect(manager.delete).toHaveBeenCalledWith(expect.any(Function), { tenantId: 12, userId: 8 });
    expect(manager.softDelete).toHaveBeenCalledWith(expect.any(Function), 8);
  });

  it('resets a tenant member password', async () => {
    manager.findOne.mockResolvedValueOnce({ id: 70, userId: 8, tenantId: 12 });
    manager.query.mockResolvedValueOnce([{ role_code: 'tenant:12:member' }]);
    manager.update.mockResolvedValue({ affected: 1 });

    await service.resetMemberPassword(12, 8, 'NewPass123!');

    expect(manager.update).toHaveBeenCalledWith(
      expect.any(Function),
      { id: 8 },
      expect.objectContaining({ password: expect.not.stringMatching(/^NewPass123!$/) }),
    );
  });

  it('rejects weak tenant member reset passwords before opening a transaction', async () => {
    await expect(service.resetMemberPassword(12, 8, '123456')).rejects.toThrow(
      '新密码至少 8 位且需要包含字母和数字',
    );

    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
