import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PagingDto } from 'src/common/dto';

export class TenantScopedPagingDto extends PagingDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class ListTenantCaregiverDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '姓名/手机号关键字' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '护理单元ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitId?: number;

  @ApiPropertyOptional({ description: '状态 0启用 1停用' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;
}

export class CreateTenantCaregiverDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '护工姓名' })
  @IsNotEmpty()
  @IsString()
  realName: string;

  @ApiPropertyOptional({ description: '手机号' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: '护理单元ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orgUnitId?: number;

  @ApiPropertyOptional({ description: '状态 0启用 1停用' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @ApiPropertyOptional({ description: '资质说明' })
  @IsOptional()
  @IsString()
  qualification?: string;

  @ApiPropertyOptional({ description: '健康证材料' })
  @IsOptional()
  @IsString()
  healthCertificate?: string;

  @ApiPropertyOptional({ description: '技能标签' })
  @IsOptional()
  @IsArray()
  skillTags?: string[];

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTenantCaregiverDto extends CreateTenantCaregiverDto {
  @ApiProperty({ description: '护工ID' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class CreateTenantOrgUnitDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '组织/护理单元名称' })
  @IsNotEmpty()
  @IsString()
  unitName: string;

  @ApiPropertyOptional({ description: '父级组织ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  parentId?: number;

  @ApiPropertyOptional({ description: '排序' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional({ description: '状态 0启用 1停用' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;
}

export class UpdateTenantOrgUnitDto extends CreateTenantOrgUnitDto {
  @ApiProperty({ description: '组织/护理单元ID' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class BindTenantBadgeDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '租户护工ID' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId: number;

  @ApiProperty({ description: '设备编号' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;
}

export class CreateTenantDeviceDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '设备编号' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;

  @ApiPropertyOptional({ description: '状态 0启用 1停用' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTenantDeviceDto extends CreateTenantDeviceDto {
  @ApiProperty({ description: '设备ID' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  id: number;
}

export class UnbindTenantBadgeDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ description: '设备编号' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;
}

export class ListTenantBindingDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '设备编号' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '护工姓名/手机号' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '是否当前有效绑定' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  isCurrent?: boolean;
}

export class ListTenantRecordDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '设备编号' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: 'ASR状态' })
  @IsOptional()
  @IsString()
  asrStatus?: string;

  @ApiPropertyOptional({ description: '隔离状态 NORMAL/TENANT_UNRESOLVED' })
  @IsOptional()
  @IsString()
  isolationStatus?: string;
}

export class GenerateTenantDailyReportDto {
  @ApiPropertyOptional({ description: '平台管理员指定租户ID' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: '设备编号，不传则批量生成' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiProperty({ description: '日报日期 YYYY-MM-DD' })
  @IsDateString()
  dateStr: string;
}

export class ListTenantDailyReportDto extends TenantScopedPagingDto {
  @ApiPropertyOptional({ description: '设备编号' })
  @IsOptional()
  @IsString()
  deviceNo?: string;

  @ApiPropertyOptional({ description: '租户护工ID' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tenantCaregiverId?: number;

  @ApiPropertyOptional({ description: '日报日期 YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  dateStr?: string;
}
