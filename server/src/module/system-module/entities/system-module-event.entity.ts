import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { SystemModuleEventType } from '../constants';

export type SystemModuleEventStatus = 'success' | 'failed';

@Index('idx_system_module_event_module', ['moduleCode'])
@Index('idx_system_module_event_type', ['eventType'])
@Index('idx_system_module_event_operator', ['operatorId'])
@Entity('system_module_event')
export class SystemModuleEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'event_type', length: 30 })
  eventType: SystemModuleEventType;

  @Column({ type: 'varchar', name: 'status', length: 20 })
  status: SystemModuleEventStatus;

  @Column({ type: 'varchar', name: 'message', length: 500, default: '' })
  message: string;

  @Column({ type: 'json', name: 'metadata', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'bigint', name: 'operator_id', nullable: true })
  operatorId?: number;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;
}
