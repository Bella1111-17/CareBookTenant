import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PagingDto } from 'src/common/dto';

export class TenantScopedPagingDto extends PagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ListTenantCaregiverDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;
}

export class CreateTenantCaregiverDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @IsString()
  realName: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  healthCertificate?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsArray()
  skillTags?: string[];

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTenantCaregiverDto extends CreateTenantCaregiverDto {
  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class CreateTenantOrgUnitDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @IsString()
  unitName: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;
}

export class UpdateTenantOrgUnitDto extends CreateTenantOrgUnitDto {
  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class BindTenantBadgeDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId: number;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;

  @ApiPropertyOptional({ description: '换绑时关闭旧绑定的说明' })
  @IsOptional()
  @IsString()
  unbindReason?: string;
}

export class CreateTenantDeviceDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTenantDeviceDto extends CreateTenantDeviceDto {
  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class ListTenantDeviceSummaryDto extends TenantScopedPagingDto {}

export class ListTenantDeviceSummaryDetailDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsIn(['totalDevices', 'assignedDevices', 'idleDevices', 'boundTenants', 'boundDevices', 'boundCaregivers'])
  type?: string;
}


export class UnbindTenantBadgeDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;

  @ApiProperty({ description: '解绑说明' })
  @IsNotEmpty()
  @IsString()
  unbindReason: string;
}

export class ListTenantBindingDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isCurrent?: boolean;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  beginTime?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}


export class DeviceFlowDto extends TenantScopedPagingDto {
  @ApiProperty({ description: '设备编号' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;
}

export class ListTenantRecordDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  asrStatus?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  isolationStatus?: string;
}

export class ListTenantGpsDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  beginTime?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class ListTenantDeviceEventDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  eventStatus?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  beginTime?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
}

export class GenerateTenantDailyReportDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  allowUnboundAnalysis?: boolean;

  @ApiProperty({ description: '' })
  @IsDateString()
  dateStr: string;
}

export class ListTenantDailyReportDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId?: number;

  @ApiPropertyOptional({ description: '' })
  @IsOptional()
  @IsDateString()
  dateStr?: string;
}
