import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type SystemModuleBindingType = 'owned' | 'required' | 'optional';

@Index('idx_system_module_menu_module', ['moduleCode'])
@Index('uk_system_module_menu_pair', ['moduleCode', 'menuId'], { unique: true })
@Entity('system_module_menu')
export class SystemModuleMenuEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'id' })
  id: number;

  @Column({ type: 'varchar', name: 'module_code', length: 80 })
  moduleCode: string;

  @Column({ type: 'bigint', name: 'menu_id' })
  menuId: number;

  @Column({ type: 'varchar', name: 'binding_type', length: 20, default: 'owned' })
  bindingType: SystemModuleBindingType;
}
