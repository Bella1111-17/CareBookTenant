import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PagingDto } from 'src/common/dto/index';

export class CreateTenantDto {
  @ApiProperty({ description: '租户编码' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantCode: string;

  @ApiProperty({ description: '租户名称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tenantName: string;

  @ApiProperty({ description: '联系人', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  contactName?: string;

  @ApiProperty({ description: '联系电话', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  contactPhone?: string;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiProperty({ description: '租户ID' })
  @IsString()
  @IsNotEmpty()
  tenantId: string;
}

export class ListTenantDto extends PagingDto {
  @ApiProperty({ description: '租户编码', required: false })
  @IsOptional()
  @IsString()
  tenantCode?: string;

  @ApiProperty({ description: '租户名称', required: false })
  @IsOptional()
  @IsString()
  tenantName?: string;

  @ApiProperty({ description: '状态', required: false })
  @IsOptional()
  @IsString()
  status?: string;
}

export class InitTenantAdminDto {
  @ApiProperty({ description: '管理员账号' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  userName: string;

  @ApiProperty({ description: '管理员密码' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;

  @ApiProperty({ description: '管理员昵称' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nickName: string;

  @ApiProperty({ description: '管理员手机号', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(11)
  phonenumber?: string;

  @ApiProperty({ description: '管理员邮箱', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  email?: string;
}
