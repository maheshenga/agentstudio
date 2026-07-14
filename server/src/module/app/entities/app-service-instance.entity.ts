import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type AppServiceInstanceRole = 'candidate' | 'active' | 'standby' | 'retired';
export type AppServiceProcessStatus = 'starting' | 'online' | 'stopped' | 'failed';
export type AppServiceHealthStatus = 'unknown' | 'checking' | 'healthy' | 'unhealthy';
export type AppServiceCircuitState = 'closed' | 'open' | 'half_open';
export type AppServiceRuntimeDriverName = 'pm2' | 'podman';

@Index('uk_app_service_instance_process', ['processName'], { unique: true })
@Index('idx_app_service_instance_app_role', ['appId', 'role'])
@Index('idx_app_service_instance_health', ['healthStatus', 'processStatus'])
@Index('idx_app_service_instance_driver_status', ['runtimeDriver', 'processStatus'])
@Entity('app_service_instance')
export class AppServiceInstanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'bigint', name: 'app_id' })
  appId: number;

  @Column({ type: 'bigint', name: 'version_id' })
  versionId: number;

  @Column({ type: 'varchar', name: 'release_dir', length: 500 })
  releaseDir: string;

  @Column({ type: 'varchar', name: 'process_name', length: 100 })
  processName: string;

  @Column({ type: 'int', name: 'loopback_port', unsigned: true })
  loopbackPort: number;

  @Column({ type: 'varchar', name: 'runtime_driver', length: 20, default: 'pm2' })
  runtimeDriver: AppServiceRuntimeDriverName;

  @Column({ type: 'varchar', name: 'role', length: 20, default: 'candidate' })
  role: AppServiceInstanceRole;

  @Column({ type: 'varchar', name: 'process_status', length: 20, default: 'stopped' })
  processStatus: AppServiceProcessStatus;

  @Column({ type: 'varchar', name: 'health_status', length: 20, default: 'unknown' })
  healthStatus: AppServiceHealthStatus;

  @Column({ type: 'int', name: 'restart_count', unsigned: true, default: 0 })
  restartCount: number;

  @Column({ type: 'int', name: 'consecutive_failures', unsigned: true, default: 0 })
  consecutiveFailures: number;

  @Column({ type: 'varchar', name: 'circuit_state', length: 20, default: 'closed' })
  circuitState: AppServiceCircuitState;

  @Column({ type: 'datetime', name: 'circuit_open_until', nullable: true })
  circuitOpenUntil?: Date | null;

  @Column({ type: 'int', name: 'active_invocations', unsigned: true, default: 0 })
  activeInvocations: number;

  @Column({ type: 'datetime', name: 'last_invoke_time', nullable: true })
  lastInvokeTime?: Date | null;

  @Column({ type: 'datetime', name: 'last_success_time', nullable: true })
  lastSuccessTime?: Date | null;

  @Column({ type: 'datetime', name: 'last_health_time', nullable: true })
  lastHealthTime?: Date | null;

  @Column({ type: 'varchar', name: 'last_error_code', length: 80, default: '' })
  lastErrorCode: string;

  @Column({ type: 'varchar', name: 'last_error_message', length: 500, default: '' })
  lastErrorMessage: string;

  @Column({ type: 'datetime', name: 'started_time', nullable: true })
  startedTime?: Date | null;

  @Column({ type: 'datetime', name: 'stopped_time', nullable: true })
  stoppedTime?: Date | null;

  @CreateDateColumn({ type: 'datetime', name: 'create_time', nullable: true })
  createTime?: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'update_time', nullable: true })
  updateTime?: Date;
}
