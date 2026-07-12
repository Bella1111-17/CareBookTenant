import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysConfigService } from './sysconfig.service';
import { SysConfigController } from './sysconfig.controller';
import { SysConfigEntity } from './entities/sysconfig.entity';
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SysConfigEntity])],
  controllers: [SysConfigController],
  providers: [SysConfigService],
  exports: [SysConfigService],
})
export class SysConfigModule {}
