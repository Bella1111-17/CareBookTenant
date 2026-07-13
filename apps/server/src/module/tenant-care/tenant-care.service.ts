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
import { DeviceEventLogEntity } from 'src/module/system/smart-badge/entities/device-event-log.entity';
import { DeviceGpsLogEntity } from 'src/module/system/smart-badge/entities/device-gps-log.entity';
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
  ListTenantDeviceEventDto,
  ListTenantGpsDto,
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
    @InjectRepository(DeviceGpsLogEntity) private readonly gpsRepo: Repository<DeviceGpsLogEntity>,
    @InjectRepository(DeviceEventLogEntity) private readonly eventRepo: Repository<DeviceEventLogEntity>,
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
          .select(['b.tenantId AS tenantId', 'b.deviceNo AS deviceNo', 'b.tenantCaregiverId AS tenantCaregiverId', 'b.bindAt AS bindAt', 'c.realName AS caregiverName', 'c.phone AS caregiverPhone'])
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

  async listGpsLogs(query: ListTenantGpsDto) {
    const qb = this.gpsRepo
      .createQueryBuilder('g')
      .innerJoin(BadgeDeviceEntity, 'd', 'd.deviceNo = g.deviceNo AND d.delFlag = :deviceDelFlag', { deviceDelFlag: '0' })
      .leftJoin(
        TenantBadgeBindingEntity,
        'b',
        'b.tenantId = d.tenantId AND b.deviceNo = d.deviceNo AND b.delFlag = :bindingDelFlag AND b.bindAt <= COALESCE(g.reportTime, g.createdAt) AND (b.unbindAt IS NULL OR b.unbindAt >= COALESCE(g.reportTime, g.createdAt))',
        { bindingDelFlag: '0' },
      )
      .leftJoin(TenantCaregiverEntity, 'c', 'c.id = b.tenantCaregiverId AND c.tenantId = d.tenantId AND c.delFlag = :caregiverDelFlag', { caregiverDelFlag: '0' })
      .select(['g'])
      .addSelect('d.tenantId', 'deviceTenantId')
      .addSelect('b.tenantCaregiverId', 'tenantCaregiverId')
      .addSelect('c.realName', 'caregiverName')
      .addSelect('c.phone', 'caregiverPhone')
      .where('g.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('g.reportTime', 'DESC', 'NULLS LAST')
      .addOrderBy('g.createdAt', 'DESC');
    applyTenantScope(qb as any, 'd', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('g.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.tenantCaregiverId) qb.andWhere('b.tenantCaregiverId = :tenantCaregiverId', { tenantCaregiverId: query.tenantCaregiverId });
    if (query.beginTime) qb.andWhere('COALESCE(g.reportTime, g.createdAt) >= :beginTime', { beginTime: `${query.beginTime} 00:00:00` });
    if (query.endTime) qb.andWhere('COALESCE(g.reportTime, g.createdAt) <= :endTime', { endTime: `${query.endTime} 23:59:59` });

    const countQb = qb.clone();
    this.page(qb, query);
    const [rows, total] = await Promise.all([qb.getRawAndEntities(), countQb.getCount()]);
    const list = rows.entities.map((item, index) => ({
      ...item,
      tenantId: rows.raw[index]?.deviceTenantId || rows.raw[index]?.devicetenantid || item.tenantId,
      deviceTenantId: rows.raw[index]?.deviceTenantId || rows.raw[index]?.devicetenantid || null,
      tenantCaregiverId: rows.raw[index]?.tenantCaregiverId || rows.raw[index]?.tenantcaregiverid || null,
      caregiverName: rows.raw[index]?.caregiverName || rows.raw[index]?.caregivername || '',
      caregiverPhone: rows.raw[index]?.caregiverPhone || rows.raw[index]?.caregiverphone || '',
    }));
    return ResultData.ok({ list, total });
  }

  async listDeviceEvents(query: ListTenantDeviceEventDto) {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .innerJoin(BadgeDeviceEntity, 'd', 'd.deviceNo = e.deviceNo AND d.delFlag = :deviceDelFlag', { deviceDelFlag: '0' })
      .leftJoin(
        TenantBadgeBindingEntity,
        'b',
        'b.tenantId = d.tenantId AND b.deviceNo = d.deviceNo AND b.delFlag = :bindingDelFlag AND b.bindAt <= e.createdAt AND (b.unbindAt IS NULL OR b.unbindAt >= e.createdAt)',
        { bindingDelFlag: '0' },
      )
      .leftJoin(TenantCaregiverEntity, 'c', 'c.id = b.tenantCaregiverId AND c.tenantId = d.tenantId AND c.delFlag = :caregiverDelFlag', { caregiverDelFlag: '0' })
      .select(['e'])
      .addSelect('d.tenantId', 'deviceTenantId')
      .addSelect('b.tenantCaregiverId', 'tenantCaregiverId')
      .addSelect('c.realName', 'caregiverName')
      .addSelect('c.phone', 'caregiverPhone')
      .where('e.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('e.createdAt', 'DESC');
    applyTenantScope(qb as any, 'd', this.tenantContextService, { requestedTenantId: query.tenantId });

    if (query.deviceNo) qb.andWhere('e.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.eventType) qb.andWhere('e.eventType = :eventType', { eventType: query.eventType });
    if (query.eventStatus) qb.andWhere('e.eventStatus = :eventStatus', { eventStatus: query.eventStatus });
    if (query.tenantCaregiverId) qb.andWhere('b.tenantCaregiverId = :tenantCaregiverId', { tenantCaregiverId: query.tenantCaregiverId });
    if (query.beginTime) qb.andWhere('e.createdAt >= :beginTime', { beginTime: `${query.beginTime} 00:00:00` });
    if (query.endTime) qb.andWhere('e.createdAt <= :endTime', { endTime: `${query.endTime} 23:59:59` });

    const countQb = qb.clone();
    this.page(qb, query);
    const [rows, total] = await Promise.all([qb.getRawAndEntities(), countQb.getCount()]);
    const list = rows.entities.map((item, index) => ({
      ...item,
      tenantId: rows.raw[index]?.deviceTenantId || rows.raw[index]?.devicetenantid || item.tenantId,
      deviceTenantId: rows.raw[index]?.deviceTenantId || rows.raw[index]?.devicetenantid || null,
      tenantCaregiverId: rows.raw[index]?.tenantCaregiverId || rows.raw[index]?.tenantcaregiverid || null,
      caregiverName: rows.raw[index]?.caregiverName || rows.raw[index]?.caregivername || '',
      caregiverPhone: rows.raw[index]?.caregiverPhone || rows.raw[index]?.caregiverphone || '',
    }));
    return ResultData.ok({ list, total });
  }

  private async findTenantCaregiverId(tenantId: string, deviceNo: string, startAt: Date, endAt: Date): Promise<number | null> {
    // 查找设备当前绑定关系时，同时用 caregiver 表的 tenantId 做校验，避免跨租户数据串读
    const binding = await this.bindingRepo
      .createQueryBuilder('b')
      .leftJoin(TenantCaregiverEntity, 'c', 'c.id = b.tenantCaregiverId AND c.tenantId = b.tenantId')
      .where('b.tenantId = :tenantId', { tenantId })
      .andWhere('b.deviceNo = :deviceNo', { deviceNo })
      .andWhere('b.bindAt <= :endAt', { endAt })
      .andWhere('(b.unbindAt IS NULL OR b.unbindAt >= :startAt)', { startAt })
      .andWhere('b.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('c.id IS NOT NULL') // 确保绑定的护工有效且属于同一租户
      .orderBy('b.bindAt', 'DESC')
      .getOne();
    return binding?.tenantCaregiverId || null;
  }

  private async fetchChunks(tenantId: string | null, deviceNo: string, dateStr: string, options: { fileName?: string; allowUnboundAnalysis?: boolean } = {}) {
    const dayStart = dayjs(dateStr).startOf('day').toDate();
    const dayEnd = dayjs(dateStr).endOf('day').toDate();
    const qb = this.audioRepo
      .createQueryBuilder('a')
      .where('a.deviceNo = :deviceNo', { deviceNo })
      .andWhere('a.startTime >= :dayStart AND a.startTime <= :dayEnd', { dayStart, dayEnd })
      .andWhere('a.asrStatus = :status', { status: 'SUCCESS' })
      .andWhere('a.chunkIndex IS NOT NULL')
      .andWhere('a.delFlag = :delFlag', { delFlag: '0' });

    if (options.fileName) {
      qb.andWhere('a.fileName = :fileName', { fileName: options.fileName });
    }

    if (options.allowUnboundAnalysis) {
      return qb.orderBy('a.startTime', 'ASC').getMany();
    }

    return qb.andWhere('a.tenantId = :tenantId', { tenantId }).andWhere('a.isolationStatus = :isolationStatus', { isolationStatus: 'NORMAL' }).orderBy('a.startTime', 'ASC').getMany();
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
    const normalized = raw.trim();
    if (!normalized) return {};
    const fenced = normalized.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const jsonText = fenced ? fenced[1].trim() : normalized;
    try {
      return JSON.parse(jsonText);
    } catch {
      return {};
    }
  }

  private extractWorkflowOutput(outputs: Record<string, any>) {
    if (!outputs || typeof outputs !== 'object') return {};
    const parsedResult = this.parseWorkflowOutput(outputs.result);
    if (parsedResult && Object.keys(parsedResult).length > 0) return parsedResult;
    return outputs;
  }

  private normalizeWorkflowPayload(output: any) {
    const reportCard = output?.report_card && typeof output.report_card === 'object' ? output.report_card : {};
    const analysisPayload =
      output?.analysis_payload && typeof output.analysis_payload === 'object'
        ? output.analysis_payload
        : {
            summary: output?.daily_report || reportCard.aiSummary || reportCard.analysisPayload?.summary,
            emotionSummary: output?.emotion_summary || reportCard.emotionSummary || reportCard.analysisPayload?.emotionSummary,
            tasksCompleted: reportCard.tasksCompleted || reportCard.analysisPayload?.tasksCompleted,
            highlights: reportCard.highlights || reportCard.analysisPayload?.highlights,
            riskAlerts: reportCard.riskAlerts || reportCard.analysisPayload?.riskAlerts,
            warmMoments: reportCard.warmMoments || reportCard.analysisPayload?.warmMoments,
            evidenceSnippets: reportCard.evidenceSnippets || reportCard.analysisPayload?.evidenceSnippets,
            visitStats: reportCard.visitStats || reportCard.analysisPayload?.visitStats,
            medicalFeedback: reportCard.medicalFeedback || reportCard.analysisPayload?.medicalFeedback,
          };
    const scorePayload =
      output?.score_payload && typeof output.score_payload === 'object'
        ? output.score_payload
        : {
            overallScore: reportCard.overallScore,
            dimensionScores: reportCard.dimensionScores,
            scoreComment: reportCard.scoreComment,
            serviceScore: output?.service_score || reportCard.serviceScore || reportCard.scorePayload?.serviceScore,
          };
    const cleanedTranscript = String(output?.cleaned_transcript || '').trim();
    return {
      cleanedTranscript,
      summaryText: String(analysisPayload.summary || output?.daily_report || '').trim(),
      emotionSummary: String(analysisPayload.emotionSummary || output?.emotion_summary || '').trim(),
      serviceScore: scorePayload.serviceScore || null,
      reportCard: buildReportCard({ analysisPayload, scorePayload, cleanedTranscript }),
    };
  }

  private formatAiFailureReason(err: any) {
    const status = err?.response?.status;
    const responseData = err?.response?.data;
    const responseText = responseData ? JSON.stringify(responseData) : '';
    const message = [status ? `HTTP ${status}` : '', err?.message || '', responseText].filter(Boolean).join(' ');
    return message.slice(0, 450);
  }

  private async fillTenantReportWithAI(reportId: number, tenantId: string | null, deviceNo: string, dateStr: string, chunks: AudioRecordEntity[]) {
    const timelineText = this.trimTimelineText(this.buildTimelineText(deviceNo, dateStr, chunks));
    const rawJsonAgg = this.buildRawJsonAggregate(chunks);
    await this.reportRepo.update({ id: reportId }, { asrPayload: timelineText, rawAsrJsonAggregate: rawJsonAgg, generationStatus: 'AI_PENDING', remark: 'AI 日报已开始投喂 Dify' });

    if (!timelineText.trim()) {
      await this.reportRepo.update({ id: reportId }, { generationStatus: 'NO_TEXT', qualityStatus: 'NEEDS_REVIEW', remark: '没有可投喂 Dify 的转写文本' });
      return;
    }

    const apiKey = this.config.get<string>('dify.badgeDailyReportKey') || '';
    const baseUrl = this.config.get<string>('dify.baseUrl') || 'http://8.153.70.109/v1';
    if (!apiKey || apiKey === 'app-xxxxxxxxxxxxxxxx') {
      this.logger.warn('[tenant-care] TOB_DIFY_BADGE_DAILY_REPORT_KEY 未配置，跳过 AI 日报生成');
      await this.reportRepo.update({ id: reportId }, { generationStatus: 'CONFIG_MISSING', qualityStatus: 'NEEDS_REVIEW', remark: 'TOB_DIFY_BADGE_DAILY_REPORT_KEY 未配置' });
      return;
    }
    if (/^https?:\/\//i.test(apiKey)) {
      this.logger.warn('[tenant-care] Dify Key 不能是 URL，请把 http://8.153.70.109/v1 配到 TOB_DIFY_BASE_URL，把 app- 开头的应用 Key 配到 TOB_DIFY_BADGE_DAILY_REPORT_KEY');
      await this.reportRepo.update(
        { id: reportId },
        { generationStatus: 'CONFIG_INVALID', qualityStatus: 'NEEDS_REVIEW', remark: 'TOB_DIFY_BADGE_DAILY_REPORT_KEY 配成了 URL，应配置 app- 开头的应用 Key' },
      );
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
            relation_source: 'offline',
          },
          response_mode: 'blocking',
          user: `tenant_report_${tenantId || 'unbound'}_${deviceNo}_${dateStr}`,
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
    this.logger.log(`[tenant-care] 设备 ${deviceNo} Dify 返回 outputs 字段: ${Object.keys(outputs).join(',') || '-'}`);
    const normalized = this.normalizeWorkflowPayload(this.extractWorkflowOutput(outputs));
    await this.reportRepo.update(
      { id: reportId },
      {
        fullTranscript: normalized.cleanedTranscript,
        summaryText: normalized.summaryText,
        serviceScore: normalized.serviceScore || null,
        reportCard: normalized.reportCard as any,
        emotionSummary: normalized.emotionSummary,
        generationStatus: 'SUCCESS',
        qualityStatus: 'NORMAL',
        remark: 'AI 日报生成完成',
        updateTime: new Date(),
      },
    );
  }

  async generateDailyReport(dto: GenerateTenantDailyReportDto) {
    if (!dto.deviceNo) {
      return ResultData.fail(400, '批量生成日报已临时停用，请指定设备号');
    }

    const deviceNo = this.normalizeDeviceNo(dto.deviceNo);
    const fileName = String(dto.fileName || '').trim();
    if (dto.allowUnboundAnalysis && !fileName) {
      return ResultData.fail(400, '临时未绑定分析必须传 fileName，避免误分析整台设备当天数据');
    }

    const device = await this.deviceRepo.findOne({ where: { deviceNo } });
    const tenantId = dto.allowUnboundAnalysis
      ? dto.tenantId
        ? this.resolveWriteTenantId(dto.tenantId)
        : device?.tenantId || (this.tenantContextService.isPlatformUser() ? null : this.tenantContextService.getTenantId())
      : dto.tenantId
        ? this.resolveWriteTenantId(dto.tenantId)
        : this.resolveWriteTenantId(device?.tenantId);
    const report = await this.generateOne(tenantId, deviceNo, dto.dateStr, {
      fileName,
      allowUnboundAnalysis: dto.allowUnboundAnalysis,
    });
    return ResultData.ok(report, '租户日报生成成功');
  }

  private async generateOne(tenantId: string | null, deviceNo: string, dateStr: string, options: { fileName?: string; allowUnboundAnalysis?: boolean } = {}) {
    if (tenantId) this.ensureTenantAccess(tenantId);
    const chunks = await this.fetchChunks(tenantId, deviceNo, dateStr, options);
    if (!chunks.length) throw new Error(`设备 ${deviceNo} 在 ${dateStr} 没有可用转写切片`);
    if (chunks.some((chunk) => chunk.asrStatus === 'RUNNING')) throw new Error('仍有切片转写中，请稍后重试');
    const metrics = this.computeMetrics(chunks);
    const firstChunkStart = chunks.reduce<Date | null>((min, chunk) => {
      if (!chunk.startTime) return min;
      const startTime = dayjs(chunk.startTime).toDate();
      return !min || startTime < min ? startTime : min;
    }, null);
    const lastChunkEnd = chunks.reduce<Date | null>((max, chunk) => {
      const endTime = dayjs(chunk.endTime || chunk.startTime).toDate();
      return !max || endTime > max ? endTime : max;
    }, null);
    const tenantCaregiverId = tenantId
      ? await this.findTenantCaregiverId(tenantId, deviceNo, firstChunkStart || dayjs(dateStr).startOf('day').toDate(), lastChunkEnd || dayjs(dateStr).endOf('day').toDate())
      : null;

    let report = tenantId
      ? await this.reportRepo.findOne({ where: { tenantId, deviceNo, reportDate: dateStr, delFlag: '0' } })
      : await this.reportRepo
          .createQueryBuilder('r')
          .where('r.tenantId IS NULL')
          .andWhere('r.deviceNo = :deviceNo', { deviceNo })
          .andWhere('r.reportDate = :dateStr', { dateStr })
          .andWhere('r.delFlag = :delFlag', { delFlag: '0' })
          .getOne();
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
      const reason = this.formatAiFailureReason(err);
      this.logger.error(`[tenant-care] 设备 ${deviceNo} AI日报生成失败: ${reason}`);
      this.reportRepo.update({ id: report.id }, { generationStatus: 'FAILED', qualityStatus: 'NEEDS_REVIEW', remark: reason || 'AI 日报生成失败', updateTime: new Date() }).catch(() => undefined);
    });
    return report;
  }

  async listDailyReports(query: ListTenantDailyReportDto) {
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .leftJoin(TenantBadgeBindingEntity, 'b', 'b.tenantId = r.tenantId AND b.deviceNo = r.deviceNo AND b.unbindAt IS NULL AND b.delFlag = :bindingDelFlag', { bindingDelFlag: '0' })
      .leftJoin(TenantCaregiverEntity, 'c', 'c.id = COALESCE(r.tenantCaregiverId, b.tenantCaregiverId) AND c.tenantId = r.tenantId')
      .select(['r', 'COALESCE(r.tenantCaregiverId, b.tenantCaregiverId) AS effectiveTenantCaregiverId', 'c.realName AS caregiverName', 'c.phone AS caregiverPhone'])
      .where('r.delFlag = :delFlag', { delFlag: '0' })
      .orderBy('r.reportDate', 'DESC')
      .addOrderBy('r.createTime', 'DESC');
    applyTenantScope(qb, 'r', this.tenantContextService, { requestedTenantId: query.tenantId });
    if (query.deviceNo) qb.andWhere('r.deviceNo LIKE :deviceNo', { deviceNo: `%${this.normalizeDeviceNo(query.deviceNo)}%` });
    if (query.tenantCaregiverId) qb.andWhere('COALESCE(r.tenantCaregiverId, b.tenantCaregiverId) = :tenantCaregiverId', { tenantCaregiverId: query.tenantCaregiverId });
    if (query.dateStr) qb.andWhere('r.reportDate = :dateStr', { dateStr: query.dateStr });
    const countQb = qb.clone();
    this.page(qb, query);
    const [rows, total] = await Promise.all([qb.getRawAndEntities(), countQb.getCount()]);
    const list = rows.entities.map((item, index) => ({
      ...this.attachReportCard(item),
      tenantCaregiverId: item.tenantCaregiverId ?? rows.raw[index]?.effectiveTenantCaregiverId ?? rows.raw[index]?.effectivetenantcaregiverid ?? null,
      caregiverName: rows.raw[index]?.caregiverName || rows.raw[index]?.caregivername || '',
      caregiverPhone: rows.raw[index]?.caregiverPhone || rows.raw[index]?.caregiverphone || '',
    }));
    return ResultData.ok({ list, total });
  }

  async dailyReportDetail(id: number) {
    const report = await this.reportRepo.findOne({ where: { id, delFlag: '0' } });
    if (!report) return ResultData.fail(404, '租户日报不存在');
    this.ensureTenantAccess(report.tenantId);
    const fallbackBinding = report.tenantCaregiverId
      ? null
      : await this.bindingRepo.findOne({
          where: {
            tenantId: report.tenantId,
            deviceNo: report.deviceNo,
            unbindAt: IsNull(),
            delFlag: '0',
          },
        });
    const tenantCaregiverId = report.tenantCaregiverId ?? fallbackBinding?.tenantCaregiverId ?? null;
    const caregiver = tenantCaregiverId ? await this.caregiverRepo.findOne({ where: { id: tenantCaregiverId, tenantId: report.tenantId, delFlag: '0' } }) : null;
    return ResultData.ok({
      ...this.attachReportCard(report),
      tenantCaregiverId,
      caregiverName: caregiver?.realName || '',
      caregiverPhone: caregiver?.phone || '',
    });
  }
}
