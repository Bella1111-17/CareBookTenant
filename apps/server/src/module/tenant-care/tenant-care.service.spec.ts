import { ForbiddenException } from '@nestjs/common';
import { TenantCareService } from './tenant-care.service';

function createQueryBuilderMock() {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
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
    manager: { transaction: jest.fn() },
  };
  const reportRepo = {
    findOne: jest.fn(),
  };
  const deviceRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const audioRepo = {};
  const tenantContextService = {
    isPlatformUser: jest.fn(),
    getTenantId: jest.fn(),
  };
  const http = {};
  const config = {};

  let service: TenantCareService;

  beforeEach(() => {
    jest.clearAllMocks();
    caregiverRepo.findOne.mockResolvedValue(null);
    caregiverRepo.create.mockImplementation((value) => value);
    caregiverRepo.save.mockImplementation(async (value) => value);
    caregiverRepo.update.mockResolvedValue({ affected: 1 });
    bindingRepo.findOne.mockResolvedValue(null);
    bindingRepo.manager.transaction.mockResolvedValue(undefined);
    deviceRepo.findOne.mockResolvedValue(null);
    deviceRepo.create.mockImplementation((value) => value);
    deviceRepo.save.mockImplementation(async (value) => value);
    deviceRepo.update.mockResolvedValue({ affected: 1 });
    reportRepo.findOne.mockResolvedValue(null);
    service = new TenantCareService(
      caregiverRepo as any,
      orgUnitRepo as any,
      bindingRepo as any,
      reportRepo as any,
      deviceRepo as any,
      audioRepo as any,
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

  it('uses the active binding tenant when platform unbinds a device with stale device tenant', async () => {
    const qb = createQueryBuilderMock();
    bindingRepo.createQueryBuilder.mockReturnValue(qb);
    tenantContextService.isPlatformUser.mockReturnValue(true);
    tenantContextService.getTenantId.mockReturnValue(null);
    deviceRepo.findOne.mockResolvedValue({ id: 1, deviceNo: 'BADGE-001', tenantId: 'platform-self' });
    bindingRepo.findOne.mockResolvedValue({ id: 9, deviceNo: 'BADGE-001', tenantId: 'tenant-b', unbindAt: null });

    const result = await service.unbindBadge({ deviceNo: 'BADGE-001' } as any);

    expect(result.code).toBe(200);
    expect(qb.where).toHaveBeenCalledWith('tenantId = :tenantId AND deviceNo = :deviceNo AND unbindAt IS NULL', {
      tenantId: 'tenant-b',
      deviceNo: 'BADGE-001',
    });
  });

  it('creates tenant device under the current tenant for tenant users', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    deviceRepo.findOne.mockResolvedValue(null);
    deviceRepo.save.mockImplementation(async (value) => value);

    const result = await service.createDevice({ deviceNo: 'badge-tenant-a', status: '0' } as any);

    expect(result.code).toBe(200);
    expect(deviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        deviceNo: 'BADGE-TENANT-A',
      }),
    );
  });

  it('prevents deleting a tenant device while it has an active binding', async () => {
    tenantContextService.isPlatformUser.mockReturnValue(false);
    tenantContextService.getTenantId.mockReturnValue('tenant-a');
    deviceRepo.findOne.mockResolvedValue({ id: 3, tenantId: 'tenant-a', deviceNo: 'BADGE-003', delFlag: '0' });
    bindingRepo.findOne.mockResolvedValue({ id: 8, tenantId: 'tenant-a', deviceNo: 'BADGE-003', unbindAt: null });

    const result = await service.deleteDevice(3);

    expect(result.code).toBe(400);
    expect(deviceRepo.update).not.toHaveBeenCalled();
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
