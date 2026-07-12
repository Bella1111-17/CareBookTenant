import { Module, Global } from '@nestjs/common';
import { RedisModule } from './redis/redis.module';
import { AxiosModule } from './axios/axios.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisClientOptions } from '@songkeys/nestjs-redis';
import { TenantContextService } from 'src/common/tenant/tenant-context.service';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync(
      {
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          return {
            closeClient: true,
            readyLog: true,
            errorLog: true,
            config: config.get<RedisClientOptions>('redis'),
          };
        },
      },
      true,
    ),

    AxiosModule,
  ],
  providers: [TenantContextService],
  exports: [TenantContextService],
})
export class CommonModule {}
