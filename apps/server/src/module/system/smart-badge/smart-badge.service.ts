import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import dayjs from 'dayjs';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SysConfigService } from '../sysconfig/sysconfig.service';
import { ResultData } from 'src/common/utils/result';
import { DeviceUserBindingEntity } from './entities/device-user-binding.entity';
import { AudioRecordEntity } from './entities/audio-record.entity';
import { DeviceGpsLogEntity } from './entities/device-gps-log.entity';
import { DeviceEventLogEntity } from './entities/device-event-log.entity';
import { NurseDailyReportEntity } from './entities/nurse-daily-report.entity';
import { BadgeDeviceEntity } from './entities/badge-device.entity';
import { CloudAsrService } from './services/cloud-asr.service';
import {
  AudioPushData,
  AudioTextPushData,
  BadgePushData,
  BindDeviceDto,
  ControlLogPushData,
  CreateBadgeDeviceDto,
  DeleteBadgeDeviceDto,
  DebugLogPushData,
  GpsPushData,
  HeartbeatLogPushData,
  LoginLogPushData,
  MergeAudioPushData,
  UpdateBadgeDeviceDto,
  UnbindDeviceDto,
  UploadLogPushData,
} from './dto/index';
import { UserEntity } from '../user/entities/sys-user.entity';
import { buildReportCard } from './services/report-card.builder';
import { TenantContextService } from 'src/common/tenant/tenant-context.service';
import { applyTenantScope } from 'src/common/tenant/tenant-query';
import { PLATFORM_SELF_TENANT_ID } from 'src/common/tenant/tenant.constants';
import { TenantBadgeBindingEntity } from 'src/module/tenant-care/entities/tenant-badge-binding.entity';

type BadgeResolvedBinding = {
  userId: number | null;
  tenantId: string | null;
  tenantCaregiverId: number | null;
  isolationStatus: string;
  isolationReason: string | null;
};

@Injectable()
export class SmartBadgeService {
  private readonly logger = new Logger(SmartBadgeService.name);

