import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from 'src/common/entities/base';

@Entity('tenant_daily_report', { comment: '租户护工AI日报' })
@Index(['tenantId', 'deviceNo', 'reportDate'], { unique: true })
@Index(['tenantId', 'tenantCaregiverId', 'reportDate'])
export class TenantDailyReportEntity extends TenantBaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '主键ID' })
  id: number;

  @Column({ type: 'int', name: 'tenant_caregiver_id', nullable: true, comment: '租户护工ID' })
  tenantCaregiverId: number | null;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备编号' })
  deviceNo: string;

  @Column({ type: 'date', name: 'report_date', comment: '日报日期' })
  reportDate: string;

  @Column({ type: 'int', name: 'total_chunks', default: 0, comment: '当日成功转写切片数' })
  totalChunks: number;

  @Column({ type: 'int', name: 'total_duration_seconds', default: 0, comment: '录音总时长秒' })
  totalDurationSeconds: number;

  @Column({ type: 'int', name: 'total_speech_seconds', default: 0, comment: '讲话时长秒' })
  totalSpeechSeconds: number;

  @Column({ type: 'text', name: 'asr_payload', nullable: true, comment: '投喂AI的时间轴文本' })
  asrPayload: string | null;

  @Column({ type: 'text', name: 'raw_asr_json_aggregate', nullable: true, comment: '原始ASR聚合JSON' })
  rawAsrJsonAggregate: string | null;

  @Column({ type: 'text', name: 'full_transcript', nullable: true, comment: '清洗后的对话流水' })
  fullTranscript: string | null;

  @Column({ type: 'jsonb', name: 'service_score', nullable: true, comment: '服务质量评分JSON' })
  serviceScore: Record<string, any> | null;

  @Column({ type: 'jsonb', name: 'report_card', nullable: true, comment: '日报卡片结构化数据' })
  reportCard: Record<string, any> | null;

  @Column({ type: 'varchar', name: 'emotion_summary', length: 500, nullable: true, comment: '情绪概述' })
  emotionSummary: string | null;

  @Column({ type: 'text', name: 'summary_text', nullable: true, comment: 'AI生成日报摘要' })
  summaryText: string | null;

  @Column({ type: 'varchar', name: 'generation_status', length: 20, default: 'PENDING', comment: '生成状态' })
  generationStatus: string;

  @Column({ type: 'varchar', name: 'quality_status', length: 20, default: 'NORMAL', comment: '质检状态' })
  qualityStatus: string;
}
