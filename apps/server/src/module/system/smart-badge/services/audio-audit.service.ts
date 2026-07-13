import { Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { Agent } from 'https';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { NurseDailyReportEntity } from '../entities/nurse-daily-report.entity';
import { AudioRecordEntity } from '../entities/audio-record.entity';
import { buildReportCard } from './report-card.builder';

@Injectable()
export class AudioAuditService {
  private readonly logger = new Logger(AudioAuditService.name);
  private static readonly MAX_TIMELINE_TEXT_LENGTH = 20000;

  constructor(
    @InjectRepository(NurseDailyReportEntity) private readonly reportRepo: Repository<NurseDailyReportEntity>,
    @InjectRepository(AudioRecordEntity) private readonly audioRepo: Repository<AudioRecordEntity>,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async generateDailyReport(deviceNo: string, dateStr: string) {
    const chunks = await this.fetchChunks(deviceNo, dateStr);
    if (chunks.length === 0) {
      throw new Error(`设备 ${deviceNo} 在 ${dateStr} 没有可用的转写切片`);
    }
    if (chunks.some((chunk) => chunk.asrStatus === 'RUNNING')) {
      throw new Error('仍有切片在转写中，请稍后重试');
    }

    const metrics = this.computeMetrics(chunks);
    let report = await this.reportRepo.findOne({ where: { deviceNo, reportDate: dateStr } });
    if (!report) {
      const foundUserId = chunks.find((chunk) => chunk.userId)?.userId || 0;
      report = this.reportRepo.create({ userId: foundUserId, deviceNo, reportDate: dateStr });
    }

    report.totalChunks = metrics.totalChunks;
    report.totalDurationSeconds = metrics.totalDurationSeconds;
    report.totalSpeechSeconds = metrics.totalSpeechSeconds;
    await this.reportRepo.save(report);
    this.logger.log(`[审计] 设备 ${deviceNo} ${dateStr} 指标已落库`);

    this.fillReportWithAI(deviceNo, dateStr, chunks).catch((err) => {
      this.logger.error(`[审计] 设备 ${deviceNo} Dify 填充失败: ${err.message}`);
    });

    return report;
  }

  private async fetchChunks(deviceNo: string, dateStr: string) {
    const dayStart = dayjs(dateStr).startOf('day').toDate();
    const dayEnd = dayjs(dateStr).endOf('day').toDate();
    return this.audioRepo
      .createQueryBuilder('a')
      .where('a.deviceNo = :deviceNo', { deviceNo })
      .andWhere('a.startTime >= :dayStart AND a.startTime <= :dayEnd', { dayStart, dayEnd })
      .andWhere('a.asrStatus = :status', { status: 'SUCCESS' })
      .andWhere('a.chunkIndex IS NOT NULL')
      .andWhere('a.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('a.startTime', 'ASC')
      .getMany();
  }

  private computeMetrics(chunks: AudioRecordEntity[]) {
    let totalDurationSeconds = 0;
    let totalSpeechSeconds = 0;

    for (const chunk of chunks) {
      if (chunk.startTime && chunk.endTime) {
        totalDurationSeconds += dayjs(chunk.endTime).diff(dayjs(chunk.startTime), 'second');
      }

      if (!chunk.transcriptRaw) continue;
      try {
        const raw = JSON.parse(chunk.transcriptRaw);
        for (const item of raw.transcripts || []) {
          totalSpeechSeconds += Math.floor((item.content_duration_in_milliseconds || 0) / 1000);
        }
      } catch {
        // ignore invalid raw json
      }
    }

    return {
      totalChunks: chunks.length,
      totalDurationSeconds,
      totalSpeechSeconds,
    };
  }

  private buildTimelineText(deviceNo: string, dateStr: string, chunks: AudioRecordEntity[]) {
    const sections = ['# 护工日报分析输入', `日期: ${dateStr}`, `设备: ${deviceNo}`, `切片数: ${chunks.length}`, ''];

    chunks.forEach((chunk, index) => {
      if (!chunk.transcriptText) return;
      const startStr = dayjs(chunk.startTime).format('HH:mm:ss');
      const endStr = chunk.endTime ? dayjs(chunk.endTime).format('HH:mm:ss') : '?';
      sections.push(`--- 切片 ${index + 1} ---`);
      sections.push(`文件名: ${chunk.fileName || '-'}`);
      sections.push(`时间段: ${startStr} - ${endStr}`);
      sections.push('转写文本:');
      sections.push(chunk.transcriptText);
      sections.push('');
    });

    return sections.join('\n');
  }

  private trimTimelineText(text: string) {
    const normalized = String(text || '').trim();
    if (normalized.length <= AudioAuditService.MAX_TIMELINE_TEXT_LENGTH) {
      return normalized;
    }

    const headLength = Math.floor(AudioAuditService.MAX_TIMELINE_TEXT_LENGTH * 0.65);
    const tailLength = AudioAuditService.MAX_TIMELINE_TEXT_LENGTH - headLength - 32;
    return `${normalized.slice(0, headLength)}\n\n...[中间内容已截断]...\n\n${normalized.slice(-tailLength)}`;
  }

  private buildRawJsonAggregate(chunks: AudioRecordEntity[]) {
    return JSON.stringify(
      chunks
        .filter((chunk) => chunk.transcriptRaw)
        .map((chunk) => {
          let rawObj: any = chunk.transcriptRaw;
          try {
            rawObj = JSON.parse(chunk.transcriptRaw);
          } catch {
            // keep the raw string
          }

          return {
            file_name: chunk.fileName,
            start_time: dayjs(chunk.startTime).format('HH:mm:ss'),
            aliyun_raw: rawObj,
          };
        }),
    );
  }

  private parseWorkflowOutput(raw: any) {
    if (typeof raw !== 'string') return raw || {};
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private normalizeWorkflowPayload(output: any) {
    const analysisPayload = output?.analysis_payload && typeof output.analysis_payload === 'object' ? output.analysis_payload : {};
    const scorePayload = output?.score_payload && typeof output.score_payload === 'object' ? output.score_payload : {};
    const cleanedTranscript = String(output?.cleaned_transcript || '').trim();
    return {
      cleanedTranscript,
      summaryText: String(analysisPayload.summary || '').trim(),
      emotionSummary: String(analysisPayload.emotionSummary || '').trim(),
      serviceScore: scorePayload.serviceScore || null,
      reportCard: buildReportCard({
        analysisPayload,
        scorePayload,
        cleanedTranscript,
      }),
    };
  }

  private async fillReportWithAI(deviceNo: string, dateStr: string, chunks: AudioRecordEntity[]) {
    const timelineText = this.trimTimelineText(this.buildTimelineText(deviceNo, dateStr, chunks));
    if (!timelineText.trim()) {
      this.logger.warn(`[审计] 设备 ${deviceNo} 没有可投喂的文本`);
      return;
    }

    const rawJsonAgg = this.buildRawJsonAggregate(chunks);
    await this.reportRepo.update(
      { deviceNo, reportDate: dateStr },
      {
        asrPayload: timelineText,
        rawAsrJsonAggregate: rawJsonAgg,
      },
    );

    const apiKey = this.config.get<string>('dify.badgeDailyReportKey') || '';
    const baseUrl = this.config.get<string>('dify.baseUrl') || 'http://8.153.70.109/v1';
    if (!apiKey || apiKey === 'app-xxxxxxxxxxxxxxxx') {
      this.logger.warn('[审计] TOB_DIFY_BADGE_DAILY_REPORT_KEY 未配置，跳过 AI 报表生成');
      return;
    }
    if (/^https?:\/\//i.test(apiKey)) {
      this.logger.warn('[审计] Dify Key 不能是 URL，请把 http://8.153.70.109/v1 配到 TOB_DIFY_BASE_URL，把 app- 开头的应用 Key 配到 TOB_DIFY_BADGE_DAILY_REPORT_KEY');
      return;
    }

    this.logger.log(`[审计] 设备 ${deviceNo} 准备投喂 Dify，文本长度 ${timelineText.length}`);
    const res = await firstValueFrom(
      this.http.post(
        `${baseUrl}/workflows/run`,
        {
          inputs: {
            chat_history: timelineText,
            date_str: dateStr,
            device_no: deviceNo,
            relation_source: 'offline',
          },
          response_mode: 'blocking',
          user: `report_task_${deviceNo}_${dateStr}`,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          httpsAgent: new Agent({ family: 4 }),
          timeout: 120000,
        },
      ),
    );

    const outputs = res.data?.data?.outputs || {};
    const output = this.parseWorkflowOutput(outputs.result ?? outputs);
    const normalized = this.normalizeWorkflowPayload(output);

    await this.reportRepo.update(
      { deviceNo, reportDate: dateStr },
      {
        fullTranscript: normalized.cleanedTranscript,
        summaryText: normalized.summaryText,
        serviceScore: normalized.serviceScore || null,
        reportCard: normalized.reportCard as any,
        emotionSummary: normalized.emotionSummary,
        updateTime: new Date(),
      },
    );
    this.logger.log(`[审计] 设备 ${deviceNo} Dify 报表生成完成`);
  }

  async batchGenerateDailyReports(dateStr: string) {
    this.logger.warn(`[审计] 批量生成日报已临时停用，跳过日期 ${dateStr}`);
    return { successCount: 0, failCount: 0, disabled: true };
  }
}