  constructor(
    @InjectRepository(BadgeDeviceEntity) private readonly deviceRepo: Repository<BadgeDeviceEntity>,
    @InjectRepository(DeviceUserBindingEntity) private readonly bindingRepo: Repository<DeviceUserBindingEntity>,
    @InjectRepository(AudioRecordEntity) private readonly audioRepo: Repository<AudioRecordEntity>,
    @InjectRepository(DeviceGpsLogEntity) private readonly gpsLogRepo: Repository<DeviceGpsLogEntity>,
    @InjectRepository(DeviceEventLogEntity) private readonly eventLogRepo: Repository<DeviceEventLogEntity>,
    @InjectRepository(NurseDailyReportEntity) private readonly reportRepo: Repository<NurseDailyReportEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(TenantBadgeBindingEntity) private readonly tenantBindingRepo: Repository<TenantBadgeBindingEntity>,
    @Inject(ConfigService) private readonly config: ConfigService,
    private readonly cloudAsr: CloudAsrService,
    private readonly sysConfig: SysConfigService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private buildPublicUrl(ossKey: string): string {
    const domain = this.config.get<string>('hardwareAudio.publicDomain');
    return `${domain}/${ossKey}`;
  }

  private parseChunkIndex(raw: string): number | null {
    if (!raw) return null;
    return parseInt(raw.replace(/\D/g, ''), 10) || null;
  }

  private extractChunkFromFileName(fileName: string): number | null {
    if (!fileName) return null;
    const matched = fileName.match(/[AZ](\d+)/i);
    return matched ? parseInt(matched[1], 10) : null;
  }

  private extractSegmentType(fileName: string): string | null {
    if (!fileName) return null;
    const matched = fileName.match(/-([AZ])\d+/);
    return matched ? matched[1] : null;
  }

  private parseYYMMDDHHmmss(str: string): Date | null {
    if (!str || str.length < 12) return null;
    return new Date(`20${str.slice(0, 2)}-${str.slice(2, 4)}-${str.slice(4, 6)}T${str.slice(6, 8)}:${str.slice(8, 10)}:${str.slice(10, 12)}`);
  }

  private normalizeDeviceNo(deviceNo: string): string {
    return String(deviceNo || '')
      .trim()
      .toUpperCase();
  }

  private currentTenantId(): string | null {
    return this.tenantContextService.getTenantId();
  }

  private resolveWriteTenantId(preferredTenantId?: string | null): string | null {
    if (preferredTenantId) return preferredTenantId;
    if (this.tenantContextService.isPlatformUser()) return PLATFORM_SELF_TENANT_ID;
    return this.currentTenantId();
  }

  private async resolveTenantId(deviceNo?: string | null, userId?: number | null): Promise<string | null> {
    if (deviceNo) {
      const device = await this.deviceRepo.findOne({
        where: {
          deviceNo: this.normalizeDeviceNo(deviceNo),
        },
        select: ['tenantId'],
      });
      if (device?.tenantId) return device.tenantId;
    }

    if (userId) {
      const user = await this.userRepo.findOne({
        where: {
          userId,
          delFlag: '0',
        },
        select: ['tenantId'],
      });
      if (user?.tenantId) return user.tenantId;
    }

    return this.currentTenantId();
  }

  private ensureTenantAccess(entityTenantId?: string | null) {
    if (this.tenantContextService.isPlatformUser()) return;
    const tenantId = this.currentTenantId();
    if (!tenantId) {
      throw new ForbiddenException('租户上下文缺失，无法访问租户数据');
    }
    if (!entityTenantId || entityTenantId !== tenantId) {
      throw new ForbiddenException('无权访问其他租户数据');
    }
  }

  private formatBindingRecord(item: any, fallbackDeviceNo = '') {
    return {
      id: item.id,
      tenantId: item.tenantId ?? item.tenantid ?? null,
      deviceNo: item.deviceNo ?? item.deviceno ?? fallbackDeviceNo,
      userId: Number(item.userId ?? item.userid ?? 0) || null,
      bindAt: item.bindAt ?? item.bindat ?? null,
      unbindAt: item.unbindAt ?? item.unbindat ?? null,
      createdAt: item.createdAt ?? item.createdat ?? null,
      realName: item.realName ?? item.realname ?? '',
      contactPhone: item.contactPhone ?? item.contactphone ?? '',
      userName: item.userName ?? item.username ?? '',
      nickName: item.nickName ?? item.nickname ?? '',
      phonenumber: item.phonenumber ?? '',
    };
  }

  private async getBindingSnapshot(deviceNos: string[]) {
    if (!deviceNos.length) {
      return { currentBindingMap: new Map<string, any>(), historyCountMap: new Map<string, number>() };
    }

    const rows = await this.bindingRepo
      .createQueryBuilder('b')
      .leftJoin(UserEntity, 'u', 'u.userId = b.userId')
      .select([
        'b.id AS id',
        'b.tenantId AS tenantId',
        'b.deviceNo AS deviceNo',
        'b.userId AS userId',
        'b.bindAt AS bindAt',
        'b.unbindAt AS unbindAt',
        'b.createdAt AS createdAt',
        'u.nickName AS realName',
        'u.phonenumber AS contactPhone',
        'u.userName AS userName',
        'u.nickName AS nickName',
        'u.phonenumber AS phonenumber',
      ])
      .where('b.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('b.deviceNo IN (:...deviceNos)', { deviceNos })
      .orderBy('b.deviceNo', 'ASC')
      .addOrderBy('b.bindAt', 'DESC')
      .getRawMany();

    const currentBindingMap = new Map<string, any>();
    const historyCountMap = new Map<string, number>();

    for (const row of rows) {
      const deviceNo = row.deviceNo ?? row.deviceno ?? '';
      historyCountMap.set(deviceNo, (historyCountMap.get(deviceNo) || 0) + 1);
      if (!currentBindingMap.has(deviceNo) && (row.unbindAt == null || row.unbindat == null)) {
        currentBindingMap.set(deviceNo, this.formatBindingRecord(row, deviceNo));
      }
    }

    return { currentBindingMap, historyCountMap };
  }

  private async ensureDeviceRegistered(deviceNo: string, dataType: string, seenAt: Date = new Date(), tenantId?: string | null) {
    const normalizedDeviceNo = this.normalizeDeviceNo(deviceNo);
    if (!normalizedDeviceNo) return null;

    const current = await this.deviceRepo.findOne({ where: { deviceNo: normalizedDeviceNo } });
    if (current) {
      if (!current.tenantId && tenantId) {
        current.tenantId = tenantId;
      }
      current.lastSeenAt = seenAt;
      current.lastDataType = dataType || current.lastDataType || '';
      await this.deviceRepo.save(current);
      return current;
    }

    const created = this.deviceRepo.create({
      tenantId: this.resolveWriteTenantId(tenantId),
      deviceNo: normalizedDeviceNo,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      lastDataType: dataType || '',
    });
    return this.deviceRepo.save(created);
  }

  private rejectUnresolvedDeviceTenant(deviceNo: string, dataType: string) {
    this.logger.warn(`[tenant-isolation] reject ${dataType} for unresolved device tenant: ${deviceNo}`);
    return ResultData.fail(400, `设备 ${deviceNo} 未识别租户归属，${dataType} 未写入业务表`);
  }

  private attachReportCard<T extends NurseDailyReportEntity>(report: T): T & { reportCard: Record<string, any> } {
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

  async findUserByDeviceAndTime(deviceNo: string, timestamp: Date): Promise<number | null> {
    const result = await this.bindingRepo
      .createQueryBuilder('b')
      .where('b.deviceNo = :deviceNo', { deviceNo })
      .andWhere('b.bindAt <= :timestamp', { timestamp })
      .andWhere('(b.unbindAt IS NULL OR b.unbindAt >= :timestamp)', { timestamp })
      .orderBy('b.bindAt', 'DESC')
      .getOne();

    return result?.userId || null;
  }

  private async resolveBindingByDeviceAndTime(deviceNo: string, timestamp: Date): Promise<BadgeResolvedBinding> {
    const userId = await this.findUserByDeviceAndTime(deviceNo, timestamp);
    let tenantId = await this.resolveTenantId(deviceNo, userId);
    if (tenantId) {
      return {
        userId,
        tenantId,
        tenantCaregiverId: null,
        isolationStatus: 'NORMAL',
        isolationReason: null,
      };
    }

    const tenantBinding = await this.tenantBindingRepo
      .createQueryBuilder('b')
      .where('b.deviceNo = :deviceNo', { deviceNo })
      .andWhere('b.bindAt <= :timestamp', { timestamp })
      .andWhere('(b.unbindAt IS NULL OR b.unbindAt >= :timestamp)', { timestamp })
      .andWhere('b.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('b.bindAt', 'DESC')
      .getOne();

    if (tenantBinding) {
      return {
        userId: null,
        tenantId: tenantBinding.tenantId,
        tenantCaregiverId: tenantBinding.tenantCaregiverId,
        isolationStatus: 'NORMAL',
        isolationReason: null,
      };
    }

    tenantId = this.currentTenantId();
    return {
      userId: userId || null,
      tenantId,
      tenantCaregiverId: null,
      isolationStatus: tenantId ? 'NORMAL' : 'TENANT_UNRESOLVED',
      isolationReason: tenantId ? null : `Device ${deviceNo} has no tenant device owner or active binding`,
    };
  }

  async dispatch(dataType: string, deviceNo: string, data: BadgePushData) {
    this.logger.debug(`处理工牌回调: ${dataType}`);
    const normalizedDeviceNo = this.normalizeDeviceNo(deviceNo);
    const seenAt = new Date();
    const binding = await this.resolveBindingByDeviceAndTime(normalizedDeviceNo, seenAt);
    const device = await this.ensureDeviceRegistered(normalizedDeviceNo, dataType, seenAt, binding.tenantId);
    binding.tenantId = device?.tenantId ?? binding.tenantId;

    switch (dataType) {
      case 'Audio':
        return this.handleAudio(data as AudioPushData, normalizedDeviceNo, binding);
      case 'UploadLog':
        return this.handleUploadLog(data as UploadLogPushData, normalizedDeviceNo, binding);
      case 'AudioText':
        return this.handleAudioText(data as AudioTextPushData);
      case 'Gps':
        return this.handleGps(data as GpsPushData, normalizedDeviceNo, binding.userId, binding.tenantId);
      case 'LoginLog':
        return this.handleLoginLog(data as LoginLogPushData, normalizedDeviceNo, binding.userId, binding.tenantId);
      case 'ControlLog':
        return this.handleControlLog(data as ControlLogPushData, normalizedDeviceNo, binding.userId, binding.tenantId);
      case 'HeartbeatLog':
        return this.handleHeartbeatLog(data as HeartbeatLogPushData, normalizedDeviceNo, binding.userId, binding.tenantId);
      case 'DebugLog':
        return this.handleDebugLog(data as DebugLogPushData, normalizedDeviceNo, binding.userId, binding.tenantId);
      case 'MergeAudio':
        return this.handleMergeAudio(data as MergeAudioPushData, normalizedDeviceNo, binding);
      default:
        this.logger.warn(`未知推送类型: ${dataType}`);
        return ResultData.fail(400, `不支持的数据类型: ${dataType}`);
    }
  }

  async handleAudio(data: AudioPushData, deviceNo: string, binding: BadgeResolvedBinding) {
    const startTime = this.parseYYMMDDHHmmss(data.startTime) || new Date();
    const endTime = data.endTime ? this.parseYYMMDDHHmmss(data.endTime) : null;
    const chunkIndex = this.parseChunkIndex(data.chunkIndex) ?? this.extractChunkFromFileName(data.fileName);
    const segmentType = this.extractSegmentType(data.fileName);
    const existing = await this.audioRepo.findOne({ where: { fileName: data.fileName } });

    if (existing) {
      if (!existing.tenantId && binding.tenantId) existing.tenantId = binding.tenantId;
      if (binding.userId) existing.userId = binding.userId;
      existing.isolationStatus = binding.isolationStatus;
      existing.isolationReason = binding.isolationReason;
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.chunkIndex = chunkIndex ?? existing.chunkIndex;
      existing.segmentType = segmentType;
      await this.audioRepo.save(existing);
      return ResultData.ok({ id: existing.id, userId: binding.userId, tenantCaregiverId: binding.tenantCaregiverId }, '录音记录已更新');
    }

    const record = this.audioRepo.create({
      tenantId: binding.tenantId,
      deviceNo,
      userId: binding.userId,
      fileName: data.fileName,
      ossKey: '',
      fileUrl: '',
      sizeBytes: null,
      chunkIndex,
      segmentType,
      startTime,
      endTime,
      transcribeStatus: 'PENDING',
      isolationStatus: binding.isolationStatus,
      isolationReason: binding.isolationReason,
    });
    await this.audioRepo.save(record);
    if (record.fileUrl) {
      this.triggerAsrWorkflow(record.fileName, record.fileUrl).catch((err) => {
        this.logger.error(`[ASR] 切片自动转写异常 - ${record.fileName}: ${err.message}`);
      });
    }
    return ResultData.ok({ id: record.id, userId: binding.userId, tenantCaregiverId: binding.tenantCaregiverId, userName: data.userName }, '录音记录已保存');
  }

  async handleUploadLog(data: UploadLogPushData, deviceNo: string, binding: BadgeResolvedBinding) {
    const startTime = data.realStartTime ? new Date(data.realStartTime) : new Date();
    const endTime = data.realEndTime ? new Date(data.realEndTime) : null;
    const ossKey = data.objectStoreUrl || '';
    const fileUrl = data.fileDownLoadUrl || (ossKey ? this.buildPublicUrl(ossKey) : '');
    const chunkIndex = this.parseChunkIndex(data.chunkIndex) ?? this.extractChunkFromFileName(data.fileName);
    const segmentType = this.extractSegmentType(data.fileName);

    const existing = await this.audioRepo.findOne({ where: { fileName: data.fileName } });
    let savedId: number;
    let finalFileUrl = fileUrl;

    if (existing) {
      if (!existing.tenantId && binding.tenantId) existing.tenantId = binding.tenantId;
      existing.ossKey = ossKey || existing.ossKey;
      existing.fileUrl = finalFileUrl || existing.fileUrl;
      existing.segmentType = existing.segmentType || segmentType;
      if (data.lengthBytes) existing.sizeBytes = data.lengthBytes;
      if (binding.userId) existing.userId = binding.userId;
      existing.isolationStatus = binding.isolationStatus;
      existing.isolationReason = binding.isolationReason;
      existing.startTime = startTime;
      existing.endTime = endTime;
      existing.chunkIndex = chunkIndex ?? existing.chunkIndex;
      await this.audioRepo.save(existing);
      savedId = existing.id;
      finalFileUrl = existing.fileUrl;
    } else {
      const record = this.audioRepo.create({
        tenantId: binding.tenantId,
        deviceNo,
        userId: binding.userId,
        fileName: data.fileName,
        ossKey,
        fileUrl,
        sizeBytes: data.lengthBytes || null,
        chunkIndex,
        segmentType,
        startTime,
        endTime,
        transcribeStatus: 'PENDING',
        isolationStatus: binding.isolationStatus,
        isolationReason: binding.isolationReason,
      });
      await this.audioRepo.save(record);
      savedId = record.id;
    }

    if (finalFileUrl) {
      const fileName = data.fileName || '';
      this.triggerAsrWorkflow(fileName, finalFileUrl).catch((err) => {
        this.logger.error(`[ASR] 切片自动转写异常 - ${fileName}: ${err.message}`);
      });
    }

    return ResultData.ok({ id: savedId, userId: binding.userId, tenantCaregiverId: binding.tenantCaregiverId, fileUrl: finalFileUrl }, existing ? '上传日志已更新' : '上传日志已保存');
  }

  async handleAudioText(data: AudioTextPushData) {
    const record = await this.audioRepo.findOne({ where: { fileName: data.filename } });
    if (!record) return ResultData.fail(500, `未找到录音文件: ${data.filename}`);

    const text = (data.segments || [])
      .map((item) => item.text)
      .filter(Boolean)
      .join('\n');

    record.transcriptText = text || null;
    record.transcriptRaw = JSON.stringify(data);
    record.transcribeStatus = data.status || 'SUCCESS';
    await this.audioRepo.save(record);

    return ResultData.ok({ id: record.id }, '转写结果已更新');
  }

  async handleGps(data: GpsPushData, deviceNo: string, userId: number | null, tenantId: string | null) {
    if (!tenantId) return this.rejectUnresolvedDeviceTenant(deviceNo, 'GPS');
    const gps = this.gpsLogRepo.create({
      tenantId,
      deviceNo,
      userId,
      latitude: data.latitude ?? data.gaodeLatitude ?? null,
      longitude: data.longitude ?? data.gaodeLongitude ?? null,
      altitude: null,
      speed: null,
      locationType: data.wifiLatitude ? 'WIFI' : 'GPS',
      reportTime: data.createdTime ? new Date(data.createdTime) : new Date(),
      rawData: JSON.stringify(data),
    });
    await this.gpsLogRepo.save(gps);
    return ResultData.ok({ id: gps.id, userId }, 'GPS 日志已保存');
  }

  async handleLoginLog(data: LoginLogPushData, deviceNo: string, userId: number | null, tenantId: string | null) {
    if (!tenantId) return this.rejectUnresolvedDeviceTenant(deviceNo, 'login');
    const event = this.eventLogRepo.create({
      tenantId,
      deviceNo,
      userId,
      eventType: 'login',
      eventName: '设备登录',
      eventStatus: data.validateResult || 'success',
      detail: `IP:${data.endpoint || ''}`,
      rawData: JSON.stringify(data),
    });
    await this.eventLogRepo.save(event);
    return ResultData.ok({ id: event.id }, '登录日志已保存');
  }

  async handleControlLog(data: ControlLogPushData, deviceNo: string, userId: number | null, tenantId: string | null) {
    if (!tenantId) return this.rejectUnresolvedDeviceTenant(deviceNo, 'control');
    const nameMap: Record<string, string> = {
      '2001': '开始录音',
      '2004': '远程关机重启',
      '4004': '固件升级',
      '4009': '修改分段时长',
    };

    const event = this.eventLogRepo.create({
      tenantId,
      deviceNo,
      userId,
      eventType: 'control',
      eventName: nameMap[data.dataType || ''] || data.controlValue || '控制指令',
      eventStatus: data.status || 'success',
      detail: data.controlValue || '',
      rawData: JSON.stringify(data),
    });
    await this.eventLogRepo.save(event);
    return ResultData.ok({ id: event.id }, '控制日志已保存');
  }

  async handleHeartbeatLog(data: HeartbeatLogPushData, deviceNo: string, userId: number | null, tenantId: string | null) {
    if (!tenantId) return this.rejectUnresolvedDeviceTenant(deviceNo, 'heartbeat');
    const storage = data.remainStorageSize != null ? `${(data.remainStorageSize / 1024 / 1024).toFixed(1)}GB` : '?';
    const event = this.eventLogRepo.create({
      tenantId,
      deviceNo,
      userId,
      eventType: 'heartbeat',
      eventName: '心跳',
      eventStatus: data.deviceStatus || 'Online',
      detail: `电量:${data.remainPower ?? '?'}% 存储:${storage}`,
      rawData: JSON.stringify(data),
    });
    await this.eventLogRepo.save(event);
    return ResultData.ok({ id: event.id }, '心跳日志已保存');
  }

  async handleDebugLog(data: DebugLogPushData, deviceNo: string, userId: number | null, tenantId: string | null) {
    if (!tenantId) return this.rejectUnresolvedDeviceTenant(deviceNo, 'debug');
    const event = this.eventLogRepo.create({
      tenantId,
      deviceNo,
      userId,
      eventType: 'debug',
      eventName: '运行日志',
      eventStatus: 'success',
      detail: (data.body || '').slice(0, 1000),
      rawData: JSON.stringify(data),
    });
    await this.eventLogRepo.save(event);
    return ResultData.ok({ id: event.id }, '调试日志已保存');
  }

  async handleMergeAudio(data: MergeAudioPushData, deviceNo: string, binding: BadgeResolvedBinding) {
    const ossKey = data.objectStoreUrl || '';
    const fileUrl = data.fileDownLoadUrl || (ossKey ? this.buildPublicUrl(ossKey) : '');
    const existing = await this.audioRepo.findOne({ where: { fileName: data.fileName } });

    let savedId: number;
    let finalFileUrl = fileUrl;

    if (existing) {
      if (!existing.tenantId && binding.tenantId) existing.tenantId = binding.tenantId;
      existing.ossKey = ossKey || existing.ossKey;
      existing.fileUrl = finalFileUrl || existing.fileUrl;
      if (data.size) existing.sizeBytes = data.size;
      if (binding.userId) existing.userId = binding.userId;
      existing.isolationStatus = binding.isolationStatus;
      existing.isolationReason = binding.isolationReason;
      if (data.startTime) existing.startTime = new Date(data.startTime);
      if (data.endTime) existing.endTime = new Date(data.endTime);
      await this.audioRepo.save(existing);
      savedId = existing.id;
      finalFileUrl = existing.fileUrl;
    } else {
      const record = this.audioRepo.create({
        tenantId: binding.tenantId,
        deviceNo,
        userId: binding.userId,
        fileName: data.fileName || '',
        ossKey,
        fileUrl,
        sizeBytes: data.size || null,
        chunkIndex: null,
        startTime: data.startTime ? new Date(data.startTime) : new Date(),
        endTime: data.endTime ? new Date(data.endTime) : null,
        transcribeStatus: 'PENDING',
        isolationStatus: binding.isolationStatus,
        isolationReason: binding.isolationReason,
      });
      await this.audioRepo.save(record);
      savedId = record.id;
    }

    return ResultData.ok({ id: savedId, userId: binding.userId, tenantCaregiverId: binding.tenantCaregiverId }, existing ? '合并录音已更新' : '合并录音已保存');
  }

  async bindDevice(dto: BindDeviceDto) {
    const normalizedDeviceNo = this.normalizeDeviceNo(dto.deviceNo);
    const user = await this.userRepo.findOne({ where: { userId: dto.userId, delFlag: '0' } });
    if (!user) return ResultData.fail(500, `用户不存在: ${dto.userId}`);
    this.ensureTenantAccess(user.tenantId);
    const tenantId = this.resolveWriteTenantId(user.tenantId ?? this.currentTenantId());

    await this.ensureDeviceRegistered(normalizedDeviceNo, 'BindDevice', new Date(), tenantId);

    await this.bindingRepo.manager.transaction(async (manager) => {
      const now = new Date();
      await manager
        .createQueryBuilder()
        .update(DeviceUserBindingEntity)
        .set({ unbindAt: now })
        .where('deviceNo = :no AND unbindAt IS NULL', { no: normalizedDeviceNo })
        .andWhere(tenantId ? 'tenantId = :tenantId' : '1=1', { tenantId })
        .execute();
      await manager
        .createQueryBuilder()
        .update(DeviceUserBindingEntity)
        .set({ unbindAt: now })
        .where('userId = :userId AND unbindAt IS NULL', { userId: dto.userId })
        .andWhere(tenantId ? 'tenantId = :tenantId' : '1=1', { tenantId })
        .execute();

      await manager.save(
        DeviceUserBindingEntity,
        manager.create(DeviceUserBindingEntity, {
          tenantId,
          deviceNo: normalizedDeviceNo,
          userId: dto.userId,
          bindAt: now,
        }),
      );
    });
    return ResultData.ok(null, '绑定成功');
  }

  async unbindDevice(dto: UnbindDeviceDto) {
    const normalizedDeviceNo = this.normalizeDeviceNo(dto.deviceNo);
    const tenantId = await this.resolveTenantId(normalizedDeviceNo, null);
    this.ensureTenantAccess(tenantId);
    await this.ensureDeviceRegistered(normalizedDeviceNo, 'UnbindDevice', new Date(), tenantId);

    await this.bindingRepo
      .createQueryBuilder()
      .update()
      .set({ unbindAt: new Date() })
      .where('deviceNo = :no AND unbindAt IS NULL', { no: normalizedDeviceNo })
      .andWhere(tenantId ? 'tenantId = :tenantId' : '1=1', { tenantId })
      .execute();

    return ResultData.ok(null, '解绑成功');
  }

  async createDevice(dto: CreateBadgeDeviceDto) {
    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    if (!deviceNo) return ResultData.fail(400, '设备号不能为空');

    const exists = await this.deviceRepo.findOne({ where: { deviceNo } });
    if (exists?.delFlag === '1') return ResultData.fail(400, `设备 ${deviceNo} 已删除，请在平台设备列表筛选“已删除”后恢复`);
    if (exists) return ResultData.fail(400, `设备已存在: ${deviceNo}`);
    const tenantId = this.resolveWriteTenantId();

    const entity = this.deviceRepo.create({
      tenantId,
      deviceNo,
      status: dto.status || '0',
      remark: dto.remark?.trim() || '',
      lastDataType: '',
      firstSeenAt: null,
      lastSeenAt: null,
    });
    await this.deviceRepo.save(entity);
    return ResultData.ok(entity, '新增设备成功');
  }

  async updateDevice(dto: UpdateBadgeDeviceDto) {
    const entity = await this.deviceRepo.findOne({ where: { id: dto.id } });
    if (!entity) return ResultData.fail(404, '设备不存在');
    this.ensureTenantAccess(entity.tenantId);

    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    if (!deviceNo) return ResultData.fail(400, '设备号不能为空');

    const duplicate = await this.deviceRepo.findOne({ where: { deviceNo } });
    if (duplicate && duplicate.id !== entity.id) {
      return ResultData.fail(400, `设备号已存在: ${deviceNo}`);
    }

    entity.deviceNo = deviceNo;
    entity.status = dto.status || entity.status || '0';
    entity.remark = dto.remark?.trim() || '';
    await this.deviceRepo.save(entity);
    return ResultData.ok(entity, '编辑设备成功');
  }

  async deleteDevice(dto: DeleteBadgeDeviceDto, operatorName = '') {
    const device = await this.deviceRepo.findOne({ where: { id: dto.id, delFlag: '0' } });
    if (!device) return ResultData.fail(404, '设备不存在或已删除');

    const deviceNo = this.normalizeDeviceNo(device.deviceNo);
    const confirmDeviceNo = this.normalizeDeviceNo(dto.confirmDeviceNo);
    const reason = String(dto.reason || '').trim();

    if (!confirmDeviceNo || confirmDeviceNo !== deviceNo) {
      return ResultData.fail(400, '设备号确认不一致，已取消删除');
    }
    if (reason.length < 5) {
      return ResultData.fail(400, '删除原因至少需要 5 个字符');
    }

    const [activePlatformBinding, activeTenantBinding] = await Promise.all([
      this.bindingRepo.findOne({ where: { deviceNo, unbindAt: IsNull(), delFlag: '0' } }),
      this.tenantBindingRepo.findOne({ where: { deviceNo, unbindAt: IsNull(), delFlag: '0' } }),
    ]);
    const tenantId = activeTenantBinding?.tenantId || activePlatformBinding?.tenantId || device.tenantId;
    this.ensureTenantAccess(tenantId);

    if (activePlatformBinding || activeTenantBinding) {
      return ResultData.fail(400, '设备存在当前有效绑定，请先解绑再删除');
    }

    const [platformBindingCount, tenantBindingCount, audioCount, gpsCount, eventCount, reportCount] = await Promise.all([
      this.bindingRepo.count({ where: { deviceNo, delFlag: '0' } }),
      this.tenantBindingRepo.count({ where: { deviceNo, delFlag: '0' } }),
      this.audioRepo.count({ where: { deviceNo, delFlag: '0' } }),
      this.gpsLogRepo.count({ where: { deviceNo, delFlag: '0' } }),
      this.eventLogRepo.count({ where: { deviceNo, delFlag: '0' } }),
      this.reportRepo.count({ where: { deviceNo, delFlag: '0' } }),
    ]);
    const reviewSnapshot = {
      platformBindingCount,
      tenantBindingCount,
      audioCount,
      gpsCount,
      eventCount,
      reportCount,
    };

    const auditText = `删除审核通过: ${reason}; 关联数据 ${JSON.stringify(reviewSnapshot)}`;
    await this.deviceRepo.update(
      { id: device.id },
      {
        delFlag: '1',
        remark: auditText.slice(0, 500),
        updateBy: operatorName || 'system',
        updateTime: new Date(),
      },
    );

    return ResultData.ok(reviewSnapshot, '设备已删除');
  }

  async restoreDevice(id: number, operatorName = '') {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) return ResultData.fail(404, '设备不存在');
    this.ensureTenantAccess(device.tenantId);
    if (device.delFlag === '0') return ResultData.ok(device, '设备已是正常状态');

    await this.deviceRepo.update(
      { id: device.id },
      {
        delFlag: '0',
        updateBy: operatorName || 'system',
        updateTime: new Date(),
      },
    );
    return ResultData.ok({ id: device.id, deviceNo: device.deviceNo }, '设备已恢复');
  }

  async deviceList(query: any) {
    const dataStatus = String(query.dataStatus || 'NORMAL').toUpperCase();
    const qb = this.deviceRepo.createQueryBuilder('d').orderBy('d.createTime', 'DESC').addOrderBy('d.deviceNo', 'ASC');
    if (dataStatus === 'DELETED') {
      qb.where('d.delFlag = :delFlag', { delFlag: '1' });
    } else if (dataStatus === 'ALL') {
      qb.where('1=1');
    } else {
      qb.where('d.delFlag = :delFlag', { delFlag: '0' });
    }
    applyTenantScope(qb, 'd', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('d.deviceNo LIKE :no', { no: `%${String(query.deviceNo).trim().toUpperCase()}%` });
    if (query.assetStatus === 'ENABLED') qb.andWhere("d.status = '0'");
    if (query.assetStatus === 'DISABLED') qb.andWhere("d.status = '1'");

    const devices = await qb.getMany();
    const deviceNos = devices.map((item) => item.deviceNo);
    const { currentBindingMap, historyCountMap } = await this.getBindingSnapshot(deviceNos);

    let list = devices.map((item) => {
      const currentBinding = currentBindingMap.get(item.deviceNo) || null;
      const bindingStatus = currentBinding ? 'BOUND' : 'IDLE';
      const assetStatus = item.status === '1' ? 'DISABLED' : 'ENABLED';

      return {
        id: item.id,
        deviceNo: item.deviceNo,
        tenantId: item.tenantId,
        delFlag: item.delFlag,
        dataStatus: item.delFlag === '1' ? 'DELETED' : 'NORMAL',
        assetStatus,
        bindingStatus,
        currentMode: currentBinding ? 'CAREGIVER_BOUND' : 'INDEPENDENT_DEVICE',
        currentBinding,
        historyCount: historyCountMap.get(item.deviceNo) || 0,
        firstSeenAt: item.firstSeenAt,
        lastSeenAt: item.lastSeenAt,
        lastDataType: item.lastDataType,
        remark: item.remark || '',
        createTime: item.createTime,
        updateTime: item.updateTime,
      };
    });

    if (query.bindingStatus === 'BOUND') list = list.filter((item) => item.bindingStatus === 'BOUND');
    if (query.bindingStatus === 'IDLE') list = list.filter((item) => item.bindingStatus === 'IDLE');

    if (query.keyword) {
      const keyword = String(query.keyword).trim().toLowerCase();
      list = list.filter((item) => {
        const current = item.currentBinding;
        return (
          Boolean(current) &&
          String(current.nickName || current.userName || '')
            .toLowerCase()
            .includes(keyword)
        );
      });
    }

    const summary = {
      totalDevices: devices.length,
      enabledDevices: devices.filter((item) => item.status !== '1').length,
      disabledDevices: devices.filter((item) => item.status === '1').length,
      boundDevices: devices.filter((item) => currentBindingMap.has(item.deviceNo)).length,
      idleDevices: devices.filter((item) => !currentBindingMap.has(item.deviceNo)).length,
    };

    const total = list.length;
    if (query.pageSize && query.pageNum) {
      const pageSize = Number(query.pageSize);
      const pageNum = Number(query.pageNum);
      list = list.slice(pageSize * (pageNum - 1), pageSize * pageNum);
    }

    return ResultData.ok({ list, total, summary });
  }

  async bindingList(query: any) {
    const qb = this.bindingRepo
      .createQueryBuilder('b')
      .leftJoin(UserEntity, 'u', 'u.userId = b.userId')
      .select([
        'b.id AS id',
        'b.deviceNo AS deviceNo',
        'b.userId AS userId',
        'b.bindAt AS bindAt',
        'b.unbindAt AS unbindAt',
        'b.createdAt AS createdAt',
        'u.userName AS userName',
        'u.nickName AS nickName',
        'u.phonenumber AS phonenumber',
      ])
      .where('b.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('b.bindAt', 'DESC');
    applyTenantScope(qb, 'b', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('b.deviceNo LIKE :no', { no: `%${query.deviceNo}%` });
    if (query.keyword) {
      qb.andWhere('(CAST(b.userId AS CHAR) LIKE :keyword OR u.userName LIKE :keyword OR u.nickName LIKE :keyword OR u.phonenumber LIKE :keyword)', { keyword: `%${query.keyword}%` });
    }
    if (query.isCurrent === 'true' || query.isCurrent === true) {
      qb.andWhere('b.unbindAt IS NULL');
    } else if (query.isCurrent === 'false' || query.isCurrent === false) {
      qb.andWhere('b.unbindAt IS NOT NULL');
    }
    const countQb = qb.clone();
    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [rows, total] = await Promise.all([qb.getRawMany(), countQb.getCount()]);
    const list = rows.map((item) => this.formatBindingRecord(item));
    return ResultData.ok({ list, total });
  }

  async bindingDeviceSummary(query: any) {
    const result = await this.deviceList({
      ...query,
      bindingStatus: query.status || query.bindingStatus,
    });
    const payload = result.data || { list: [], total: 0, summary: {} };
    const list = (payload.list || []).map((item) => ({
      deviceNo: item.deviceNo,
      status: item.bindingStatus,
      currentBinding: item.currentBinding,
      historyCount: item.historyCount,
      lastBindAt: item.currentBinding?.bindAt || null,
      lastUnbindAt: item.currentBinding?.unbindAt || null,
      assetStatus: item.assetStatus,
      lastSeenAt: item.lastSeenAt,
      lastDataType: item.lastDataType,
      remark: item.remark,
    }));
    return ResultData.ok({ list, total: payload.total, summary: payload.summary });
  }

  async recordList(query: any) {
    const qb = this.audioRepo.createQueryBuilder('a').leftJoin(UserEntity, 'u', 'u.userId = a.userId').where('a.delFlag = :delFlag', { delFlag: '0' }).orderBy('a.id', 'DESC');
    applyTenantScope(qb, 'a', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('a.deviceNo LIKE :no', { no: `%${query.deviceNo}%` });
    if (query.userId) qb.andWhere('a.userId = :uid', { uid: query.userId });
    if (query.userName) {
      qb.andWhere('(u.userName LIKE :userName OR u.nickName LIKE :userName)', {
        userName: `%${query.userName}%`,
      });
    }
    if (query.keyword) {
      qb.andWhere('(a.deviceNo LIKE :keyword OR u.userName LIKE :keyword OR u.nickName LIKE :keyword)', {
        keyword: `%${query.keyword}%`,
      });
    }
    if (query.asrStatus) qb.andWhere('a.asrStatus = :status', { status: query.asrStatus });
    if (query.segmentType === 'MERGED') {
      qb.andWhere('a.segmentType IS NULL');
    } else if (query.segmentType) {
      qb.andWhere('a.segmentType = :segmentType', { segmentType: query.segmentType });
    }
    if (query.params?.beginTime && query.params?.endTime) {
      qb.andWhere('a.startTime >= :begin', { begin: `${query.params.beginTime} 00:00:00` });
      qb.andWhere('a.startTime <= :end', { end: `${query.params.endTime} 23:59:59` });
    }
    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();
    return ResultData.ok({ list, total });
  }

  async gpsLogList(query: any) {
    const qb = this.gpsLogRepo.createQueryBuilder('g').where('g.delFlag = :delFlag', { delFlag: '0' }).orderBy('g.createdAt', 'DESC');
    applyTenantScope(qb, 'g', this.tenantContextService, { tenantColumn: 'tenantId', requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('g.deviceNo LIKE :no', { no: `%${query.deviceNo}%` });
    if (query.userId) qb.andWhere('g.userId = :uid', { uid: query.userId });
    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();
    return ResultData.ok({ list, total });
  }

  async eventLogList(query: any) {
    const qb = this.eventLogRepo.createQueryBuilder('e').where('e.delFlag = :delFlag', { delFlag: '0' }).orderBy('e.createdAt', 'DESC');
    applyTenantScope(qb, 'e', this.tenantContextService, { tenantColumn: 'tenantId', requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('e.deviceNo LIKE :no', { no: `%${query.deviceNo}%` });
    if (query.eventType) qb.andWhere('e.eventType = :eventType', { eventType: query.eventType });
    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();
    return ResultData.ok({ list, total });
  }

  async recordDelete(id: number) {
    const record = await this.audioRepo.findOne({ where: { id, delFlag: '0' } });
    if (!record) return ResultData.fail(404, '录音记录不存在');
    this.ensureTenantAccess(record.tenantId);
    await this.audioRepo.update({ id }, { delFlag: '1', updateTime: new Date() });
    return ResultData.ok(null, '删除成功');
  }

  async manualTranscribe(id: number) {
    const record = await this.audioRepo.findOne({ where: { id, delFlag: '0' } });
    if (!record) return ResultData.fail(500, '录音记录不存在');
    this.ensureTenantAccess(record.tenantId);
    if (!record.fileUrl) return ResultData.fail(400, '该记录没有播放链接，无法转写');

    this.triggerAsrWorkflow(record.fileName, record.fileUrl, true).catch((err) => {
      this.logger.error(`[ASR] 手动转写异常 - ${record.fileName}: ${err.message}`);
    });

    return ResultData.ok({ id, fileName: record.fileName }, '已提交转写任务，请稍后刷新查看结果');
  }

  async rebuildTranscriptText(id: number) {
    const record = await this.audioRepo.findOne({ where: { id, delFlag: '0' } });
    if (!record) throw new Error('录音记录不存在');
    this.ensureTenantAccess(record.tenantId);
    if (!record.transcriptRaw) throw new Error('没有原始 JSON');

    const raw = JSON.parse(record.transcriptRaw);
    const sentences = raw.transcripts?.[0]?.sentences || raw.data?.segments || [];
    if (sentences.length === 0) throw new Error('没有句子数据');

    const baseTime = record.startTime ? dayjs(record.startTime) : null;
    const formatted = sentences
      .map((sentence: any) => {
        const speaker = sentence.speaker_id ?? sentence.speakerId ?? 0;
        const offset = sentence.begin_time || sentence.startMillisecond || 0;
        const timeText = baseTime ? baseTime.add(offset, 'millisecond').format('HH:mm:ss') : '';
        const content = sentence.text || '';
        return timeText ? `[${timeText}] 说话人${speaker}: ${content}` : `说话人${speaker}: ${content}`;
      })
      .join('\n');

    await this.audioRepo.update({ id }, { transcriptText: formatted, updateTime: new Date() });
    this.logger.log(`[重组] id=${id} ${record.fileName} 完成`);
  }

  async reportDetail(id: number) {
    const report = await this.reportRepo.findOne({ where: { id, delFlag: '0' } });
    if (!report) return ResultData.fail(500, '日报不存在');
    return ResultData.ok(this.attachReportCard(report));
  }

  async reportList(query: any) {
    const qb = this.reportRepo.createQueryBuilder('r').where('r.delFlag = :delFlag', { delFlag: '0' }).orderBy('r.reportDate', 'DESC').addOrderBy('r.createTime', 'DESC');

    if (query.deviceNo) qb.andWhere('r.deviceNo LIKE :no', { no: `%${query.deviceNo}%` });
    if (query.userId) qb.andWhere('r.userId = :uid', { uid: query.userId });
    if (query.dateStr) qb.andWhere('r.reportDate = :dateStr', { dateStr: query.dateStr });
    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();
    return ResultData.ok({ list: list.map((item) => this.attachReportCard(item)), total });
  }

  private async triggerAsrWorkflow(fileName: string, fileUrl: string, force = false) {
    if (!fileName || !fileUrl) return;

    if (!force) {
      const autoAsr = await this.sysConfig.getConfigValue('smartBadge.autoAsr');
      if (autoAsr !== 'true') {
        this.logger.debug(`[ASR] 自动转写已关闭，跳过 ${fileName}`);
        return;
      }
    }

    await this.audioRepo.update({ fileName }, { asrStatus: 'RUNNING', updateTime: new Date() });
    this.logger.log(`[ASR] 开始转写 ${fileName}`);

    try {
      const result = await this.cloudAsr.transcribe(fileUrl);
      await this.audioRepo.update(
        { fileName },
        {
          transcriptText: result.text,
          transcriptRaw: result.rawJson,
          asrStatus: 'SUCCESS',
          updateTime: new Date(),
        },
      );
      this.logger.log(`[ASR] 转写成功 ${fileName}，共 ${result.sentences.length} 句，${result.text.length} 字符`);
    } catch (err) {
      this.logger.error(`[ASR] 转写失败 ${fileName} - ${err.message}`);
      await this.audioRepo.update({ fileName }, { asrStatus: 'FAILED', updateTime: new Date() });
    }
  }

  async concatDailyTranscript() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    this.logger.log(`开始拼接录音文本，日期: ${dateStr}`);

    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59`);

    const result = await this.audioRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.userId', 'userId')
      .where('a.startTime >= :dayStart', { dayStart })
      .andWhere('a.startTime <= :dayEnd', { dayEnd })
      .andWhere('a.asrStatus = :status', { status: 'SUCCESS' })
      .getRawMany();

    const userIds = result.map((item) => item.userId).filter(Boolean);
    this.logger.log(`共有 ${userIds.length} 个用户需要拼接录音`);

    for (const userId of userIds) {
      try {
        const list = await this.audioRepo
          .createQueryBuilder('a')
          .where('a.userId = :userId', { userId })
          .andWhere('a.startTime >= :dayStart', { dayStart })
          .andWhere('a.startTime <= :dayEnd', { dayEnd })
          .andWhere('a.asrStatus = :status', { status: 'SUCCESS' })
          .orderBy('a.chunkIndex', 'ASC')
          .addOrderBy('a.startTime', 'ASC')
          .getMany();

        const concat = list
          .filter((item) => item.transcriptText)
          .map((item) => item.transcriptText)
          .join('\n');

        this.logger.log(`用户 ${userId} 拼接完成，共 ${concat.length} 字符`);
      } catch (err) {
        this.logger.error(`用户 ${userId} 拼接失败: ${err.message}`);
      }
    }

    this.logger.log('每日拼接任务执行完毕');
  }
}
