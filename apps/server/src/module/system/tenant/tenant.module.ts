import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysTenantEntity } from './entities/tenant.entity';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { UserEntity } from '../user/entities/sys-user.entity';
import { SysRoleEntity } from '../role/entities/role.entity';
import { SysUserWithRoleEntity } from '../user/entities/user-width-role.entity';
import { SysRoleWithMenuEntity } from '../role/entities/role-width-menu.entity';
import { SysMenuEntity } from '../menu/entities/menu.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SysTenantEntity, UserEntity, SysRoleEntity, SysUserWithRoleEntity, SysRoleWithMenuEntity, SysMenuEntity])],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
