import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenant_badge_binding', { comment: '租户护工与智能工牌绑定关系' })
@Index(['tenantId', 'tenantCaregiverId', 'unbindAt'])
@Index(['tenantId', 'deviceNo', 'unbindAt'])
export class TenantBadgeBindingEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键ID' })
  id: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 64, comment: '租户ID' })
  tenantId: string;

  @Column({ type: 'int', name: 'tenant_caregiver_id', comment: '租户护工ID' })
  tenantCaregiverId: number;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备编号' })
  deviceNo: string;

  @Column({ type: 'timestamp', name: 'bind_at', comment: '绑定时间' })
  bindAt: Date;

  @Column({ type: 'timestamp', name: 'unbind_at', nullable: true, comment: '解绑时间' })
  unbindAt: Date | null;

  @Column({ type: 'varchar', name: 'unbind_reason', length: 500, default: '', comment: '解绑说明' })
  unbindReason: string;

  @Column({ type: 'int', name: 'bind_operator_id', nullable: true, comment: '绑定操作人ID' })
  bindOperatorId: number | null;

  @Column({ type: 'varchar', name: 'bind_operator_name', length: 64, default: '', comment: '绑定操作人名称' })
  bindOperatorName: string;

  @Column({ type: 'int', name: 'unbind_operator_id', nullable: true, comment: '解绑操作人ID' })
  unbindOperatorId: number | null;

  @Column({ type: 'varchar', name: 'unbind_operator_name', length: 64, default: '', comment: '解绑操作人名称' })
  unbindOperatorName: string;

  @Column({ type: 'varchar', name: 'bind_status', length: 20, default: 'BOUND', comment: '绑定状态' })
  bindStatus: string;

  @Column({ type: 'char', name: 'del_flag', default: '0', length: 1, comment: '删除标识' })
  delFlag: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;
}
