import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base';

@Entity('nurse_daily_report', { comment: '护工 AI 日报表' })
@Index(['deviceNo', 'reportDate'], { unique: true })
export class NurseDailyReportEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'int', comment: '自增主键' })
  id: number;

  @Column({ type: 'int', name: 'user_id', default: 0, comment: '护理员/服务人员 ID，0 表示未绑定' })
  userId: number;

  @Column({ type: 'varchar', name: 'device_no', length: 64, comment: '设备序列号 SN' })
  deviceNo: string;

  @Column({ type: 'date', name: 'report_date', comment: '日报日期' })
  reportDate: string;

  @Column({ type: 'int', name: 'total_chunks', default: 0, comment: '当日成功转写切片总数' })
  totalChunks: number;

  @Column({ type: 'int', name: 'total_duration_seconds', default: 0, comment: '录音总时长，单位秒，包含静音' })
  totalDurationSeconds: number;

  @Column({ type: 'int', name: 'total_speech_seconds', default: 0, comment: '真实讲话时长，单位秒' })
  totalSpeechSeconds: number;

  @Column({ type: 'text', name: 'asr_payload', nullable: true, comment: '投喂给 Dify 的整理后时间轴文本' })
  asrPayload: string;

  @Column({ type: 'text', name: 'raw_asr_json_aggregate', nullable: true, comment: '全天切片原始 ASR JSON 聚合' })
  rawAsrJsonAggregate: string;

  @Column({ type: 'text', name: 'full_transcript', nullable: true, comment: 'Dify 清洗后的对话流水' })
  fullTranscript: string;

  @Column({ type: 'jsonb', name: 'service_score', nullable: true, comment: 'Dify 服务质量评分 JSON' })
  serviceScore: Record<string, any>;

  @Column({ type: 'jsonb', name: 'report_card', nullable: true, comment: '报表卡片结构化数据' })
  reportCard: Record<string, any>;

  @Column({ type: 'varchar', name: 'emotion_summary', length: 500, nullable: true, comment: '被护理人全天情绪概述' })
  emotionSummary: string;

  @Column({ type: 'text', name: 'summary_text', nullable: true, comment: 'Dify 生成的日报摘要' })
  summaryText: string;
}
