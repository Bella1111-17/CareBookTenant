import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('device_tenant_binding', { comment: '设备与租户分发历史表' })
@Index(['deviceNo', 'unbindAt'])
@Index(['tenantId', 'unbindAt'])
export class DeviceTenantBindingEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键ID' })
  id: number;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备编号' })
  deviceNo: string;

  @Column({ type: 'varchar', name: 'tenant_id', length: 64, comment: '租户ID' })
  tenantId: string;

  @Column({ type: 'timestamp', name: 'bind_at', comment: '分发时间' })
  bindAt: Date;

  @Column({ type: 'timestamp', name: 'unbind_at', nullable: true, comment: '收回时间' })
  unbindAt: Date | null;

  @Column({ type: 'varchar', name: 'unbind_reason', length: 500, default: '', comment: '收回/转分发说明' })
  unbindReason: string;

  @Column({ type: 'int', name: 'bind_operator_id', nullable: true, comment: '分发操作人ID' })
  bindOperatorId: number | null;

  @Column({ type: 'varchar', name: 'bind_operator_name', length: 64, default: '', comment: '分发操作人名称' })
  bindOperatorName: string;

  @Column({ type: 'int', name: 'unbind_operator_id', nullable: true, comment: '收回操作人ID' })
  unbindOperatorId: number | null;

  @Column({ type: 'varchar', name: 'unbind_operator_name', length: 64, default: '', comment: '收回操作人名称' })
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
