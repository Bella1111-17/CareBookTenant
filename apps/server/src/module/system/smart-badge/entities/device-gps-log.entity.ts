import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('device_gps_log', { comment: '工牌设备GPS定位日志' })
@Index(['deviceNo', 'createdAt'])
@Index(['userId', 'createdAt'])
export class DeviceGpsLogEntity {
  @PrimaryGeneratedColumn({ comment: '自增主键' })
  id: number;

  @Column({ type: 'varchar', name: 'tenant_id', length: 64, nullable: true, comment: '租户ID' })
  tenantId: string | null;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备号' })
  deviceNo: string;

  @Column({ type: 'int', name: 'user_id', nullable: true, comment: '反查出的护理员ID' })
  userId: number;

  @Column({ type: 'decimal', name: 'latitude', precision: 10, scale: 7, nullable: true, comment: '纬度' })
  latitude: number;

  @Column({ type: 'decimal', name: 'longitude', precision: 10, scale: 7, nullable: true, comment: '经度' })
  longitude: number;

  @Column({ type: 'decimal', name: 'altitude', precision: 8, scale: 2, nullable: true, comment: '海拔(米)' })
  altitude: number;

  @Column({ type: 'decimal', name: 'speed', precision: 8, scale: 2, nullable: true, comment: '速度(km/h)' })
  speed: number;

  @Column({ type: 'varchar', name: 'location_type', length: 20, nullable: true, comment: '定位类型: GPS/WIFI/LBS' })
  locationType: string;

  @Column({ type: 'timestamp', name: 'report_time', nullable: true, comment: '设备上报时间' })
  reportTime: Date;

  @Column({ type: 'varchar', name: 'address', length: 500, nullable: true, comment: '逆地理编码地址' })
  address: string;

  @Column({ type: 'varchar', name: 'raw_data', length: 2000, nullable: true, comment: '原始推送数据JSON' })
  rawData: string;

  @Column({ type: 'char', name: 'del_flag', default: '0', length: 1, comment: '删除标志(0正常 1删除)' })
  delFlag: string;

  @CreateDateColumn({ name: 'created_at', comment: '系统接收时间' })
  createdAt: Date;
}
