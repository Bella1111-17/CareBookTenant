import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base';

@Entity('tenant_caregiver', { comment: '租户护工档案' })
@Index(['tenantId', 'phone'])
@Index(['tenantId', 'orgUnitId'])
export class TenantCaregiverEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键ID' })
  id: number;

  @Column({ type: 'varchar', name: 'real_name', length: 64, comment: '护工姓名' })
  realName: string;

  @Column({ type: 'varchar', name: 'phone', length: 32, default: '', comment: '手机号' })
  phone: string;

  @Column({ type: 'int', name: 'org_unit_id', nullable: true, comment: '所属组织/护理单元ID' })
  orgUnitId: number | null;

  @Column({ type: 'varchar', name: 'qualification', length: 500, default: '', comment: '资质说明' })
  qualification: string;

  @Column({ type: 'varchar', name: 'health_certificate', length: 1000, default: '', comment: '健康证材料' })
  healthCertificate: string;

  @Column({ type: 'jsonb', name: 'skill_tags', default: () => "'[]'", comment: '技能标签' })
  skillTags: string[];
}
