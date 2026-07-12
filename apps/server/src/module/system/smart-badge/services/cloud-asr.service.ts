import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

// ============ DashScope ASR 接口类型 ============

interface AsrSubmitResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: string;
    message?: string;
  };
}

interface AsrTaskResponse {
  request_id: string;
  output: {
    task_id: string;
    task_status: string;
    results?: Array<{ transcription_url: string; subtask_status: string }>;
    message?: string;
  };
}

interface AsrSentence {
  begin_time: number;
  end_time: number;
  text: string;
  speaker_id?: number;
  language?: string;
  emotion?: string;
}

interface AsrTranscriptionResult {
  transcripts: Array<{
    sentences: AsrSentence[];
  }>;
}

// ============ 服务返回类型 ============

export interface AsrResult {
  /** 格式化文本: Speaker_0: xxx\nSpeaker_1: yyy */
  text: string;
  /** 原始 JSON */
  rawJson: string;
  /** 句子列表（含说话人、时间戳） */
  sentences: AsrSentence[];
  /** 任务 ID */
  taskId: string;
}

/**
 * 阿里云百炼 DashScope 语音识别服务
 *
 * 使用 fun-asr 模型（非实时异步转写）：
 * - 支持说话人分离 (diarization)
 * - 支持中英双语 + 方言
 * - 单个文件最长 12 小时 / 2GB
 *
 * 流程: 提交任务 → 轮询等待 → 下载结果 JSON → 解析多人口白文本
 */
@Injectable()
export class CloudAsrService {
  private readonly logger = new Logger(CloudAsrService.name);

  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxRetries = 60;
  private readonly pollInterval = 3000;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.apiKey = this.config.get<string>('dashscope.apiKey') || '';
    this.model = this.config.get<string>('dashscope.asrModel') || 'fun-asr';
    this.baseUrl = this.config.get<string>('dashscope.baseUrl') || 'https://dashscope.aliyuncs.com';

    if (!this.apiKey || this.apiKey === 'sk-your-dashscope-api-key') {
      this.logger.warn('DashScope API Key 未配置或为占位值，语音识别将不可用。请在 config/*.yml 中设置 dashscope.apiKey');
    }
  }

  /**
   * 提交音频文件进行语音识别
   * @param audioUrl 公网可访问的音频文件 URL
   */
  async transcribe(audioUrl: string): Promise<AsrResult> {
    this.assertConfigured();

    // 1. 提交异步转写任务
    const taskId = await this.submitTask(audioUrl);
    this.logger.log(`[ASR] 任务已提交: ${taskId}`);

    // 2. 轮询直到完成
    const transcriptionUrl = await this.pollTask(taskId);
    this.logger.log(`[ASR] 任务 ${taskId} 已完成，下载结果中...`);

    // 3. 下载并解析转录 JSON
    const { text, rawJson, sentences } = await this.downloadAndParse(transcriptionUrl);
    this.logger.log(`[ASR] 解析完成: ${sentences.length} 句, ${text.length} 字符`);

    return { text, rawJson, sentences, taskId };
  }

  // ============ 私有方法 ============

  private assertConfigured() {
    if (!this.apiKey || this.apiKey === 'sk-your-dashscope-api-key') {
      throw new Error('DashScope API Key 未配置');
    }
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  /** 步骤1: 提交转写任务 */
  private async submitTask(audioUrl: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<AsrSubmitResponse>(
        `${this.baseUrl}/api/v1/services/audio/asr/transcription`,
        {
          model: this.model,
          input: { file_urls: [audioUrl] },
          parameters: {
            diarization_enabled: true,
            channel_id: [0],
            language_hints: ['zh', 'en'],
          },
        },
        {
          headers: {
            ...this.authHeaders(),
            'Content-Type': 'application/json',
            'X-DashScope-Async': 'enable',
          },
        },
      ),
    );

    const taskId = res.data?.output?.task_id;
    if (!taskId) {
      throw new Error(`[ASR] 任务提交失败: ${JSON.stringify(res.data)}`);
    }
    return taskId;
  }

  /** 步骤2: 轮询任务状态 */
  private async pollTask(taskId: string): Promise<string> {
    for (let i = 0; i < this.maxRetries; i++) {
      await this.sleep(this.pollInterval);

      const res = await firstValueFrom(
        this.http.get<AsrTaskResponse>(`${this.baseUrl}/api/v1/tasks/${taskId}`, {
          headers: {
            ...this.authHeaders(),
            'X-DashScope-Async': 'enable',
          },
        }),
      );

      const status = res.data?.output?.task_status;
      this.logger.debug(`[ASR] 轮询 ${i + 1}: ${status}`);

      if (status === 'SUCCEEDED') {
        const url = res.data?.output?.results?.[0]?.transcription_url;
        if (!url) throw new Error(`[ASR] 任务完成但缺少 transcription_url`);
        return url;
      }

      if (status === 'FAILED' || status === 'CANCELED') {
        throw new Error(`[ASR] 任务失败: ${res.data?.output?.message || status}`);
      }
    }

    throw new Error(`[ASR] 轮询超时 (${(this.maxRetries * this.pollInterval) / 1000}s)`);
  }

  /** 步骤3: 下载转录 JSON 并解析 */
  private async downloadAndParse(url: string) {
    const res = await firstValueFrom(this.http.get<AsrTranscriptionResult>(url));
    const rawJson = JSON.stringify(res.data);

    const sentences: AsrSentence[] = [];
    const lines: string[] = [];

    for (const t of res.data?.transcripts || []) {
      for (const s of t.sentences || []) {
        if (s.text?.trim()) {
          sentences.push(s);
          const speaker = s.speaker_id !== undefined ? `Speaker_${s.speaker_id}` : 'Unknown';
          lines.push(`${speaker}: ${s.text.trim()}`);
        }
      }
    }

    return { text: lines.join('\n'), rawJson, sentences };
  }

  private sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
  }
}
