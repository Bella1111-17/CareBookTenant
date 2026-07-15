import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BindTenantBadgeDto,
  CreateTenantCaregiverDto,
  CreateTenantDeviceDto,
  CreateTenantOrgUnitDto,
  DeviceFlowDto,
  GenerateTenantDailyReportDto,
  ListTenantBindingDto,
  ListTenantCaregiverDto,
  ListTenantDailyReportDto,
  ListTenantDeviceSummaryDetailDto,
  ListTenantDeviceSummaryDto,
  ListTenantDeviceEventDto,
  ListTenantGpsDto,
  ListTenantRecordDto,
  TenantScopedPagingDto,
  UnbindTenantBadgeDto,
  UpdateTenantCaregiverDto,
  UpdateTenantDeviceDto,
  UpdateTenantOrgUnitDto,
} from './dto';
import { TenantCareService } from './tenant-care.service';

@ApiTags('租户护理')
@Controller('tenant-care')
export class TenantCareController {
  constructor(private readonly tenantCareService: TenantCareService) {}

  @ApiOperation({ summary: '新增护理单元' })
  @Post('/org-unit')
  @HttpCode(200)
  createOrgUnit(@Body() dto: CreateTenantOrgUnitDto) {
    return this.tenantCareService.createOrgUnit(dto);
  }

  @ApiOperation({ summary: '更新护理单元' })
  @Post('/org-unit/update')
  @HttpCode(200)
  updateOrgUnit(@Body() dto: UpdateTenantOrgUnitDto) {
    return this.tenantCareService.updateOrgUnit(dto);
  }

  @ApiOperation({ summary: '护理单元列表' })
  @Get('/org-unit/list')
  listOrgUnits(@Query() query: TenantScopedPagingDto) {
    return this.tenantCareService.listOrgUnits(query);
  }

  @ApiOperation({ summary: '新增租户护工' })
  @Post('/caregiver')
  @HttpCode(200)
  createCaregiver(@Body() dto: CreateTenantCaregiverDto) {
    return this.tenantCareService.createCaregiver(dto);
  }

  @ApiOperation({ summary: '更新租户护工' })
  @Post('/caregiver/update')
  @HttpCode(200)
  updateCaregiver(@Body() dto: UpdateTenantCaregiverDto) {
    return this.tenantCareService.updateCaregiver(dto);
  }

  @ApiOperation({ summary: '租户护工列表' })
  @Get('/caregiver/list')
  listCaregivers(@Query() query: ListTenantCaregiverDto) {
    return this.tenantCareService.listCaregivers(query);
  }

  @ApiOperation({ summary: '删除租户护工' })
  @Delete('/caregiver/:id')
  deleteCaregiver(@Param('id') id: number) {
    return this.tenantCareService.deleteCaregiver(Number(id));
  }

  @ApiOperation({ summary: '新增租户设备主档' })
  @Post('/device')
  @HttpCode(200)
  createDevice(@Body() dto: CreateTenantDeviceDto) {
    return this.tenantCareService.createDevice(dto);
  }

  @ApiOperation({ summary: '更新租户设备主档' })
  @Post('/device/update')
  @HttpCode(200)
  updateDevice(@Body() dto: UpdateTenantDeviceDto) {
    return this.tenantCareService.updateDevice(dto);
  }

  @ApiOperation({ summary: '租户设备列表' })
  @Get('/device/list')
  listDevices(@Query() query: TenantScopedPagingDto & { deviceNo?: string; bindingStatus?: string }) {
    return this.tenantCareService.listDevices(query);
  }

  @ApiOperation({ summary: '租户设备统计' })
  @Get('/device/summary')
  deviceSummary(@Query() query: ListTenantDeviceSummaryDto) {
    return this.tenantCareService.deviceSummary(query);
  }

  @ApiOperation({ summary: '租户设备统计明细' })
  @Get('/device/summary/detail')
  deviceSummaryDetail(@Query() query: ListTenantDeviceSummaryDetailDto) {
    return this.tenantCareService.deviceSummaryDetail(query);
  }
  @ApiOperation({ summary: '???????' })
  @Get('/device/flow')
  deviceFlow(@Query() query: DeviceFlowDto) {
    return this.tenantCareService.deviceFlow(query);
  }

  @ApiOperation({ summary: '删除租户设备主档' })
  @Delete('/device/:id')
  deleteDevice(@Param('id') id: number) {
    return this.tenantCareService.deleteDevice(Number(id));
  }

  @ApiOperation({ summary: '租户护工绑定工牌' })
  @Post('/badge/bind')
  @HttpCode(200)
  bindBadge(@Body() dto: BindTenantBadgeDto) {
    return this.tenantCareService.bindBadge(dto);
  }

  @ApiOperation({ summary: '租户护工解绑工牌' })
  @Post('/badge/unbind')
  @HttpCode(200)
  unbindBadge(@Body() dto: UnbindTenantBadgeDto) {
    return this.tenantCareService.unbindBadge(dto);
  }

  @ApiOperation({ summary: '租户工牌绑定列表' })
  @Get('/badge/binding/list')
  listBindings(@Query() query: ListTenantBindingDto) {
    return this.tenantCareService.listBindings(query);
  }

  @ApiOperation({ summary: '租户录音列表' })
  @Get('/record/list')
  listRecords(@Query() query: ListTenantRecordDto) {
    return this.tenantCareService.listRecords(query);
  }

  @ApiOperation({ summary: '租户设备GPS定位列表' })
  @Get('/gps/list')
  listGpsLogs(@Query() query: ListTenantGpsDto) {
    return this.tenantCareService.listGpsLogs(query);
  }

  @ApiOperation({ summary: '租户设备事件列表' })
  @Get('/event/list')
  listDeviceEvents(@Query() query: ListTenantDeviceEventDto) {
    return this.tenantCareService.listDeviceEvents(query);
  }

  @ApiOperation({ summary: '生成租户AI日报' })
  @Post('/daily-report/generate')
  @HttpCode(200)
  generateDailyReport(@Body() dto: GenerateTenantDailyReportDto) {
    return this.tenantCareService.generateDailyReport(dto);
  }

  @ApiOperation({ summary: '租户AI日报列表' })
  @Get('/daily-report/list')
  listDailyReports(@Query() query: ListTenantDailyReportDto) {
    return this.tenantCareService.listDailyReports(query);
  }

  @ApiOperation({ summary: '租户AI日报详情' })
  @Get('/daily-report/detail/:id')
  dailyReportDetail(@Param('id') id: number) {
    return this.tenantCareService.dailyReportDetail(Number(id));
  }
}
