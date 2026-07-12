import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('device_user_binding', { comment: '工牌设备人员绑定历史表' })
@Index(['deviceNo', 'unbindAt'])
@Index(['userId'])
export class DeviceUserBindingEntity {
  @PrimaryGeneratedColumn({ comment: '自增主键' })
  id: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 64, nullable: true, comment: '租户ID' })
  tenantId: string | null;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备硬件编号' })
  deviceNo: string;

  @Column({ type: 'int', name: 'user_id', comment: '绑定的护理人员(用户)ID' })
  userId: number;

  @Column({ type: 'timestamp', name: 'bind_at', comment: '绑定开始时间' })
  bindAt: Date;

  @Column({ type: 'timestamp', name: 'unbind_at', nullable: true, comment: '解绑时间，null表示当前正佩戴' })
  unbindAt: Date;

  @Column({ type: 'char', name: 'del_flag', default: '0', length: 1, comment: '删除标志(0正常 1删除)' })
  delFlag: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
