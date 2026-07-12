import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base';

@Entity('audio_record', { comment: '智能工牌录音及文字转写明细表' })
@Index(['deviceNo', 'startTime'])
@Index(['userId', 'startTime'])
@Index(['fileName'], { unique: true })
export class AudioRecordEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn({ comment: '自增主键' })
  id: number;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '工牌设备硬件号' })
  deviceNo: string;

  @Column({ type: 'int', name: 'user_id', nullable: true, comment: '反查出的护理员ID' })
  userId: number;

  @Column({ type: 'varchar', name: 'file_name', length: 255, comment: '原始文件名(唯一键)' })
  fileName: string;

  @Column({ type: 'int', name: 'chunk_index', nullable: true, comment: '切片序号(NULL=合并录音)' })
  chunkIndex: number;

  @Column({ type: 'varchar', name: 'segment_type', length: 1, nullable: true, comment: '录音类型: A自动切片 Z结束切片 NULL合并录音' })
  segmentType: string;

  @Column({ type: 'varchar', name: 'oss_key', length: 500, comment: 'OSS桶内完整Key' })
  ossKey: string;

  @Column({ type: 'varchar', name: 'file_url', length: 1000, comment: 'CDN完整播放URL' })
  fileUrl: string;

  @Column({ type: 'bigint', name: 'size_bytes', nullable: true, comment: '文件大小(Byte)' })
  sizeBytes: number;

  @Column({ type: 'timestamp', name: 'start_time', comment: '录音开始时间' })
  startTime: Date;

  @Column({ type: 'timestamp', name: 'end_time', nullable: true, comment: '录音结束时间' })
  endTime: Date;

  /** 第三方(悦航益)转写状态 — 仅供第三方 AudioText 回调写入，前端不展示 */
  @Column({ type: 'varchar', name: 'transcribe_status', default: 'PENDING', length: 20, comment: '转写状态(第三方)' })
  transcribeStatus: string;

  /** 我们自己的阿里云百炼 ASR 转写状态: PENDING → RUNNING → SUCCESS / FAILED */
  @Column({ type: 'varchar', name: 'asr_status', default: 'PENDING', length: 20, comment: '阿里云百炼ASR转写状态(自有)' })
  asrStatus: string;

  @Column({ type: 'varchar', name: 'isolation_status', default: 'NORMAL', length: 32, comment: '租户隔离状态' })
  isolationStatus: string;

  @Column({ type: 'varchar', name: 'isolation_reason', length: 500, nullable: true, comment: '租户隔离异常原因' })
  isolationReason: string | null;

  /** 转写纯文本 — 仅由我们自己的 ASR 写入（含 Speaker_0/1 说话人标签），第三方不写入此字段 */
  @Column({ type: 'text', name: 'transcript_text', nullable: true, comment: '净化后纯文本(自有ASR写入)' })
  transcriptText: string;

  @Column({ type: 'text', name: 'transcript_raw', nullable: true, comment: '原始转写JSON(自有ASR写入)' })
  transcriptRaw: string;
}
