import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AudioRecordEntity } from 'src/module/system/smart-badge/entities/audio-record.entity';
import { BadgeDeviceEntity } from 'src/module/system/smart-badge/entities/badge-device.entity';
import { DeviceEventLogEntity } from 'src/module/system/smart-badge/entities/device-event-log.entity';
import { DeviceGpsLogEntity } from 'src/module/system/smart-badge/entities/device-gps-log.entity';
import { SysTenantEntity } from 'src/module/system/tenant/entities/tenant.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { DeviceTenantBindingEntity } from './entities/device-tenant-binding.entity';
import { TenantBadgeBindingEntity } from './entities/tenant-badge-binding.entity';
import { TenantCaregiverEntity } from './entities/tenant-caregiver.entity';
import { TenantDailyReportEntity } from './entities/tenant-daily-report.entity';
import { TenantOrgUnitEntity } from './entities/tenant-org-unit.entity';
import { TenantCareController } from './tenant-care.controller';
import { TenantCareService } from './tenant-care.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      TenantCaregiverEntity,
      TenantOrgUnitEntity,
      TenantBadgeBindingEntity,
      DeviceTenantBindingEntity,
      TenantDailyReportEntity,
      BadgeDeviceEntity,
      AudioRecordEntity,
      DeviceGpsLogEntity,
      DeviceEventLogEntity,
      SysTenantEntity,
      UserEntity,
    ]),
  ],
  controllers: [TenantCareController],
  providers: [TenantCareService],
  exports: [TenantCareService],
})
export class TenantCareModule {}
