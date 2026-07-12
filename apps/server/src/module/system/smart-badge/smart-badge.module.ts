import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SmartBadgeController } from './smart-badge.controller';
import { SmartBadgeService } from './smart-badge.service';
import { CloudAsrService } from './services/cloud-asr.service';
import { AudioAuditService } from './services/audio-audit.service';
import { DeviceUserBindingEntity } from './entities/device-user-binding.entity';
import { AudioRecordEntity } from './entities/audio-record.entity';
import { DeviceGpsLogEntity } from './entities/device-gps-log.entity';
import { DeviceEventLogEntity } from './entities/device-event-log.entity';
import { NurseDailyReportEntity } from './entities/nurse-daily-report.entity';
import { BadgeDeviceEntity } from './entities/badge-device.entity';
import { UserEntity } from '../user/entities/sys-user.entity';
import { TenantBadgeBindingEntity } from 'src/module/tenant-care/entities/tenant-badge-binding.entity';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      BadgeDeviceEntity,
      DeviceUserBindingEntity,
      AudioRecordEntity,
      DeviceGpsLogEntity,
      DeviceEventLogEntity,
      NurseDailyReportEntity,
      UserEntity,
      TenantBadgeBindingEntity,
    ]),
  ],
  controllers: [SmartBadgeController],
  providers: [SmartBadgeService, CloudAsrService, AudioAuditService],
  exports: [SmartBadgeService, AudioAuditService],
})
export class SmartBadgeModule {}
