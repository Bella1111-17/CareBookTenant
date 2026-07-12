import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from 'src/common/decorators/require-premission.decorator';
import { CreateTenantDto, InitTenantAdminDto, ListTenantDto, UpdateTenantDto } from './dto';
import { TenantService } from './tenant.service';

@ApiTags('租户管理')
@Controller('system/tenant')
@ApiBearerAuth('Authorization')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiOperation({ summary: '租户管理-创建' })
  @ApiBody({ type: CreateTenantDto, required: true })
  @RequirePermission('system:tenant:add')
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantService.create(dto);
  }

  @ApiOperation({ summary: '租户管理-列表' })
  @RequirePermission('system:tenant:list')
  @Get('list')
  findAll(@Query() query: ListTenantDto) {
    return this.tenantService.findAll(query);
  }

  @ApiOperation({ summary: '租户管理-详情' })
  @RequirePermission('system:tenant:query')
  @Get(':tenantId')
  findOne(@Param('tenantId') tenantId: string) {
    return this.tenantService.findOne(tenantId);
  }

  @ApiOperation({ summary: '租户管理-修改' })
  @ApiBody({ type: UpdateTenantDto, required: true })
  @RequirePermission('system:tenant:edit')
  @Put()
  update(@Body() dto: UpdateTenantDto) {
    return this.tenantService.update(dto);
  }

  @ApiOperation({ summary: '租户管理-初始化管理员' })
  @ApiBody({ type: InitTenantAdminDto, required: true })
  @RequirePermission('system:tenant:edit')
  @Post(':tenantId/init-admin')
  initAdmin(@Param('tenantId') tenantId: string, @Body() dto: InitTenantAdminDto) {
    return this.tenantService.initAdmin(tenantId, dto);
  }
}
