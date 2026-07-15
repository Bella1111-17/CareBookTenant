import { ForbiddenException } from '@nestjs/common';
import { TenantBadgeBindingEntity } from './entities/tenant-badge-binding.entity';
import { TenantCareService } from './tenant-care.service';

function createQueryBuilderMock() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    clone: jest.fn(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawAndEntities: jest.fn().mockResolvedValue({ entities: [], raw: [] }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ count: 0 }),
    getOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };
  qb.clone.mockReturnValue(qb);
  return qb;
}

describe('TenantCareService tenant isolation', () => {
  const caregiverRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const orgUnitRepo = {};
  const bindingRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const reportRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const deviceRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const audioRepo = {
    createQueryBuilder: jest.fn(),
  };
  const gpsRepo = {
    createQueryBuilder: jest.fn(),
  };
  const eventRepo = {
    createQueryBuilder: jest.fn(),
  };
  const tenantRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const userRepo = {
    findOne: jest.fn(),
  };
  const tenantContextService = {
    isPlatformUser: jest.fn(),
    getTenantId: jest.fn(),
    getUserScope: jest.fn(),
    getUserId: jest.fn(),
  };
  const http = {};
  const config = {
    get: jest.fn(),
  };

  let service: TenantCareService;
  let deviceManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    deviceManager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => value),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    caregiverRepo.findOne.mockResolvedValue(null);
    caregiverRepo.create.mockImplementation((value) => value);
    caregiverRepo.save.mockImplementation(async (value) => value);
    caregiverRepo.update.mockResolvedValue({ affected: 1 });
    bindingRepo.findOne.mockResolvedValue(null);
    bindingRepo.update.mockResolvedValue({ affected: 1 });
    bindingRepo.manager.transaction.mockResolvedValue(undefined);
    deviceRepo.findOne.mockResolvedValue(null);
    deviceRepo.create.mockImplementation((value) => value);
    deviceRepo.save.mockImplementation(async (value) => value);
    deviceRepo.update.mockResolvedValue({ affected: 1 });
    deviceRepo.manager.transaction.mockImplementation(async (callback) => callback(deviceManager));
    reportRepo.findOne.mockResolvedValue(null);
    reportRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    reportRepo.create.mockImplementation((value) => value);
    reportRepo.save.mockImplementation(async (value) => ({ id: 101, ...value }));
    reportRepo.update.mockResolvedValue({ affected: 1 });
    audioRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    gpsRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    eventRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    tenantRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    tenantRepo.findOne.mockResolvedValue(null);
    userRepo.findOne.mockResolvedValue(null);
    tenantContextService.getUserId.mockReturnValue(null);
    config.get.mockReturnValue('');
    service = new TenantCareService(
      caregiverRepo as any,
      orgUnitRepo as any,
      bindingRepo as any,
      reportRepo as any,
      deviceRepo as any,
      audioRepo as any,
      gpsRepo as any,
      eventRepo as any,
      tenantRepo as any,
      userRepo as any,
      tenantContextService as any,
      http as any,
      config as any,
    );
  });

  it('filters tenant A caregiver list to tenant A even when tenant B is requested', async () => {
    const qb = createQueryBuilderMock();
    caregiverRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    await service.listCaregivers({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(qb.andWhere).toHaveBeenCalledWith('c.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith('c.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-b',
    });
  });

  it('allows platform users to scope caregiver list to requested tenant B', async () => {
    const qb = createQueryBuilderMock();
    caregiverRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    await service.listCaregivers({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(qb.andWhere).toHaveBeenCalledWith('c.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-b',
    });
  });

  it('rejects tenant A reading tenant B daily report detail', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    reportRepo.findOne.mockResolvedValue({ id: 7, tenantId: 'tenant-b', delFlag: '0' });

    await expect(service.dailyReportDetail(7)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('prevents tenant A from binding a device already owned by tenant B', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    caregiverRepo.findOne.mockResolvedValue({ id: 11, tenantId: 'tenant-a', delFlag: '0' });
    deviceRepo.findOne.mockResolvedValue({ id: 1, deviceNo: 'BADGE-001', tenantId: 'tenant-b' });

    const result = await service.bindBadge({ tenantCaregiverId: 11, deviceNo: 'BADGE-001' } as any);

    expect(result.code).toBe(403);
    expect(bindingRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('disables tenant daily report batch generation without a device number', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    const result = await service.generateDailyReport({ dateStr: '2026-07-10' } as any);

    expect(result.code).toBe(400);
    expect(deviceRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('allows explicit unbound test report generation by device and file name', async () => {
    const audioQb = createQueryBuilderMock();
    const reportQb = createQueryBuilderMock();
    const startTime = new Date('2026-07-04T18:25:11+08:00');
    const endTime = new Date('2026-07-04T18:35:11+08:00');
    audioQb.getMany.mockResolvedValue([
      {
        deviceNo: 'BG868668088921593',
        fileName: 'BG868668088921593-260704182511260704183511-A057-00000000.mp3',
        startTime,
        endTime,
        asrStatus: 'SUCCESS',
        transcriptText: '测试转写文本',
        transcriptRaw: JSON.stringify({ transcripts: [{ content_duration_in_milliseconds: 600000 }] }),
      },
    ]);
    reportQb.getOne.mockResolvedValue(null);
    audioRepo.createQueryBuilder.mockReturnValue(audioQb);
    reportRepo.createQueryBuilder.mockReturnValue(reportQb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);
    deviceRepo.findOne.mockResolvedValue(null);

    const result = await service.generateDailyReport({
      deviceNo: 'BG868668088921593',
      dateStr: '2026-07-04',
      fileName: 'BG868668088921593-260704182511260704183511-A057-00000000.mp3',
      allowUnboundAnalysis: true,
    } as any);

    expect(result.code).toBe(200);
    expect(audioQb.andWhere).toHaveBeenCalledWith('a.fileName = :fileName', {
      fileName: 'BG868668088921593-260704182511260704183511-A057-00000000.mp3',
    });
    expect(audioQb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('tenantScopeTenantId'), expect.anything());
    expect(audioQb.andWhere).not.toHaveBeenCalledWith('a.isolationStatus = :isolationStatus', expect.anything());
    expect(reportRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: null,
        deviceNo: 'BG868668088921593',
        reportDate: '2026-07-04',
      }),
    );
  });

  it('rejects platform users unbinding devices because platform is read-only', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);
    deviceRepo.findOne.mockResolvedValue({ id: 1, deviceNo: 'BADGE-001', tenantId: 'platform-self' });
    bindingRepo.findOne.mockResolvedValue({ id: 9, deviceNo: 'BADGE-001', tenantId: 'tenant-b', unbindAt: null });

    const result = await service.unbindBadge({ deviceNo: 'BADGE-001', unbindReason: 'replace device' } as any);

    expect(result.code).toBe(403);
    expect(bindingRepo.update).not.toHaveBeenCalled();
  });

  it('creates tenant device under the current tenant for tenant users', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    deviceRepo.findOne.mockResolvedValue(null);
    deviceRepo.save.mockImplementation(async (value) => value);

    const result = await service.createDevice({ deviceNo: 'badge-tenant-a', status: '0' } as any);

    expect(result.code).toBe(200);
    expect(deviceManager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-a',
        deviceNo: 'BADGE-TENANT-A',
      }),
    );
  });

  it('cleans up a historical soft-deleted row and creates a new tenant device', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    const deletedDevice = { id: 7, tenantId: 'tenant-a', deviceNo: 'BADGE-DELETED', delFlag: '1', status: '1', remark: 'old' };
    deviceRepo.findOne.mockResolvedValue(deletedDevice);

    const result = await service.createDevice({ deviceNo: 'badge-deleted', status: '0', remark: 'new device' } as any);

    expect(result.code).toBe(200);
    expect(deviceManager.delete).toHaveBeenCalledWith(expect.anything(), { id: 7 });
    expect(deviceManager.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-a',
        deviceNo: 'BADGE-DELETED',
        status: '0',
        remark: 'new device',
      }),
    );
  });

  it('rejects platform users creating tenant devices because platform is read-only', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    const result = await service.createDevice({ tenantId: 'tenant-a', deviceNo: 'badge-platform' } as any);

    expect(result.code).toBe(403);
    expect(deviceRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it('summarizes platform devices across all tenants when tenantId is not requested', async () => {
    const qb = createQueryBuilderMock();
    qb.getCount.mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    qb.getRawOne.mockResolvedValueOnce({ count: '2' });
    deviceRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    const result = await service.deviceSummary({ pageNum: 1, pageSize: 10 } as any);

    expect(result.data).toEqual({
      totalDevices: 5,
      assignedDevices: 3,
      idleDevices: 2,
      boundTenants: 2,
    });
    expect(qb.andWhere).toHaveBeenCalledWith("d.tenantId IS NOT NULL AND d.tenantId <> ''");
    expect(qb.andWhere).toHaveBeenCalledWith("(d.tenantId IS NULL OR d.tenantId = '')");
    expect(qb.andWhere).not.toHaveBeenCalledWith('d.tenantId = :tenantScopeTenantId', expect.anything());
  });

  it('summarizes platform devices within a requested tenant', async () => {
    const qb = createQueryBuilderMock();
    qb.getCount.mockResolvedValueOnce(4).mockResolvedValueOnce(4).mockResolvedValueOnce(0);
    qb.getRawOne.mockResolvedValueOnce({ count: '1' });
    deviceRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    const result = await service.deviceSummary({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(result.data).toEqual({
      totalDevices: 4,
      assignedDevices: 4,
      idleDevices: 0,
      boundTenants: 1,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('d.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-b',
    });
  });

  it('summarizes tenant devices using active caregiver bindings and tenant scope', async () => {
    const qb = createQueryBuilderMock();
    qb.getCount.mockResolvedValueOnce(4).mockResolvedValueOnce(2);
    qb.getRawOne.mockResolvedValueOnce({ count: '2' });
    deviceRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    const result = await service.deviceSummary({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(result.data).toEqual({
      totalDevices: 4,
      boundDevices: 2,
      idleDevices: 2,
      boundCaregivers: 2,
    });
    expect(qb.andWhere).toHaveBeenCalledWith('d.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith('d.tenantId = :tenantScopeTenantId', {
      tenantScopeTenantId: 'tenant-b',
    });
    expect(qb.innerJoin).toHaveBeenCalledWith(TenantBadgeBindingEntity, 'b', expect.stringContaining('b.unbindAt IS NULL'), expect.any(Object));
  });

  it('does not tenant-scope GPS logs for platform users without selected tenant', async () => {
    const qb = createQueryBuilderMock();
    gpsRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    await service.listGpsLogs({ pageNum: 1, pageSize: 10 } as any);

    expect(qb.leftJoin).toHaveBeenCalledWith(expect.any(Function), 'd', expect.stringContaining('d.deviceNo = g.deviceNo'), expect.any(Object));
    expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('tenantScopeTenantId'), expect.anything());
    expect(qb.orderBy).toHaveBeenCalledWith('g.reportTime', 'DESC', 'NULLS LAST');
  });

  it('filters GPS logs for tenant users by device ownership', async () => {
    const qb = createQueryBuilderMock();
    gpsRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    await service.listGpsLogs({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(qb.leftJoin).toHaveBeenCalledWith(expect.any(Function), 'd', expect.stringContaining('d.deviceNo = g.deviceNo'), expect.any(Object));
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM badge_device d'), {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('g.tenantId = :tenantScopeTenantId'), expect.anything());
    expect(qb.orderBy).toHaveBeenCalledWith('g.reportTime', 'DESC', 'NULLS LAST');
    expect(qb.orderBy).not.toHaveBeenCalledWith('COALESCE(g.reportTime, g.createdAt)', expect.anything());
  });

  it('does not tenant-scope device events for platform users without selected tenant', async () => {
    const qb = createQueryBuilderMock();
    eventRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);

    await service.listDeviceEvents({ pageNum: 1, pageSize: 10 } as any);

    expect(qb.leftJoin).toHaveBeenCalledWith(expect.any(Function), 'd', expect.stringContaining('d.deviceNo = e.deviceNo'), expect.any(Object));
    expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('tenantScopeTenantId'), expect.anything());
  });

  it('filters device events for tenant users by device ownership', async () => {
    const qb = createQueryBuilderMock();
    eventRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    await service.listDeviceEvents({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b' } as any);

    expect(qb.leftJoin).toHaveBeenCalledWith(expect.any(Function), 'd', expect.stringContaining('d.deviceNo = e.deviceNo'), expect.any(Object));
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM badge_device d'), {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('e.tenantId = :tenantScopeTenantId'), expect.anything());
  });

  it('filters record list for tenant users by device ownership', async () => {
    const qb = createQueryBuilderMock();
    audioRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    await service.listRecords({ pageNum: 1, pageSize: 10, tenantId: 'tenant-b', deviceNo: ' badge-001 ' } as any);

    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM badge_device d'), {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('a.deviceNo = :deviceNo', { deviceNo: 'BADGE-001' });
    expect(qb.andWhere).not.toHaveBeenCalledWith(expect.stringContaining('a.tenantId = :tenantScopeTenantId'), expect.anything());
  });

  it('uses device ownership when generating tenant daily report chunks', async () => {
    const audioQb = createQueryBuilderMock();
    const reportQb = createQueryBuilderMock();
    const startTime = new Date('2026-07-04T18:25:11+08:00');
    const endTime = new Date('2026-07-04T18:35:11+08:00');
    audioQb.getMany.mockResolvedValue([
      {
        deviceNo: 'BADGE-001',
        fileName: 'BADGE-001-260704182511260704183511-A057-00000000.mp3',
        startTime,
        endTime,
        asrStatus: 'SUCCESS',
        transcriptText: 'tenant report text',
        transcriptRaw: JSON.stringify({ transcripts: [{ content_duration_in_milliseconds: 600000 }] }),
      },
    ]);
    reportQb.getOne.mockResolvedValue(null);
    audioRepo.createQueryBuilder.mockReturnValue(audioQb);
    reportRepo.createQueryBuilder.mockReturnValue(reportQb);
    bindingRepo.createQueryBuilder.mockReturnValue(createQueryBuilderMock());
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');

    const result = await service.generateDailyReport({
      deviceNo: 'BADGE-001',
      dateStr: '2026-07-04',
    } as any);

    expect(result.code).toBe(200);
    expect(audioQb.andWhere).toHaveBeenCalledWith(expect.stringContaining('FROM badge_device d'), {
      tenantScopeTenantId: 'tenant-a',
    });
    expect(audioQb.andWhere).not.toHaveBeenCalledWith('a.tenantId = :tenantId', expect.anything());
    expect(audioQb.andWhere).toHaveBeenCalledWith('a.isolationStatus = :isolationStatus', {
      isolationStatus: 'NORMAL',
    });
  });

  it('normalizes Dify outputs when result is empty and fields are top-level', () => {
    const output = (service as any).extractWorkflowOutput({
      result: '',
      cleaned_transcript: '',
      daily_report: 'no valid care interaction',
      emotion_summary: 'cannot evaluate emotion',
      service_score: {
        professionalism: 0,
        attitude: 0,
        responsiveness: 0,
        detail: 0,
        comment: 'no service happened',
      },
      report_card: {
        overallScore: 0,
        aiSummary: 'no real interaction detected',
        dimensionScores: {
          communication: 0,
          operation: 0,
          response: 0,
          safety: 0,
          care: 0,
          completeness: 0,
        },
        scoreComment: 'technical test conversation',
      },
    });
    const normalized = (service as any).normalizeWorkflowPayload(output);

    expect(normalized.summaryText).toBe('no valid care interaction');
    expect(normalized.emotionSummary).toBe('cannot evaluate emotion');
    expect(normalized.serviceScore.comment).toBe('no service happened');
    expect(normalized.reportCard.aiSummary).toBe('no valid care interaction');
    expect(normalized.reportCard.scoreComment).toBe('technical test conversation');
  });

  it('parses fenced JSON from Dify result', () => {
    const output = (service as any).extractWorkflowOutput({
      result: '```json\n{"analysis_payload":{"summary":"report generated"},"score_payload":{"overallScore":8}}\n```',
    });
    const normalized = (service as any).normalizeWorkflowPayload(output);

    expect(normalized.summaryText).toBe('report generated');
    expect(normalized.reportCard.overallScore).toBe(8);
  });
  it('prevents deleting a tenant device while it has an active binding', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    deviceRepo.findOne.mockResolvedValue({ id: 3, tenantId: 'tenant-a', deviceNo: 'BADGE-003', delFlag: '0' });
    bindingRepo.findOne.mockResolvedValue({ id: 8, tenantId: 'tenant-a', deviceNo: 'BADGE-003', unbindAt: null });

    const result = await service.deleteDevice(3);

    expect(result.code).toBe(400);
    expect(deviceManager.delete).not.toHaveBeenCalled();
  });

  it('hard deletes an idle tenant device after tenant confirmation', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    deviceRepo.findOne.mockResolvedValue({ id: 4, tenantId: 'tenant-a', deviceNo: 'BADGE-IDLE', delFlag: '0' });
    bindingRepo.findOne.mockResolvedValue(null);

    const result = await service.deleteDevice(4);

    expect(result.code).toBe(200);
    expect(deviceManager.delete).toHaveBeenCalledWith(expect.anything(), { id: 4 });
  });

  it('prevents deleting a tenant caregiver while it has an active binding', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    caregiverRepo.findOne.mockResolvedValue({ id: 11, tenantId: 'tenant-a', delFlag: '0' });
    bindingRepo.findOne.mockResolvedValue({ id: 8, tenantId: 'tenant-a', tenantCaregiverId: 11, unbindAt: null });

    const result = await service.deleteCaregiver(11);

    expect(result.code).toBe(400);
    expect(caregiverRepo.update).not.toHaveBeenCalled();
  });
});
