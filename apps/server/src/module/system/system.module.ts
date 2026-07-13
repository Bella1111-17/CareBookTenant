import { Module, Global } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DeptModule } from './dept/dept.module';
import { SysConfigModule } from './sysconfig/sysconfig.module';
import { DictModule } from './dict/dict.module';
import { MenuModule } from './menu/menu.module';
import { PostModule } from './post/post.module';
import { RoleModule } from './role/role.module';
import { UserModule } from './user/user.module';
import { TenantModule } from './tenant/tenant.module';

@Global()
@Module({
  imports: [AuthModule, SysConfigModule, DeptModule, DictModule, MenuModule, PostModule, RoleModule, UserModule, TenantModule],
})
export class SystemModule {}
