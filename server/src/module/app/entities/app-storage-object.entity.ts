import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppStorageObjectStatus = 'active' | 'deleted' | 'expired';

@Index('uk_app_storage_object_id', ['objectId'], { unique: true })
@Index('idx_app_storage_object_scope', ['tenantId', 'appId', 'status'])
@Index('idx_app_storage_object_expiry', ['tenantId', 'appId', 'expiresTime'])
@Entity('app_storage_object')
export class AppStorageObjectEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'object_id', length: 43 })
  objectId: string;

  @Column({ type: 'bigint', name: 'tenant_id' })
  tenantId: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'owner_user_id' })
  ownerUserId: number;

  @Column({ type: 'varchar', name: 'storage_key', length: 255 })
  storageKey: string;

  @Column({ type: 'varchar', name: 'original_name', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', name: 'mime_type', length: 120 })
  mimeType: string;

  @Column({ type: 'bigint', name: 'size_byte', unsigned: true })
  sizeByte: number;

  @Column({ type: 'char', name: 'checksum', length: 64 })
  checksum: string;

  @Column({ type: 'varchar', name: 'status', length: 20, default: 'active' })
  status: AppStorageObjectStatus;

  @Column({ type: 'datetime', name: 'expires_time', nullable: true })
  expiresTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
