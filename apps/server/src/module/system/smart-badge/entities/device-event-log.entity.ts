import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('device_event_log', { comment: '工牌设备事件日志(连接/心跳/操控/录音状态)' })
@Index(['deviceNo', 'eventType', 'createdAt'])
@Index(['userId', 'createdAt'])
export class DeviceEventLogEntity {
  @PrimaryGeneratedColumn({ comment: '自增主键' })
  id: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 64, nullable: true, comment: '租户ID' })
  tenantId: string | null;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备号' })
  deviceNo: string;

  @Column({ type: 'int', name: 'user_id', nullable: true, comment: '反查出的护理员ID' })
  userId: number;

  @Column({ type: 'varchar', name: 'event_type', length: 32, comment: '事件类型: connect/heartbeat/control/recording/debug' })
  eventType: string;

  @Column({ type: 'varchar', name: 'event_name', length: 100, nullable: true, comment: '事件名称/操作描述' })
  eventName: string;

  @Column({ type: 'varchar', name: 'event_status', length: 20, nullable: true, comment: '事件结果: success/fail/online/offline' })
  eventStatus: string;

  @Column({ type: 'varchar', name: 'detail', length: 1000, nullable: true, comment: '事件明细描述' })
  detail: string;

  @Column({ type: 'text', name: 'raw_data', nullable: true, comment: '原始推送数据JSON' })
  rawData: string;

  @Column({ type: 'char', name: 'del_flag', default: '0', length: 1, comment: '删除标志(0正常 1删除)' })
  delFlag: string;

  @CreateDateColumn({ name: 'created_at', comment: '系统接收时间' })
  createdAt: Date;
}
