import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base';

@Entity('tenant_org_unit', { comment: '租户组织/护理单元' })
@Index(['tenantId', 'parentId'])
export class TenantOrgUnitEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键ID' })
  id: number;

  @Column({ type: 'int', name: 'parent_id', nullable: true, comment: '父级组织ID' })
  parentId: number | null;

  @Column({ type: 'varchar', name: 'unit_name', length: 100, comment: '组织/护理单元名称' })
  unitName: string;

  @Column({ type: 'int', name: 'sort_order', default: 0, comment: '排序' })
  sortOrder: number;
}
