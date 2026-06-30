import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../../../../common/entities/base';

@Entity('t_taixu_user_profile', { comment: 'TaiXu 用户扩展表' })
export class TaixuUserProfileEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id', comment: '主键' })
  id: number;

  @Column({ type: 'bigint', name: 'tenant_id', comment: '租户ID' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'user_id', comment: '用户ID(sa_system_user.id)' })
  userId: number;

  @Column({ type: 'longtext', name: 'resume', nullable: true, comment: '个人简介' })
  resume: string | null;

  @Column({ type: 'longtext', name: 'photo', nullable: true, comment: '头像(base64等)' })
  photo: string | null;
}

