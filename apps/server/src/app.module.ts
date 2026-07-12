import { Module, Global, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import configuration from './config/index';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from 'src/common/guards/auth.guard';
import { PermissionGuard } from 'src/common/guards/permission.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { MainModule } from './module/main/main.module';
import { UploadModule } from './module/upload/upload.module';
import { SystemModule } from './module/system/system.module';
import { CommonModule } from './module/common/common.module';
import { MonitorModule } from './module/monitor/monitor.module';
import { SmartBadgeModule } from './module/system/smart-badge/smart-badge.module';
import { TenantContextMiddleware } from './common/tenant/tenant-context.middleware';
import { TenantCareModule } from './module/tenant-care/tenant-care.module';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      load: [configuration],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        ({
          type: 'postgres',
          entities: [`${__dirname}/**/*.entity{.ts,.js}`],
          autoLoadEntities: true,
          keepConnectionAlive: true,
          ...config.get('db.postgres'),
        }) as TypeOrmModuleOptions,
    }),
    MainModule,
    UploadModule,
    CommonModule,
    SystemModule,
    MonitorModule,
    SmartBadgeModule,
    TenantCareModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
