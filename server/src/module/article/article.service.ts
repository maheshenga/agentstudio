import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ResultData } from '../../common/utils/result';
import { ArticleEntity } from './entities/article.entity';
import { CreateArticleDto, UpdateArticleDto, ListArticleDto } from './dto/index';
import { DataScopeEnum } from '../../common/enum/index';
import { applyTenantFilter, withTenantId } from '../../common/utils/tenant.util';
import { TenantContext } from '../../common/tenant/tenant.context';
import { DeptService } from '../system/dept/dept.service';
import { RoleService } from '../system/role/role.service';
import type { UserType } from '../system/user/dto/user';
import { formatDateTime } from '../../common/utils/index';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(ArticleEntity)
    private readonly articleRepo: Repository<ArticleEntity>,
    private readonly deptService: DeptService,
    private readonly roleService: RoleService,
  ) {}

  /** 将 DTO 的 snake_case 字段映射为 entity 的 camelCase */
  private mapDtoToEntity(dto: Record<string, any>): Record<string, any> {
    const map: Record<string, string> = {
      category_id: 'categoryId',
      is_link: 'isLink',
      link_url: 'linkUrl',
      is_hot: 'isHot',
      created_by: 'createdBy',
      updated_by: 'updatedBy',
      delete_time: 'deleteTime',
    };
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(dto)) {
      const targetKey = map[key] || key;
      result[targetKey] = value;
    }
    return result;
  }

  /** 将 entity 字段格式化为前端需要的 snake_case 格式 */
  private formatArticle(row: ArticleEntity): Record<string, any> {
    return {
      id: Number(row.id),
      category_id: row.categoryId,
      title: row.title,
      author: row.author,
      image: row.image,
      describe: row.describe,
      content: row.content,
      views: row.views,
      is_link: row.isLink,
      link_url: row.linkUrl,
      is_hot: row.isHot,
      sort: row.sort,
      status: row.status,
      create_time: formatDateTime(row.createTime),
      update_time: formatDateTime(row.updateTime),
      delete_time: formatDateTime(row.deleteTime),
    };
  }

  /**
   * 创建文章。接收 DTO 并映射字段，补全创建者与部门 ID 审计信息后保存。
   * @param dto - 创建文章 DTO（snake_case 格式）
   * @param user - 当前操作用户信息
   * @returns 统一响应结果
   */
  async create(dto: CreateArticleDto, user?: UserType['user']) {
    const userId = TenantContext.getUserId() || user?.id;
    const deptId = user?.deptId;
    // 映射 snake_case → camelCase
    const data = this.mapDtoToEntity(dto as any);
    // 补全审计字段
    if (userId) data.createdBy = userId;
    if (deptId) data.deptId = deptId;
    await this.articleRepo.save(withTenantId(data));
    return ResultData.ok();
  }

  /**
   * 分页查询文章列表。支持租户隔离、数据权限过滤（基于角色 dataScope）、
   * 以及关键词、分类、作者、状态等业务条件筛选。
   * @param query - 查询参数（含分页、关键词、分类、作者、状态）
   * @param user - 当前操作用户信息（用于数据权限）
   * @returns 分页结果，含格式化后的文章列表和总数
   */
  async findAll(query: ListArticleDto, user?: UserType['user']) {
    const entity = this.articleRepo.createQueryBuilder('entity');
    entity.where('entity.deleteTime IS NULL');

    // ===== 租户隔离（始终生效） =====
    applyTenantFilter(entity, 'entity');

    // ===== 数据权限过滤（基于角色 dataScope） =====
    if (user) {
      const roles = user.roles;
      const deptIds: number[] = [];
      let dataScopeAll = false;
      let dataScopeSelf = false;

      for (let index = 0; index < roles.length; index++) {
        const role = roles[index];
        if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_ALL) {
          dataScopeAll = true;
          break;
        } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_CUSTOM) {
          const roleWithDeptIds = await this.roleService.findRoleWithDeptIds(role.id);
          deptIds.push(...roleWithDeptIds);
        } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_DEPT || String(role.dataScope) === DataScopeEnum.DATA_SCOPE_DEPT_AND_CHILD) {
          const dataScopeWidthDeptIds = await this.deptService.findDeptIdsByDataScope(user.deptId, String(role.dataScope) as any);
          deptIds.push(...dataScopeWidthDeptIds);
        } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_SELF) {
          dataScopeSelf = true;
        }
      }

      if (!dataScopeAll) {
        const conditions: string[] = [];
        const params: Record<string, any> = {};

        if (deptIds.length > 0) {
          conditions.push('entity.deptId IN (:...dataDeptIds)');
          params.dataDeptIds = deptIds;
        }
        if (dataScopeSelf && user.id) {
          conditions.push('entity.createdBy = :dataUserId');
          params.dataUserId = user.id;
        }

        if (conditions.length > 1) {
          entity.andWhere(`(${conditions.join(' OR ')})`, params);
        } else if (conditions.length === 1) {
          entity.andWhere(conditions[0], params);
        }
      }
    }

    // ===== 业务查询条件 =====
    if (query.keyword) {
      entity.andWhere(
        `(entity.title LIKE "%${query.keyword}%" OR entity.describe LIKE "%${query.keyword}%" OR entity.content LIKE "%${query.keyword}%")`,
      );
    }

    if (query.category_id) {
      entity.andWhere('entity.categoryId = :categoryId', { categoryId: query.category_id });
    }

    if (query.author) {
      entity.andWhere('entity.author LIKE :author', { author: `%${query.author}%` });
    }

    if (query.status !== undefined && query.status !== null) {
      entity.andWhere('entity.status = :status', { status: query.status });
    }

    if (query.pageSize && query.pageNum) {
      entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    entity.orderBy('entity.sort', 'ASC').addOrderBy('entity.createTime', 'DESC');

    const [list, total] = await entity.getManyAndCount();

    return ResultData.ok({
      list: list.map((item) => this.formatArticle(item)),
      total,
    });
  }

  /**
   * 根据 ID 查询单篇文章详情，包含租户隔离与数据权限校验。
   * @param id - 文章 ID
   * @param user - 当前操作用户信息
   * @returns 文章详情或 null
   */
  async findOne(id: number, user?: UserType['user']) {
    const qb = this.articleRepo.createQueryBuilder('entity');
    qb.where('entity.id = :id', { id });
    qb.andWhere('entity.deleteTime IS NULL');
    applyTenantFilter(qb, 'entity');

    if (user) {
      await this.applyDataScope(qb, user);
    }

    const res = await qb.getOne();
    return ResultData.ok(res ? this.formatArticle(res) : null);
  }

  /**
   * 更新文章。先校验数据权限（确保仅可更新自己有权限的文章），
   * 然后更新指定字段，禁止篡改租户/部门/创建者信息。
   * @param dto - 更新文章 DTO（含 id）
   * @param user - 当前操作用户信息
   * @returns 统一响应结果
   */
  async update(dto: UpdateArticleDto, user?: UserType['user']) {
    const userId = TenantContext.getUserId() || user?.id;
    // 映射 snake_case → camelCase
    const data = this.mapDtoToEntity(dto as any);
    if (userId) data.updatedBy = userId;

    // 更新时不允许篡改 tenant_id / dept_id / created_by
    delete data.tenantId;
    delete data.deptId;
    delete data.createdBy;

    // 先校验数据权限
    const qb = this.articleRepo.createQueryBuilder('entity');
    qb.where('entity.id = :id', { id: dto.id });
    qb.andWhere('entity.deleteTime IS NULL');
    applyTenantFilter(qb, 'entity');
    if (user) {
      await this.applyDataScope(qb, user);
    }
    const existing = await qb.getOne();
    if (!existing) {
      return ResultData.fail(403, '无权限操作该文章或文章不存在');
    }

    await this.articleRepo.update({ id: dto.id }, data);
    return ResultData.ok();
  }

  /**
   * 批量软删除文章（逐条校验数据权限后统一 softDelete）。
   * @param ids - 要删除的文章 ID 数组
   * @param user - 当前操作用户信息
   * @returns 统一响应结果
   */
  async remove(ids: number[], user?: UserType['user']) {
    for (const id of ids) {
      const qb = this.articleRepo.createQueryBuilder('entity');
      qb.where('entity.id = :id', { id });
      qb.andWhere('entity.deleteTime IS NULL');
      applyTenantFilter(qb, 'entity');
      if (user) {
        await this.applyDataScope(qb, user);
      }
      const existing = await qb.getOne();
      if (!existing) {
        return ResultData.fail(403, `文章 ${id} 无权限操作或不存在`);
      }
    }
    await this.articleRepo.softDelete(ids);
    return ResultData.ok();
  }

  /**
   * 更新文章状态（如启用/禁用）。先校验数据权限确保操作合法。
   * @param id - 文章 ID
   * @param status - 目标状态值
   * @param user - 当前操作用户信息
   * @returns 统一响应结果
   */
  async updateStatus(id: number, status: number, user?: UserType['user']) {
    const qb = this.articleRepo.createQueryBuilder('entity');
    qb.where('entity.id = :id', { id });
    qb.andWhere('entity.deleteTime IS NULL');
    applyTenantFilter(qb, 'entity');
    if (user) {
      await this.applyDataScope(qb, user);
    }
    const existing = await qb.getOne();
    if (!existing) {
      return ResultData.fail(403, '无权限操作该文章或文章不存在');
    }

    await this.articleRepo.update({ id }, { status } as any);
    return ResultData.ok();
  }

  /** 抽取的数据权限过滤逻辑（复用） */
  private async applyDataScope(entity: any, user: UserType['user']): Promise<void> {
    const roles = user.roles;
    const deptIds: number[] = [];
    let dataScopeAll = false;
    let dataScopeSelf = false;

    for (const role of roles) {
      if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_ALL) {
        dataScopeAll = true;
        break;
      } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_CUSTOM) {
        const roleWithDeptIds = await this.roleService.findRoleWithDeptIds(role.id);
        deptIds.push(...roleWithDeptIds);
      } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_DEPT || String(role.dataScope) === DataScopeEnum.DATA_SCOPE_DEPT_AND_CHILD) {
        const dataScopeWidthDeptIds = await this.deptService.findDeptIdsByDataScope(user.deptId, String(role.dataScope) as any);
        deptIds.push(...dataScopeWidthDeptIds);
      } else if (String(role.dataScope) === DataScopeEnum.DATA_SCOPE_SELF) {
        dataScopeSelf = true;
      }
    }

    if (!dataScopeAll) {
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (deptIds.length > 0) {
        conditions.push('entity.deptId IN (:...dataDeptIds)');
        params.dataDeptIds = deptIds;
      }
      if (dataScopeSelf && user.id) {
        conditions.push('entity.createdBy = :dataUserId');
        params.dataUserId = user.id;
      }

      if (conditions.length > 1) {
        entity.andWhere(`(${conditions.join(' OR ')})`, params);
      } else if (conditions.length === 1) {
        entity.andWhere(conditions[0], params);
      }
    }
  }
}
