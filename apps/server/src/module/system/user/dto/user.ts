import { SysDeptEntity } from '../../dept/entities/dept.entity';
import { SysPostEntity } from '../../post/entities/post.entity';
import { SysRoleEntity } from '../../role/entities/role.entity';
import { UserEntity } from '../entities/sys-user.entity';
import { UserScope } from 'src/common/tenant/tenant.constants';

export type UserType = {
  browser: string;
  ipaddr: string;
  loginLocation: string;
  loginTime: Date;
  os: string;
  permissions: string[];
  roles: string[];
  token: string;
  refreshToken?: string;
  tenantId?: string | null;
  userScope?: UserScope;
  user: {
    dept: SysDeptEntity;
    roles: Array<SysRoleEntity>;
    posts: Array<SysPostEntity>;
  } & UserEntity;
  userId: number;
  userName: string;
  deptId: number;
  refreshTokenKey?: string;
};
