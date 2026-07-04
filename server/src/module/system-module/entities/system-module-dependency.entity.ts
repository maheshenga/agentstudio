import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Index('idx_system_module_dependency_module', ['moduleCode'])
@Index('uk_system_module_dependency_pair', ['moduleCode', 'dependsOnCode'], { unique: true })
@Entity('system_module_dependency')
export class SystemModuleDependencyEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'varchar', name: 'depends_on_code', length: 80 })
  dependsOnCode: string;

  @Column({ type: 'varchar', name: 'version_range', length: 80, default: '' })
  versionRange: string;

  @Column({ type: 'tinyint', name: 'required', default: 1 })
  required: number;
}
