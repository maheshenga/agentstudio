import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, IsNull } from 'typeorm';

import { SysRoleEntity } from '../../system/role/entities/role.entity';
import { UserEntity } from '../../system/user/entities/sys-user.entity';
import { SysUserRoleEntity } from '../../system/user/entities/user-width-role.entity';
import { SysUserTenantEntity } from '../../system/user/entities/user-tenant.entity';
import { SAAS_QUOTA_USERS } from '../constants';
import { CreateTenantMemberDto, TENANT_MEMBER_PASSWORD_PATTERN } from '../dto/create-tenant-member.dto';
import { SaasTenantResourceEntity } from '../entities/saas-tenant-resource.entity';

export interface SaasTenantMemberListQuery {
  page?: string | number;
  limit?: string | number;
}

export type SaasTenantMemberRecord = {
  user_id: number;
  username: string;
  realname: string;
  email: string;
  phone: string;
  status: number;
  role: 'admin' | 'member' | 'owner' | string;
  create_time?: Date;
};

@Injectable()
export class SaasTenantMemberService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async listMembers(tenantId: number, query: SaasTenantMemberListQuery = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const list = await this.dataSource.query(
      `
        SELECT
          \`user\`.\`id\` AS \`user_id\`,
          \`user\`.\`username\` AS \`username\`,
          \`user\`.\`realname\` AS \`realname\`,
          \`user\`.\`email\` AS \`email\`,
          \`user\`.\`phone\` AS \`phone\`,
          \`user\`.\`status\` AS \`status\`,
          COALESCE(
            MAX(CASE
              WHEN \`role\`.\`code\` REGEXP '^tenant:[0-9]+:(owner|admin|member)$'
              THEN \`role\`.\`code\`
            END),
            MAX(\`role\`.\`code\`)
          ) AS \`role_code\`,
          MIN(\`user_tenant\`.\`create_time\`) AS \`create_time\`,
          MIN(\`user_tenant\`.\`id\`) AS \`member_sort\`
        FROM \`sa_system_user_tenant\` \`user_tenant\`
        INNER JOIN \`sa_system_user\` \`user\`
          ON \`user\`.\`id\` = \`user_tenant\`.\`user_id\`
          AND \`user\`.\`delete_time\` IS NULL
        LEFT JOIN \`sa_system_user_role\` \`user_role\`
          ON \`user_role\`.\`user_id\` = \`user\`.\`id\`
          AND \`user_role\`.\`tenant_id\` = \`user_tenant\`.\`tenant_id\`
        LEFT JOIN \`sa_system_role\` \`role\`
          ON \`role\`.\`id\` = \`user_role\`.\`role_id\`
          AND \`role\`.\`delete_time\` IS NULL
        WHERE \`user_tenant\`.\`tenant_id\` = ?
          AND \`user_tenant\`.\`delete_time\` IS NULL
        GROUP BY
          \`user\`.\`id\`,
          \`user\`.\`username\`,
          \`user\`.\`realname\`,
          \`user\`.\`email\`,
          \`user\`.\`phone\`,
          \`user\`.\`status\`
        ORDER BY \`member_sort\` ASC
        LIMIT ? OFFSET ?
      `,
      [tenantId, limit, skip],
    );
    const totalRows = await this.dataSource.query(
      `
        SELECT COUNT(DISTINCT \`user_id\`) AS \`total\`
        FROM \`sa_system_user_tenant\`
        WHERE \`tenant_id\` = ?
          AND \`delete_time\` IS NULL
      `,
      [tenantId],
    );

    return {
      list: list.map((item) => this.toMemberResponse(item)),
      total: Number(totalRows?.[0]?.total) || 0,
      page,
      limit,
    };
  }

  async createMember(tenantId: number, dto: CreateTenantMemberDto): Promise<SaasTenantMemberRecord> {
    if (!TENANT_MEMBER_PASSWORD_PATTERN.test(String(dto.password || ''))) {
      throw new BadRequestException('成员密码至少 8 位且需要包含字母和数字');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(UserEntity, { where: { username: dto.username } });
      if (existing) {
        throw new BadRequestException('用户名已存在');
      }

      await this.assertUserQuotaAvailable(tenantId, manager);

      const role = await manager.findOne(SysRoleEntity, {
        where: { tenantId, code: `tenant:${tenantId}:${dto.role}`, deleteTime: IsNull(), status: 1 },
      });
      if (!role) {
        throw new BadRequestException('租户角色不存在');
      }

      const user = await manager.save(
        UserEntity,
        manager.create(UserEntity, {
          username: dto.username,
          password: bcrypt.hashSync(dto.password, bcrypt.genSaltSync(10)),
          realname: dto.realname || dto.username,
          phone: dto.phone || '',
          email: dto.email || '',
          status: 1,
          dashboard: 'work',
          remark: '',
        }),
      );

      await manager.save(
        SysUserTenantEntity,
        manager.create(SysUserTenantEntity, {
          userId: user.id,
          tenantId,
          isDefault: 0,
          isSuper: 0,
        }),
      );
      await manager.save(
        SysUserRoleEntity,
        manager.create(SysUserRoleEntity, {
          userId: user.id,
          roleId: role.id,
          tenantId,
          status: 1,
        }),
      );

      return this.toMemberResponse({
        user_id: user.id,
        username: user.username,
        realname: user.realname,
        email: user.email,
        phone: user.phone,
        status: user.status,
        role_code: role.code,
        create_time: user.createTime,
      });
    });
  }

  async changeMemberRole(tenantId: number, userId: number, role: 'admin' | 'member') {
    if (!['admin', 'member'].includes(role)) {
      throw new BadRequestException('租户角色只能是管理员或成员');
    }

    return this.dataSource.transaction(async (manager) => {
      await this.assertManageableMember(tenantId, userId, manager);
      const targetRole = await manager.findOne(SysRoleEntity, {
        where: { tenantId, code: `tenant:${tenantId}:${role}`, deleteTime: IsNull(), status: 1 },
      });
      if (!targetRole) {
        throw new BadRequestException('租户角色不存在');
      }

      await manager.delete(SysUserRoleEntity, { tenantId, userId });
      await manager.save(
        SysUserRoleEntity,
        manager.create(SysUserRoleEntity, {
          userId,
          roleId: targetRole.id,
          tenantId,
          status: 1,
        }),
      );
    });
  }

  async updateMemberStatus(tenantId: number, userId: number, status: 0 | 1) {
    if (![0, 1].includes(Number(status))) {
      throw new BadRequestException('成员状态只能是启用或停用');
    }

    return this.dataSource.transaction(async (manager) => {
      await this.assertManageableMember(tenantId, userId, manager);
      await manager.update(UserEntity, { id: userId }, { status: Number(status) });
    });
  }

  async removeMember(tenantId: number, userId: number) {
    return this.dataSource.transaction(async (manager) => {
      const member = await this.assertManageableMember(tenantId, userId, manager);
      await manager.softDelete(SysUserTenantEntity, member.id);
      await manager.delete(SysUserRoleEntity, { tenantId, userId });

      const remainingTenantCount = await manager.count(SysUserTenantEntity, {
        where: { userId, deleteTime: IsNull() },
      });
      if (remainingTenantCount === 0) {
        await manager.softDelete(UserEntity, userId);
      }
    });
  }

  async resetMemberPassword(tenantId: number, userId: number, password: string) {
    if (!TENANT_MEMBER_PASSWORD_PATTERN.test(String(password || ''))) {
      throw new BadRequestException('新密码至少 8 位且需要包含字母和数字');
    }

    return this.dataSource.transaction(async (manager) => {
      await this.assertManageableMember(tenantId, userId, manager);
      await manager.update(UserEntity, { id: userId }, { password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)) });
    });
  }

  private async assertUserQuotaAvailable(tenantId: number, manager: any): Promise<void> {
    const quota = await manager.findOne(SaasTenantResourceEntity, {
      where: { tenantId, resourceType: SAAS_QUOTA_USERS, status: 1 },
    });
    const totalQuota = Number(quota?.totalQuota) || 0;
    if (totalQuota <= 0) {
      return;
    }

    const currentUsers = await manager.count(SysUserTenantEntity, {
      where: { tenantId, deleteTime: IsNull() },
    });
    if (currentUsers >= totalQuota) {
      throw new BadRequestException('租户用户数额度不足');
    }
  }

  private async assertManageableMember(tenantId: number, userId: number, manager: any) {
    const member = await manager.findOne(SysUserTenantEntity, {
      where: { tenantId, userId, deleteTime: IsNull() },
    });
    if (!member) {
      throw new BadRequestException('租户成员不存在');
    }

    const roles = await manager.query(
      `
        SELECT \`role\`.\`code\` AS \`role_code\`
        FROM \`sa_system_user_role\` \`user_role\`
        INNER JOIN \`sa_system_role\` \`role\`
          ON \`role\`.\`id\` = \`user_role\`.\`role_id\`
          AND \`role\`.\`delete_time\` IS NULL
        WHERE \`user_role\`.\`tenant_id\` = ?
          AND \`user_role\`.\`user_id\` = ?
      `,
      [tenantId, userId],
    );
    if ((roles || []).some((role: any) => String(role.role_code || '').endsWith(':owner'))) {
      throw new BadRequestException('租户负责人不能通过成员管理修改');
    }

    return member;
  }

  private toMemberResponse(item: any): SaasTenantMemberRecord {
    const roleCode = String(item.role_code || '');
    return {
      user_id: Number(item.user_id),
      username: item.username || '',
      realname: item.realname || '',
      email: item.email || '',
      phone: item.phone || '',
      status: Number(item.status) || 0,
      role: roleCode.split(':').pop() || '',
      create_time: item.create_time,
    };
  }
}
