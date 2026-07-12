import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base';

@Entity('badge_device', { comment: '智能工牌设备主档' })
@Index(['deviceNo'], { unique: true })
export class BadgeDeviceEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键' })
  id: number;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备编号' })
  deviceNo: string;

  @Column({ type: 'timestamp', name: 'first_seen_at', nullable: true, comment: '首次接收时间' })
  firstSeenAt: Date;

  @Column({ type: 'timestamp', name: 'last_seen_at', nullable: true, comment: '最近接收时间' })
  lastSeenAt: Date;

  @Column({ type: 'varchar', name: 'last_data_type', length: 32, default: '', comment: '最近一次数据类型' })
  lastDataType: string;
}
