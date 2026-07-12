import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, PrimaryColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base';

@Entity('sys_tenant', {
  comment: '租户信息表',
})
export class SysTenantEntity extends BaseEntity {
  @ApiProperty({ type: String, description: '租户ID' })
  @PrimaryColumn({ type: 'varchar', name: 'tenant_id', length: 64, comment: '租户ID' })
  tenantId: string;

  @ApiProperty({ type: String, description: '租户编码' })
  @Column({ type: 'varchar', name: 'tenant_code', length: 64, unique: true, comment: '租户编码' })
  tenantCode: string;

  @ApiProperty({ type: String, description: '租户名称' })
  @Column({ type: 'varchar', name: 'tenant_name', length: 100, comment: '租户名称' })
  tenantName: string;

  @ApiProperty({ type: String, description: '联系人' })
  @Column({ type: 'varchar', name: 'contact_name', length: 64, default: '', comment: '联系人' })
  contactName: string;

  @ApiProperty({ type: String, description: '联系电话' })
  @Column({ type: 'varchar', name: 'contact_phone', length: 32, default: '', comment: '联系电话' })
  contactPhone: string;
}
