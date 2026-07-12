import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Agent } from 'https';
import dayjs from 'dayjs';
import { IsNull, Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { TenantContextService } from 'src/common/tenant/tenant-context.service';
import { applyTenantScope } from 'src/common/tenant/tenant-query';
import { AudioRecordEntity } from 'src/module/system/smart-badge/entities/audio-record.entity';
import { BadgeDeviceEntity } from 'src/module/system/smart-badge/entities/badge-device.entity';
import { buildReportCard } from 'src/module/system/smart-badge/services/report-card.builder';
import {
  BindTenantBadgeDto,
  CreateTenantCaregiverDto,
  CreateTenantDeviceDto,
  CreateTenantOrgUnitDto,
  GenerateTenantDailyReportDto,
  ListTenantBindingDto,
  ListTenantCaregiverDto,
  ListTenantDailyReportDto,
  ListTenantRecordDto,
  TenantScopedPagingDto,
  UnbindTenantBadgeDto,
  UpdateTenantCaregiverDto,
  UpdateTenantDeviceDto,
  UpdateTenantOrgUnitDto,
} from './dto';
import { TenantBadgeBindingEntity } from './entities/tenant-badge-binding.entity';
import { TenantCaregiverEntity } from './entities/tenant-caregiver.entity';
import { TenantDailyReportEntity } from './entities/tenant-daily-report.entity';
import { TenantOrgUnitEntity } from './entities/tenant-org-unit.entity';

@Injectable()
export class TenantCareService {
  private readonly logger = new Logger(TenantCareService.name);
  private static readonly MAX_TIMELINE_TEXT_LENGTH = 20000;

  constructor(
    @InjectRepository(TenantCaregiverEntity) private readonly caregiverRepo: Repository<TenantCaregiverEntity>,
    @InjectRepository(TenantOrgUnitEntity) private readonly orgUnitRepo: Repository<TenantOrgUnitEntity>,
    @InjectRepository(TenantBadgeBindingEntity) private readonly bindingRepo: Repository<TenantBadgeBindingEntity>,
    @InjectRepository(TenantDailyReportEntity) private readonly reportRepo: Repository<TenantDailyReportEntity>,
    @InjectRepository(BadgeDeviceEntity) private readonly deviceRepo: Repository<BadgeDeviceEntity>,
    @InjectRepository(AudioRecordEntity) private readonly audioRepo: Repository<AudioRecordEntity>,
    private readonly tenantContextService: TenantContextService,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private normalizeDeviceNo(deviceNo: string): string {
    return String(deviceNo || '')
      .trim()
      .toUpperCase();
  }

  private page(qb: any, query: { pageNum?: number; pageSize?: number }) {
    if (query.pageSize && query.pageNum) {
      const pageSize = Number(query.pageSize);
      const pageNum = Number(query.pageNum);
      qb.skip(pageSize * (pageNum - 1)).take(pageSize);
    }
    return qb;
  }

  private resolveWriteTenantId(requestedTenantId?: string | null): string {
    const cleanRequestedTenantId = String(requestedTenantId || '').trim();
    if (this.tenantContextService.isPlatformUser()) {
      if (!cleanRequestedTenantId) {
        throw new BadRequestException('平台管理员写入租户业务数据时必须传 tenantId');
      }
      return cleanRequestedTenantId;
    }

    const tenantId = this.tenantContextService.getTenantId();
    if (!tenantId) {
      throw new ForbiddenException('租户上下文缺失');
    }
    if (cleanRequestedTenantId && cleanRequestedTenantId !== tenantId) {
      throw new ForbiddenException('不能写入其他租户数据');
    }
    return tenantId;
  }

  private ensureTenantAccess(tenantId?: string | null) {
    if (this.tenantContextService.isPlatformUser()) return;
    const currentTenantId = this.tenantContextService.getTenantId();
    if (!currentTenantId || tenantId !== currentTenantId) {
      throw new ForbiddenException('无权访问其他租户数据');
    }
  }

  private attachReportCard<T extends TenantDailyReportEntity>(report: T): T & { reportCard: Record<string, any> } {
    if (!report) return report as T & { reportCard: Record<string, any> };
    return {
      ...report,
      reportCard: buildReportCard({
        analysisPayload: report.reportCard?.analysisPayload,
        scorePayload: report.reportCard?.scorePayload,
        cleanedTranscript: report.fullTranscript,
      }),
    };
  }

  async createOrgUnit(dto: CreateTenantOrgUnitDto) {
    const tenantId = this.resolveWriteTenantId(dto.tenantId);
    const entity = this.orgUnitRepo.create({
      tenantId,
      unitName: dto.unitName.trim(),
      parentId: dto.parentId ?? null,
      sortOrder: dto.sortOrder ?? 0,
      status: dto.status || '0',
    });
    await this.orgUnitRepo.save(entity);
    return ResultData.ok(entity, '新增护理单元成功');
  }

  async updateOrgUnit(dto: UpdateTenantOrgUnitDto) {
    const entity = await this.orgUnitRepo.findOne({ where: { id: dto.id, delFlag: '0' } });
    if (!entity) return ResultData.fail(404, '护理单元不存在');
    this.ensureTenantAccess(entity.tenantId);
    entity.unitName = dto.unitName.trim();
    entity.parentId = dto.parentId ?? null;
    entity.sortOrder = dto.sortOrder ?? 0;
    entity.status = dto.status || entity.status || '0';
    await this.orgUnitRepo.save(entity);
    return ResultData.ok(entity, '更新护理单元成功');
  }

  async listOrgUnits(query: TenantScopedPagingDto) {
    const qb = this.orgUnitRepo.createQueryBuilder('o').where('o.delFlag = :delFlag', { delFlag: '0' }).orderBy('o.sortOrder', 'ASC').addOrderBy('o.id', 'ASC');
    applyTenantScope(qb, 'o', this.tenantContextService, { requestedTenantId: query.tenantId });
    const [list, total] = await qb.getManyAndCount();
    return ResultData.ok({ list, total });
  }

  async createCaregiver(dto: CreateTenantCaregiverDto) {
    const tenantId = this.resolveWriteTenantId(dto.tenantId);
    const entity = this.caregiverRepo.create({
      tenantId,
      realName: dto.realName.trim(),
      phone: dto.phone?.trim() || '',
      orgUnitId: dto.orgUnitId ?? null,
      status: dto.status || '0',
      qualification: dto.qualification?.trim() || '',
      healthCertificate: dto.healthCertificate?.trim() || '',
      skillTags: dto.skillTags || [],
      remark: dto.remark?.trim() || '',
    });
    await this.caregiverRepo.save(entity);
    return ResultData.ok(entity, '新增租户护工成功');
  }

  async updateCaregiver(dto: UpdateTenantCaregiverDto) {
    const entity = await this.caregiverRepo.findOne({ where: { id: dto.id, delFlag: '0' } });
    if (!entity) return ResultData.fail(404, '租户护工不存在');
    this.ensureTenantAccess(entity.tenantId);
    entity.realName = dto.realName.trim();
    entity.phone = dto.phone?.trim() || '';
    entity.orgUnitId = dto.orgUnitId ?? null;
    entity.status = dto.status || entity.status || '0';
    entity.qualification = dto.qualification?.trim() || '';
    entity.healthCertificate = dto.healthCertificate?.trim() || '';
    entity.skillTags = dto.skillTags || [];
    entity.remark = dto.remark?.trim() || '';
    await this.caregiverRepo.save(entity);
    return ResultData.ok(entity, '更新租户护工成功');
  }

  async listCaregivers(query: ListTenantCaregiverDto) {
    const qb = this.caregiverRepo
      .createQueryBuilder('c')
      .leftJoin(TenantOrgUnitEntity, 'o', 'o.id = c.orgUnitId')
      .select(['c', 'o.unitName AS orgUnitName'])
      .where('c.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('c.createTime', 'DESC');
    applyTenantScope(qb, 'c', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.keyword) qb.andWhere('(c.realName LIKE :keyword OR c.phone LIKE :keyword)', { keyword: `%${query.keyword}%` });
    if (query.orgUnitId) qb.andWhere('c.orgUnitId = :orgUnitId', { orgUnitId: query.orgUnitId });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });

    const countQb = qb.clone();
    this.page(qb, query);
    const [rows, total] = await Promise.all([qb.getRawAndEntities(), countQb.getCount()]);
    const list = rows.entities.map((item, index) => ({
      ...item,
      orgUnitName: rows.raw[index]?.orgUnitName || rows.raw[index]?.orgunitname || '',
    }));
    return ResultData.ok({ list, total });
  }

  async deleteCaregiver(id: number) {
    const caregiver = await this.caregiverRepo.findOne({ where: { id, delFlag: '0' } });
    if (!caregiver) return ResultData.fail(404, '租户护工不存在');
    this.ensureTenantAccess(caregiver.tenantId);

    const activeBinding = await this.bindingRepo.findOne({
      where: {
        tenantId: caregiver.tenantId,
        tenantCaregiverId: id,
        unbindAt: IsNull(),
        delFlag: '0',
      },
    });
    if (activeBinding) {
      return ResultData.fail(400, '护工存在当前有效工牌绑定，请先解绑再删除');
    }

    await this.caregiverRepo.update({ id }, { delFlag: '1', updateTime: new Date() });
    return ResultData.ok(null, '删除成功');
  }

  async createDevice(dto: CreateTenantDeviceDto) {
    const tenantId = this.resolveWriteTenantId(dto.tenantId);
    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    if (!deviceNo) return ResultData.fail(400, '设备编号不能为空');

    const exists = await this.deviceRepo.findOne({ where: { deviceNo } });
    if (exists && exists.delFlag === '0') return ResultData.fail(400, `设备已存在: ${deviceNo}`);
    if (exists && exists.delFlag === '1') return ResultData.fail(400, `设备 ${deviceNo} 已删除，请联系平台恢复或更换编号`);

    const entity = this.deviceRepo.create({
      tenantId,
      deviceNo,
      firstSeenAt: null,
      lastSeenAt: null,
      lastDataType: '',
      status: dto.status || '0',
      remark: dto.remark?.trim() || '',
    });
    await this.deviceRepo.save(entity);
    return ResultData.ok(entity, '新增设备成功');
  }

  async updateDevice(dto: UpdateTenantDeviceDto) {
    const device = await this.deviceRepo.findOne({ where: { id: dto.id, delFlag: '0' } });
    if (!device) return ResultData.fail(404, '设备不存在');
    this.ensureTenantAccess(device.tenantId);

    const requestedTenantId = String(dto.tenantId || '').trim();
    if (requestedTenantId && requestedTenantId !== device.tenantId) {
      if (!this.tenantContextService.isPlatformUser()) return ResultData.fail(403, '不能修改其他租户设备');
      device.tenantId = requestedTenantId;
    }

    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    if (!deviceNo) return ResultData.fail(400, '设备编号不能为空');
    const duplicate = await this.deviceRepo.findOne({ where: { deviceNo } });
    if (duplicate && duplicate.id !== device.id) return ResultData.fail(400, `设备已存在: ${deviceNo}`);

    device.deviceNo = deviceNo;
    device.status = dto.status || device.status || '0';
    device.remark = dto.remark?.trim() || '';
    await this.deviceRepo.save(device);
    return ResultData.ok(device, '更新设备成功');
  }

  async listDevices(query: TenantScopedPagingDto & { deviceNo?: string; bindingStatus?: string }) {
    const qb = this.deviceRepo.createQueryBuilder('d').where('d.delFlag = :delFlag', { delFlag: '0' }).orderBy('d.createTime', 'DESC');
    applyTenantScope(qb, 'd', this.tenantContextService, { requestedTenantId: query.tenantId });
    if (query.deviceNo) qb.andWhere('d.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });

    const countQb = qb.clone();
    this.page(qb, query);
    const [devices, total] = await Promise.all([qb.getMany(), countQb.getCount()]);
    const deviceNos = devices.map((item) => item.deviceNo);
    const bindings = deviceNos.length
      ? await this.bindingRepo
          .createQueryBuilder('b')
          .leftJoin(TenantCaregiverEntity, 'c', 'c.id = b.tenantCaregiverId')
          .select([
            'b.tenantId AS tenantId',
            'b.deviceNo AS deviceNo',
            'b.tenantCaregiverId AS tenantCaregiverId',
            'b.bindAt AS bindAt',
            'c.realName AS caregiverName',
            'c.phone AS caregiverPhone',
          ])
          .where('b.delFlag = :delFlag', { delFlag: '0' })
          .andWhere('b.deviceNo IN (:...deviceNos)', { deviceNos })
          .andWhere('b.unbindAt IS NULL')
          .getRawMany()
      : [];
    const bindingMap = new Map(
      bindings.map((item) => {
        const binding = {
          tenantId: item.tenantId ?? item.tenantid ?? null,
          deviceNo: item.deviceNo ?? item.deviceno,
          tenantCaregiverId: item.tenantCaregiverId ?? item.tenantcaregiverid,
          bindAt: item.bindAt ?? item.bindat,
          caregiverName: item.caregiverName ?? item.caregivername ?? '',
          caregiverPhone: item.caregiverPhone ?? item.caregiverphone ?? '',
        };
        return [binding.deviceNo, binding];
      }),
    );
    let list = devices.map((item) => {
      const currentBinding = bindingMap.get(item.deviceNo) || null;
      const effectiveTenantId = currentBinding?.tenantId || item.tenantId || null;
      return {
        ...item,
        tenantId: effectiveTenantId,
        deviceTenantId: item.tenantId,
        effectiveTenantId,
        bindingStatus: currentBinding ? 'BOUND' : 'IDLE',
        currentBinding,
      };
    });
    if (query.bindingStatus) list = list.filter((item) => item.bindingStatus === query.bindingStatus);
    return ResultData.ok({ list, total });
  }

  async deleteDevice(id: number) {
    const device = await this.deviceRepo.findOne({ where: { id, delFlag: '0' } });
    if (!device) return ResultData.fail(404, '设备不存在');

    const activeBinding = await this.bindingRepo.findOne({
      where: {
        deviceNo: device.deviceNo,
        unbindAt: IsNull(),
        delFlag: '0',
      },
    });
    const tenantId = activeBinding?.tenantId || device.tenantId;
    this.ensureTenantAccess(tenantId);

    if (activeBinding) {
      return ResultData.fail(400, '设备存在当前有效绑定，请先解绑再删除');
    }

    await this.deviceRepo.update({ id }, { delFlag: '1', updateTime: new Date() });
    return ResultData.ok(null, '删除成功');
  }

  async bindBadge(dto: BindTenantBadgeDto) {
    const tenantId = this.resolveWriteTenantId(dto.tenantId);
    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    if (!deviceNo) return ResultData.fail(400, '设备编号不能为空');

    const caregiver = await this.caregiverRepo.findOne({ where: { id: dto.tenantCaregiverId, delFlag: '0' } });
    if (!caregiver) return ResultData.fail(404, '租户护工不存在');
    if (caregiver.tenantId !== tenantId) return ResultData.fail(403, '护工不属于目标租户');

    let device = await this.deviceRepo.findOne({ where: { deviceNo } });
    if (device?.tenantId && device.tenantId !== tenantId) {
      return ResultData.fail(403, '设备已归属其他租户');
    }
    if (!device) {
      device = this.deviceRepo.create({ tenantId, deviceNo, firstSeenAt: null, lastSeenAt: null, lastDataType: '', status: '0' });
    } else {
      device.tenantId = tenantId;
    }
    await this.deviceRepo.save(device);

    await this.bindingRepo.manager.transaction(async (manager) => {
      const now = new Date();
      await manager
        .createQueryBuilder()
        .update(TenantBadgeBindingEntity)
        .set({ unbindAt: now, bindStatus: 'UNBOUND' })
        .where('tenantId = :tenantId AND deviceNo = :deviceNo AND unbindAt IS NULL', { tenantId, deviceNo })
        .execute();
      await manager
        .createQueryBuilder()
        .update(TenantBadgeBindingEntity)
        .set({ unbindAt: now, bindStatus: 'UNBOUND' })
        .where('tenantId = :tenantId AND tenantCaregiverId = :tenantCaregiverId AND unbindAt IS NULL', {
          tenantId,
          tenantCaregiverId: dto.tenantCaregiverId,
        })
        .execute();
      await manager.save(
        TenantBadgeBindingEntity,
        manager.create(TenantBadgeBindingEntity, {
          tenantId,
          tenantCaregiverId: dto.tenantCaregiverId,
          deviceNo,
          bindAt: now,
          unbindAt: null,
          bindStatus: 'BOUND',
        }),
      );
    });

    return ResultData.ok(null, '绑定成功');
  }

  async unbindBadge(dto: UnbindTenantBadgeDto) {
    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    const device = await this.deviceRepo.findOne({ where: { deviceNo } });
    const activeBinding = await this.bindingRepo.findOne({
      where: {
        deviceNo,
        unbindAt: IsNull(),
        delFlag: '0',
      },
    });
    const tenantId = this.resolveWriteTenantId(dto.tenantId || activeBinding?.tenantId || device?.tenantId);
    this.ensureTenantAccess(tenantId);
    await this.bindingRepo
      .createQueryBuilder()
      .update()
      .set({ unbindAt: new Date(), bindStatus: 'UNBOUND' })
      .where('tenantId = :tenantId AND deviceNo = :deviceNo AND unbindAt IS NULL', { tenantId, deviceNo })
      .execute();
    return ResultData.ok(null, '解绑成功');
  }

  async listBindings(query: ListTenantBindingDto) {
    const qb = this.bindingRepo
      .createQueryBuilder('b')
      .leftJoin(TenantCaregiverEntity, 'c', 'c.id = b.tenantCaregiverId')
      .select(['b', 'c.realName AS caregiverName', 'c.phone AS caregiverPhone'])
      .where('b.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('b.bindAt', 'DESC');
    applyTenantScope(qb as any, 'b', this.tenantContextService, { requestedTenantId: query.tenantId });
    if (query.deviceNo) qb.andWhere('b.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.keyword) qb.andWhere('(c.realName LIKE :keyword OR c.phone LIKE :keyword)', { keyword: `%${query.keyword}%` });
    if (query.isCurrent) qb.andWhere('b.unbindAt IS NULL');

    const countQb = qb.clone();
    this.page(qb, query);
    const [rows, total] = await Promise.all([qb.getRawAndEntities(), countQb.getCount()]);
    const list = rows.entities.map((item, index) => ({
      ...item,
      caregiverName: rows.raw[index]?.caregiverName || rows.raw[index]?.caregivername || '',
      caregiverPhone: rows.raw[index]?.caregiverPhone || rows.raw[index]?.caregiverphone || '',
    }));
    return ResultData.ok({ list, total });
  }

  async listRecords(query: ListTenantRecordDto) {
    const qb = this.audioRepo.createQueryBuilder('a').where('a.delFlag = :delFlag', { delFlag: '0' }).orderBy('a.id', 'DESC');
    applyTenantScope(qb, 'a', this.tenantContextService, { requestedTenantId: query.tenantId });
    if (query.deviceNo) qb.andWhere('a.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.asrStatus) qb.andWhere('a.asrStatus = :asrStatus', { asrStatus: query.asrStatus });
    if (query.isolationStatus) qb.andWhere('a.isolationStatus = :isolationStatus', { isolationStatus: query.isolationStatus });
    if (query.params?.beginTime && query.params?.endTime) {
      qb.andWhere('a.startTime >= :begin', { begin: `${query.params.beginTime} 00:00:00` });
      qb.andWhere('a.startTime <= :end', { end: `${query.params.endTime} 23:59:59` });
    }
    const countQb = qb.clone();
    this.page(qb, query);
    const [list, total] = await Promise.all([qb.getMany(), countQb.getCount()]);
    return ResultData.ok({ list, total });
  }

  private async findTenantCaregiverId(tenantId: string, deviceNo: string, timestamp: Date): Promise<number | null> {
    const binding = await this.bindingRepo
      .createQueryBuilder('b')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.deviceNo = :deviceNo', { deviceNo })
      .andWhere('b.bindAt <= :timestamp', { timestamp })
      .andWhere('(b.unbindAt IS NULL OR b.unbindAt >= :timestamp)', { timestamp })
      .andWhere('b.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('b.bindAt', 'DESC')
      .getOne();
    return binding?.tenantCaregiverId || null;
  }

  private async fetchChunks(tenantId: string, deviceNo: string, dateStr: string) {
    const dayStart = dayjs(dateStr).startOf('day').toDate();
    const dayEnd = dayjs(dateStr).endOf('day').toDate();
    return this.audioRepo
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.deviceNo = :deviceNo', { deviceNo })
      .andWhere('a.startTime >= :dayStart AND a.startTime <= :dayEnd', { dayStart, dayEnd })
      .andWhere('a.asrStatus = :status', { status: 'SUCCESS' })
      .andWhere('a.isolationStatus = :isolationStatus', { isolationStatus: 'NORMAL' })
      .andWhere('a.chunkIndex IS NOT NULL')
      .andWhere('a.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('a.startTime', 'ASC')
      .getMany();
  }

  private computeMetrics(chunks: AudioRecordEntity[]) {
    let totalDurationSeconds = 0;
    let totalSpeechSeconds = 0;

    for (const chunk of chunks) {
      if (chunk.startTime && chunk.endTime) totalDurationSeconds += dayjs(chunk.endTime).diff(dayjs(chunk.startTime), 'second');
      if (!chunk.transcriptRaw) continue;
      try {
        const raw = JSON.parse(chunk.transcriptRaw);
        for (const item of raw.transcripts || []) {
          totalSpeechSeconds += Math.floor((item.content_duration_in_milliseconds || 0) / 1000);
        }
      } catch {
        // Ignore invalid ASR payloads.
      }
    }

    return { totalChunks: chunks.length, totalDurationSeconds, totalSpeechSeconds };
  }

  private buildTimelineText(deviceNo: string, dateStr: string, chunks: AudioRecordEntity[]) {
    const sections = ['# 租户护工日报分析输入', `日期: ${dateStr}`, `设备: ${deviceNo}`, `切片数: ${chunks.length}`, ''];
    chunks.forEach((chunk, index) => {
      if (!chunk.transcriptText) return;
      sections.push(`--- 切片 ${index + 1} ---`);
      sections.push(`文件名: ${chunk.fileName || '-'}`);
      sections.push(`时间段: ${dayjs(chunk.startTime).format('HH:mm:ss')} - ${chunk.endTime ? dayjs(chunk.endTime).format('HH:mm:ss') : '?'}`);
      sections.push('转写文本:');
      sections.push(chunk.transcriptText);
      sections.push('');
    });
    return sections.join('\n');
  }

  private trimTimelineText(text: string) {
    const normalized = String(text || '').trim();
    if (normalized.length <= TenantCareService.MAX_TIMELINE_TEXT_LENGTH) return normalized;
    const headLength = Math.floor(TenantCareService.MAX_TIMELINE_TEXT_LENGTH * 0.65);
    const tailLength = TenantCareService.MAX_TIMELINE_TEXT_LENGTH - headLength - 32;
    return `${normalized.slice(0, headLength)}\n\n...[内容已截断]...\n\n${normalized.slice(-tailLength)}`;
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
            // Keep the raw string.
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
      reportCard: buildReportCard({ analysisPayload, scorePayload, cleanedTranscript }),
    };
  }

  private async fillTenantReportWithAI(reportId: number, tenantId: string, deviceNo: string, dateStr: string, chunks: AudioRecordEntity[]) {
    const timelineText = this.trimTimelineText(this.buildTimelineText(deviceNo, dateStr, chunks));
    const rawJsonAgg = this.buildRawJsonAggregate(chunks);
    await this.reportRepo.update({ id: reportId, tenantId }, { asrPayload: timelineText, rawAsrJsonAggregate: rawJsonAgg, generationStatus: 'AI_PENDING' });

    if (!timelineText.trim()) {
      await this.reportRepo.update({ id: reportId, tenantId }, { generationStatus: 'NO_TEXT', qualityStatus: 'NEEDS_REVIEW' });
      return;
    }

    const apiKey = this.config.get<string>('dify.badgeDailyReportKey') || '';
    const baseUrl = this.config.get<string>('dify.baseUrl') || 'https://api.dify.ai/v1';
    if (!apiKey || apiKey === 'app-xxxxxxxxxxxxxxxx') {
      this.logger.warn('[tenant-care] Dify Key 未配置，跳过 AI 日报生成');
      return;
    }

    const res = await firstValueFrom(
      this.http.post(
        `${baseUrl}/workflows/run`,
        {
          inputs: {
            chat_history: timelineText,
            date_str: dateStr,
            device_no: deviceNo,
            relation_source: 'tenant-care',
          },
          response_mode: 'blocking',
          user: `tenant_report_${tenantId}_${deviceNo}_${dateStr}`,
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
    const normalized = this.normalizeWorkflowPayload(this.parseWorkflowOutput(outputs.result ?? outputs));
    await this.reportRepo.update(
      { id: reportId, tenantId },
      {
        fullTranscript: normalized.cleanedTranscript,
        summaryText: normalized.summaryText,
        serviceScore: normalized.serviceScore || null,
        reportCard: normalized.reportCard as any,
        emotionSummary: normalized.emotionSummary,
        generationStatus: 'SUCCESS',
        updateTime: new Date(),
      },
    );
  }

  async generateDailyReport(dto: GenerateTenantDailyReportDto) {
    if (!dto.deviceNo) {
      return ResultData.fail(400, '批量生成日报已临时停用，请指定设备号');
    }

    const tenantId = dto.tenantId ? this.resolveWriteTenantId(dto.tenantId) : this.resolveWriteTenantId((await this.deviceRepo.findOne({ where: { deviceNo: this.normalizeDeviceNo(dto.deviceNo) } }))?.tenantId);
    const report = await this.generateOne(tenantId, this.normalizeDeviceNo(dto.deviceNo), dto.dateStr);
    return ResultData.ok(report, '租户日报生成成功');
  }

  private async generateOne(tenantId: string, deviceNo: string, dateStr: string) {
    this.ensureTenantAccess(tenantId);
    const chunks = await this.fetchChunks(tenantId, deviceNo, dateStr);
    if (!chunks.length) throw new Error(`设备 ${deviceNo} 在 ${dateStr} 没有本租户可用转写切片`);
    if (chunks.some((chunk) => chunk.asrStatus === 'RUNNING')) throw new Error('仍有切片转写中，请稍后重试');
    const metrics = this.computeMetrics(chunks);
    const tenantCaregiverId = await this.findTenantCaregiverId(tenantId, deviceNo, dayjs(dateStr).endOf('day').toDate());

    let report = await this.reportRepo.findOne({ where: { tenantId, deviceNo, reportDate: dateStr, delFlag: '0' } });
    if (!report) {
      report = this.reportRepo.create({ tenantId, deviceNo, reportDate: dateStr, tenantCaregiverId });
    }
    report.tenantCaregiverId = tenantCaregiverId;
    report.totalChunks = metrics.totalChunks;
    report.totalDurationSeconds = metrics.totalDurationSeconds;
    report.totalSpeechSeconds = metrics.totalSpeechSeconds;
    report.generationStatus = 'METRICS_READY';
    await this.reportRepo.save(report);

    this.fillTenantReportWithAI(report.id, tenantId, deviceNo, dateStr, chunks).catch((err) => {
      this.logger.error(`[tenant-care] 设备 ${deviceNo} AI日报生成失败: ${err.message}`);
      this.reportRepo.update({ id: report.id, tenantId }, { generationStatus: 'FAILED', qualityStatus: 'NEEDS_REVIEW', updateTime: new Date() }).catch(() => undefined);
    });
    return report;
  }

  async listDailyReports(query: ListTenantDailyReportDto) {
    const qb = this.reportRepo.createQueryBuilder('r').where('r.delFlag = :delFlag', { delFlag: '0' }).orderBy('r.reportDate', 'DESC').addOrderBy('r.createTime', 'DESC');
    applyTenantScope(qb, 'r', this.tenantContextService, { requestedTenantId: query.tenantId });
    if (query.deviceNo) qb.andWhere('r.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.tenantCaregiverId) qb.andWhere('r.tenantCaregiverId = :tenantCaregiverId', { tenantCaregiverId: query.tenantCaregiverId });
    if (query.dateStr) qb.andWhere('r.reportDate = :dateStr', { dateStr: query.dateStr });
    const countQb = qb.clone();
    this.page(qb, query);
    const [list, total] = await Promise.all([qb.getMany(), countQb.getCount()]);
    return ResultData.ok({ list: list.map((item) => this.attachReportCard(item)), total });
  }

  async dailyReportDetail(id: number) {
    const report = await this.reportRepo.findOne({ where: { id, delFlag: '0' } });
    if (!report) return ResultData.fail(404, '租户日报不存在');
    this.ensureTenantAccess(report.tenantId);
    return ResultData.ok(this.attachReportCard(report));
  }
}
