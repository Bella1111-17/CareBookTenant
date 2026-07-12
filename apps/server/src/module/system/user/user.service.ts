import { Repository, In, Not } from 'typeorm';
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from 'src/module/common/redis/redis.service';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { GetNowDate, GenerateUUID, Uniq } from 'src/common/utils/index';
import { ExportTable } from 'src/common/utils/export';

import { CacheEnum, DelFlagEnum, StatusEnum, DataScopeEnum } from 'src/common/enum/index';
import { LOGIN_TOKEN_EXPIRESIN, REFRESH_TOKEN_EXPIRESIN, SYS_USER_TYPE } from 'src/common/constant/index';
import { ResultData } from 'src/common/utils/result';
import { CreateUserDto, UpdateUserDto, ListUserDto, ChangeStatusDto, ResetPwdDto, AllocatedListDto, UpdateProfileDto, UpdatePwdDto } from './dto/index';
import { RegisterDto, LoginDto } from '../../main/dto/index';
import { AuthUserCancelDto, AuthUserCancelAllDto, AuthUserSelectAllDto } from '../role/dto/index';

import { UserEntity } from './entities/sys-user.entity';
import { SysUserWithPostEntity } from './entities/user-width-post.entity';
import { SysUserWithRoleEntity } from './entities/user-width-role.entity';
import { SysPostEntity } from '../post/entities/post.entity';
import { SysDeptEntity } from '../dept/entities/dept.entity';
import { RoleService } from '../role/role.service';
import { DeptService } from '../dept/dept.service';

import { SysConfigService } from '../sysconfig/sysconfig.service';
import { SysRoleEntity } from '../role/entities/role.entity';
import { SysTenantEntity } from '../tenant/entities/tenant.entity';

import { UserType } from './dto/user';
import { ClientInfoDto } from 'src/common/decorators/common.decorator';
import { Cacheable, CacheEvict } from 'src/common/decorators/redis.decorator';
import { Captcha } from 'src/common/decorators/captcha.decorator';
import { TenantContextService } from 'src/common/tenant/tenant-context.service';
import { applyTenantScope } from 'src/common/tenant/tenant-query';
import { PLATFORM_SELF_TENANT_ID, PLATFORM_USER_SCOPE, TENANT_USER_SCOPE } from 'src/common/tenant/tenant.constants';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysDeptEntity)
    private readonly sysDeptEntityRep: Repository<SysDeptEntity>,
    @InjectRepository(SysPostEntity)
    private readonly sysPostEntityRep: Repository<SysPostEntity>,
    @InjectRepository(SysUserWithPostEntity)
    private readonly sysUserWithPostEntityRep: Repository<SysUserWithPostEntity>,
    @InjectRepository(SysUserWithRoleEntity)
    private readonly sysUserWithRoleEntityRep: Repository<SysUserWithRoleEntity>,
    @InjectRepository(SysRoleEntity)
    private readonly roleRepo: Repository<SysRoleEntity>,
    @InjectRepository(SysTenantEntity)
    private readonly tenantRepo: Repository<SysTenantEntity>,
    private readonly roleService: RoleService,
    private readonly deptService: DeptService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: SysConfigService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private currentTenantId(): string | null {
    return this.tenantContextService.getTenantId();
  }

  private resolveWriteTenantId(preferredTenantId?: string | null): string | null {
    if (this.tenantContextService.isPlatformUser()) return preferredTenantId || PLATFORM_SELF_TENANT_ID;
    return this.currentTenantId();
  }

  private ensureTenantAccess(targetTenantId?: string | null) {
    if (this.tenantContextService.isPlatformUser()) return;
    const tenantId = this.currentTenantId();
    if (!tenantId) {
      throw new ForbiddenException('租户账号缺少租户标识');
    }
    if (targetTenantId !== tenantId) {
      throw new ForbiddenException('无权访问其他租户用户数据');
    }
  }

  private async ensureUsersTenantAccess(userIds: number[]) {
    const ids = Uniq(userIds.map((item) => Number(item)).filter((item) => Number.isFinite(item)));
    if (!ids.length || this.tenantContextService.isPlatformUser()) return;

    const users = await this.userRepo.find({
      where: {
        userId: In(ids),
        delFlag: '0',
      },
      select: ['userId', 'tenantId'],
    });
    if (users.length !== ids.length) {
      throw new ForbiddenException('用户不存在或无权访问');
    }
    users.forEach((item) => this.ensureTenantAccess(item.tenantId));
  }

  private async ensureRolesTenantAccess(roleIds: number[]) {
    const ids = Uniq(roleIds.map((item) => Number(item)).filter((item) => Number.isFinite(item)));
    if (!ids.length || this.tenantContextService.isPlatformUser()) return;

    const roles = await this.roleRepo.find({
      where: {
        roleId: In(ids),
        delFlag: '0',
      },
      select: ['roleId', 'tenantId'],
    });
    if (roles.length !== ids.length) {
      throw new ForbiddenException('角色不存在或无权访问');
    }
    roles.forEach((item) => this.ensureTenantAccess(item.tenantId));
  }

  private async attachTenantName<T extends { tenantId?: string | null }>(userData: T): Promise<T & { tenantName?: string }> {
    if (!userData?.tenantId) {
      return userData as T & { tenantName?: string };
    }
    const tenant = await this.tenantRepo.findOne({
      where: {
        tenantId: userData.tenantId,
        delFlag: '0',
      },
      select: ['tenantName'],
    });
    return {
      ...userData,
      tenantName: tenant?.tenantName || '',
    };
  }

  private async ensureUserNameAvailable(userName: string, excludeUserId?: number) {
    const normalizedUserName = String(userName || '').trim();
    if (!normalizedUserName) {
      throw new BadRequestException('用户账号不能为空');
    }

    const existing = await this.userRepo.findOne({
      where: {
        userName: normalizedUserName,
        delFlag: '0',
      },
      select: ['userId', 'userName'],
    });

    if (existing && existing.userId !== excludeUserId) {
      throw new BadRequestException(`保存用户'${normalizedUserName}'失败，账号已存在`);
    }

    return normalizedUserName;
  }

  private getAccessSessionKey(token: string) {
    return `${CacheEnum.LOGIN_TOKEN_KEY}${token}`;
  }

  private getRefreshSessionKey(refreshToken: string) {
    return `${CacheEnum.REFRESH_TOKEN_KEY}${refreshToken}`;
  }

  private getUserSessionIndexKey(userId: number) {
    return `${CacheEnum.USER_SESSION_KEY}${userId}`;
  }

  private async addUserSessionIndex(userId: number, token: string) {
    const indexKey = this.getUserSessionIndexKey(userId);
    const tokens = ((await this.redisService.get(indexKey)) || []) as string[];
    const nextTokens = Uniq([...(tokens || []), token]);
    await this.redisService.set(indexKey, nextTokens, REFRESH_TOKEN_EXPIRESIN);
  }

  private async removeUserSessionIndex(userId: number, token: string) {
    const indexKey = this.getUserSessionIndexKey(userId);
    const tokens = ((await this.redisService.get(indexKey)) || []) as string[];
    const nextTokens = tokens.filter((item) => item !== token);
    if (nextTokens.length === 0) {
      await this.redisService.del(indexKey);
      return;
    }
    await this.redisService.set(indexKey, nextTokens, REFRESH_TOKEN_EXPIRESIN);
  }

  private async getUserSessionTokens(userId: number) {
    const indexKey = this.getUserSessionIndexKey(userId);
    const tokens = ((await this.redisService.get(indexKey)) || []) as string[];
    const aliveTokens: string[] = [];

    for (const token of tokens) {
      const session = await this.redisService.get(this.getAccessSessionKey(token));
      if (session) {
        aliveTokens.push(token);
      }
    }

    if (aliveTokens.length !== tokens.length) {
      if (aliveTokens.length > 0) {
        await this.redisService.set(indexKey, aliveTokens, REFRESH_TOKEN_EXPIRESIN);
      } else {
        await this.redisService.del(indexKey);
      }
    }

    return aliveTokens;
  }

  async clearUserSession(token: string) {
    const session = await this.redisService.get(this.getAccessSessionKey(token));
    if (!session) {
      return;
    }

    await this.redisService.del(this.getAccessSessionKey(token));
    if (session.refreshToken) {
      await this.redisService.del(this.getRefreshSessionKey(session.refreshToken));
    }
    await this.removeUserSessionIndex(session.userId, token);
  }

  async clearUserSessions(userId: number) {
    const tokens = await this.getUserSessionTokens(userId);
    for (const token of tokens) {
      await this.clearUserSession(token);
    }
  }
  /**
   * 后台创建用户
   * @param createUserDto
   * @returns
   */
  async create(createUserDto: CreateUserDto) {
    createUserDto.userName = await this.ensureUserNameAvailable(createUserDto.userName);
    const salt = bcrypt.genSaltSync(10);
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hashSync(createUserDto.password, salt);
    }
    await this.ensureRolesTenantAccess(createUserDto.roleIds || []);

    const res = await this.userRepo.save({
      ...createUserDto,
      userType: SYS_USER_TYPE.CUSTOM,
      tenantId: this.resolveWriteTenantId((createUserDto as any).tenantId),
      userScope: this.tenantContextService.isPlatformUser() ? PLATFORM_USER_SCOPE : TENANT_USER_SCOPE,
    });
    const postEntity = this.sysUserWithPostEntityRep.createQueryBuilder('postEntity');
    const postValues = createUserDto.postIds.map((id) => {
      return {
        userId: res.userId,
        postId: id,
      };
    });
    postEntity.insert().values(postValues).execute();

    const roleEntity = this.sysUserWithRoleEntityRep.createQueryBuilder('roleEntity');
    const roleValues = createUserDto.roleIds.map((id) => {
      return {
        userId: res.userId,
        roleId: id,
      };
    });
    roleEntity.insert().values(roleValues).execute();

    return ResultData.ok();
  }

  /**
   * 用户列表
   * @param query
   * @returns
   */
  async findAll(query: ListUserDto, user: UserType['user']) {
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });
    applyTenantScope(entity, 'user', this.tenantContextService, { requestedTenantId: (query as any).tenantId });

    //数据权限过滤
    if (user) {
      const roles = user.roles;
      const deptIds = [];
      let dataScopeAll = false;
      let dataScopeSelf = false;
      for (let index = 0; index < roles.length; index++) {
        const role = roles[index];
        if (role.dataScope === DataScopeEnum.DATA_SCOPE_ALL) {
          dataScopeAll = true;
          break;
        } else if (role.dataScope === DataScopeEnum.DATA_SCOPE_CUSTOM) {
          const roleWithDeptIds = await this.roleService.findRoleWithDeptIds(role.roleId);
          deptIds.push(...roleWithDeptIds);
        } else if (role.dataScope === DataScopeEnum.DATA_SCOPE_DEPT || role.dataScope === DataScopeEnum.DATA_SCOPE_DEPT_AND_CHILD) {
          const dataScopeWidthDeptIds = await this.deptService.findDeptIdsByDataScope(user.deptId, role.dataScope);
          deptIds.push(...dataScopeWidthDeptIds);
        } else if (role.dataScope === DataScopeEnum.DATA_SCOPE_SELF) {
          dataScopeSelf = true;
        }
      }

      if (!dataScopeAll) {
        if (deptIds.length > 0) {
          entity.andWhere('user.deptId IN (:...deptIds)', { deptIds: deptIds });
        } else if (dataScopeSelf) {
          entity.andWhere('user.userId = :userId', { userId: user.userId });
        }
      }
    }

    if (query.deptId) {
      const deptIds = await this.deptService.findDeptIdsByDataScope(+query.deptId, DataScopeEnum.DATA_SCOPE_DEPT_AND_CHILD);
      entity.andWhere('user.deptId IN (:...deptIds)', { deptIds: deptIds });
    }

    if (query.userName) {
      entity.andWhere('user.userName LIKE :userName', { userName: `%${query.userName}%` });
    }

    if (query.nickName) {
      entity.andWhere('user.nickName LIKE :nickName', { nickName: `%${query.nickName}%` });
    }

    if (query.phonenumber) {
      entity.andWhere('user.phonenumber LIKE :phonenumber', { phonenumber: `%${query.phonenumber}%` });
    }

    if (query.status) {
      entity.andWhere('user.status = :status', { status: query.status });
    }

    if (query.roleId) {
      await this.ensureRolesTenantAccess([+query.roleId]);
      const userWithRoleList = await this.sysUserWithRoleEntityRep.find({
        where: {
          roleId: +query.roleId,
        },
        select: ['userId'],
      });
      const userIds = userWithRoleList.map((item) => item.userId);
      if (userIds.length > 0) {
        entity.andWhere('user.userId IN (:...userIds)', { userIds });
      } else {
        // No user has this role, return empty
        return ResultData.ok({ list: [], total: 0 });
      }
    }

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('user.createTime BETWEEN :start AND :end', { start: query.params.beginTime, end: query.params.endTime });
    }

    if (query.pageSize && query.pageNum) {
      entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }
    //联查部门详情
    entity.leftJoinAndMapOne('user.dept', SysDeptEntity, 'dept', 'dept.deptId = user.deptId');

    const [list, total] = await entity.getManyAndCount();

    return ResultData.ok({
      list,
      total,
    });
  }

  /**
   * 用户角色+岗位信息
   * @returns
   */
  async findPostAndRoleAll() {
    const posts = await this.sysPostEntityRep.find({
      where: {
        delFlag: '0',
      },
    });
    const roles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
        tenantId: this.tenantContextService.isPlatformUser() ? undefined : this.currentTenantId(),
      },
    });

    return ResultData.ok({
      posts,
      roles,
    });
  }

  @Cacheable(CacheEnum.SYS_USER_KEY, '{userId}')
  async findOne(userId: number) {
    const data = await this.userRepo.findOne({
      where: {
        delFlag: '0',
        userId: userId,
      },
    });
    if (!data) {
      return ResultData.fail(404, '用户不存在');
    }
    this.ensureTenantAccess(data.tenantId);

    const dept = await this.sysDeptEntityRep.findOne({
      where: {
        delFlag: '0',
        deptId: data.deptId,
      },
    });
    data['dept'] = dept;

    const postList = await this.sysUserWithPostEntityRep.find({
      where: {
        userId: userId,
      },
    });
    const postIds = postList.map((item) => item.postId);
    const allPosts = await this.sysPostEntityRep.find({
      where: {
        delFlag: '0',
      },
    });

    const roleIds = await this.getRoleIds([userId]);
    const allRoles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
        tenantId: this.tenantContextService.isPlatformUser() ? undefined : this.currentTenantId(),
      },
    });

    data['roles'] = allRoles.filter((item) => roleIds.includes(item.roleId));

    return ResultData.ok({
      data,
      postIds,
      posts: allPosts,
      roles: allRoles,
      roleIds,
    });
  }

  /**
   * 更新用户
   * @param updateUserDto
   * @returns
   */
  @CacheEvict(CacheEnum.SYS_USER_KEY, '{updateUserDto.userId}')
  async update(updateUserDto: UpdateUserDto, userId: number) {
    // 不能修改超级管理员
    if (updateUserDto.userId === 1) throw new BadRequestException('非法操作');

    // TODO：过滤掉设置超级管理员角色
    updateUserDto.roleIds = updateUserDto.roleIds.filter((v) => v != 1);
    await this.ensureRolesTenantAccess(updateUserDto.roleIds || []);

    // 当前用户不能修改自己的状态
    if (updateUserDto.userId === userId) {
      delete updateUserDto.status;
    }

    const currentUser = await this.userRepo.findOne({
      where: {
        userId: updateUserDto.userId,
        delFlag: '0',
      },
    });
    if (!currentUser) {
      return ResultData.fail(404, '用户不存在');
    }
    this.ensureTenantAccess(currentUser.tenantId);
    if (updateUserDto.userName && updateUserDto.userName !== currentUser.userName) {
      updateUserDto.userName = await this.ensureUserNameAvailable(updateUserDto.userName, updateUserDto.userId);
    }

    if (updateUserDto?.postIds?.length > 0) {
      // 用户已有岗位，先删除所有关联岗位
      const hasPostId = await this.sysUserWithPostEntityRep.findOne({
        where: {
          userId: updateUserDto.userId,
        },
        select: ['postId'],
      });

      if (hasPostId) {
        await this.sysUserWithPostEntityRep.delete({
          userId: updateUserDto.userId,
        });
      }
      const postEntity = this.sysUserWithPostEntityRep.createQueryBuilder('postEntity');
      const postValues = updateUserDto.postIds.map((id) => {
        return {
          userId: updateUserDto.userId,
          postId: id,
        };
      });
      postEntity.insert().values(postValues).execute();
    }

    if (updateUserDto?.roleIds?.length > 0) {
      // 用户已有角色，先删除所有关联角色
      const hasRoletId = await this.sysUserWithRoleEntityRep.findOne({
        where: {
          userId: updateUserDto.userId,
        },
        select: ['roleId'],
      });
      if (hasRoletId) {
        await this.sysUserWithRoleEntityRep.delete({
          userId: updateUserDto.userId,
        });
      }
      const roleEntity = this.sysUserWithRoleEntityRep.createQueryBuilder('roleEntity');
      const roleValues = updateUserDto.roleIds.map((id) => {
        return {
          userId: updateUserDto.userId,
          roleId: id,
        };
      });
      roleEntity.insert().values(roleValues).execute();
    }

    delete updateUserDto.password;
    delete (updateUserDto as any).dept;
    delete (updateUserDto as any).roles;
    delete (updateUserDto as any).roleIds;
    delete (updateUserDto as any).postIds;

    //更新用户信息
    const data = await this.userRepo.update({ userId: updateUserDto.userId }, updateUserDto);

    // 同步该用户的所有活跃 Redis 会话（权限、角色、用户信息）
    await this.syncUserSessions(updateUserDto.userId);

    return ResultData.ok(data);
  }

  @CacheEvict(CacheEnum.SYS_USER_KEY, '{userId}')
  clearCacheByUserId(userId: number) {
    return userId;
  }

  /**
   * 【公共方法】构建用户会话并写入 Redis
   *
   * 将用户信息、权限、角色打包存入 Redis，同时生成 access_token + refresh_token
   */
  private async buildSession(userData: any, clientInfo: ClientInfoDto, options?: { updateLoginMeta?: boolean }) {
    const loginDate = new Date();
    const updateLoginMeta = options?.updateLoginMeta !== false;

    // 更新登录信息到 DB
    if (updateLoginMeta) {
      await this.userRepo.update({ userId: userData.userId }, { loginDate, loginIp: clientInfo.ipaddr });
    }

    // 查询部门名称
    const deptData = await this.sysDeptEntityRep.findOne({
      where: { deptId: userData.deptId },
      select: ['deptName'],
    });
    userData['deptName'] = deptData?.deptName || '';

    // 权限 + 角色
    const permissions = await this.getUserPermissions(userData.userId);
    const roleKeys = (Array.isArray(userData.roles) ? userData.roles : []).map((item) => item?.roleKey).filter((item) => !!item);
    const roles: string[] = (roleKeys.length > 0 ? Uniq(roleKeys) : ['common']).map((item) => String(item));

    // 生成 token
    const uuid = GenerateUUID();
    const accessToken = this.createToken({ uuid, userId: userData.userId });
    const refreshToken = GenerateUUID();

    // 写入会话信息到 Redis（access token 关联）
    const userInfo = {
      browser: clientInfo.browser,
      ipaddr: clientInfo.ipaddr,
      loginLocation: clientInfo.loginLocation,
      loginTime: loginDate,
      os: clientInfo.os,
      permissions,
      roles,
      token: uuid,
      refreshToken,
      tenantId: userData.tenantId ?? null,
      userScope: userData.userScope,
      user: userData,
      userId: userData.userId,
      userName: userData.userName,
      deptId: userData.deptId,
      refreshTokenKey: this.getRefreshSessionKey(refreshToken),
    };
    await this.updateRedisToken(uuid, userInfo);
    await this.addUserSessionIndex(userData.userId, uuid);

    // 写入 refresh token 与 session 映射
    await this.redisService.set(this.getRefreshSessionKey(refreshToken), { userId: userData.userId, accessUuid: uuid, refreshToken }, REFRESH_TOKEN_EXPIRESIN);

    return { accessToken, refreshToken, userData };
  }

  /**
   * 登陆
   */
  @Captcha('user')
  async login(user: LoginDto, clientInfo: ClientInfoDto) {
    const data = await this.userRepo.findOne({
      where: { userName: String(user.userName || '').trim(), delFlag: '0' },
      select: ['userId', 'password'],
    });
    if (!data || !bcrypt.compareSync(user.password, data.password)) {
      return ResultData.fail(500, '账号或密码错误');
    }
    this.clearCacheByUserId(data.userId);

    const userData = await this.getUserinfo(data.userId);
    if (userData.delFlag === DelFlagEnum.DELETE) {
      return ResultData.fail(500, '您已被禁用，如需正常使用请联系管理员');
    }
    if (userData.status === StatusEnum.STOP) {
      return ResultData.fail(500, '您已被停用，如需正常使用请联系管理员');
    }

    const { accessToken, refreshToken } = await this.buildSession(userData, clientInfo);

    return ResultData.ok({ accessToken, refreshToken, expiresIn: 3600 }, '登录成功');
  }

  async refreshAccessToken(refreshToken: string) {
    // 1. 查找 refresh token 映射
    const mapping = await this.redisService.get(this.getRefreshSessionKey(refreshToken));
    if (!mapping) {
      return ResultData.fail(401, 'refresh_token 无效或已过期');
    }

    // 2. 删除旧的 access token session
    await this.clearUserSession(mapping.accessUuid);

    // 3. 获取用户信息
    const userData = await this.getUserinfo(mapping.userId);
    if (userData.delFlag === DelFlagEnum.DELETE || userData.status === StatusEnum.STOP) {
      return ResultData.fail(401, '账号已被删除或停用');
    }

    // 4. 生成新的 session + token（buildSession 内部会更新 loginDate 等）
    const clientInfo: ClientInfoDto = {
      browser: '',
      ipaddr: '',
      loginLocation: '',
      os: '',
      userAgent: '',
      dateTime: '',
    };
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await this.buildSession(userData, clientInfo, { updateLoginMeta: false });

    // 5. 删除旧的 refresh token
    await this.redisService.del(`${CacheEnum.REFRESH_TOKEN_KEY}${refreshToken}`);

    return ResultData.ok({ accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 3600 }, 'token 刷新成功');
  }

  /**
   * 【公共方法】同步某用户的所有活跃 Redis 会话（用户信息 + 权限 + 角色）
   *
   * 使用场景：管理员修改用户角色/权限、用户自己修改个人资料后
   */
  async syncUserSessions(userId: number) {
    const tokens = await this.getUserSessionTokens(userId);
    if (!tokens || tokens.length === 0) return;

    const freshUser = await this.getUserinfo(userId);
    const permissions = await this.getUserPermissions(userId);
    const roleKeys = (Array.isArray(freshUser.roles) ? freshUser.roles : []).map((item) => item?.roleKey).filter((item) => !!item);
    const roles: string[] = (roleKeys.length > 0 ? Uniq(roleKeys) : ['common']).map((item) => String(item));

    for (const token of tokens) {
      const session = await this.redisService.get(this.getAccessSessionKey(token));
      if (!session) continue;
      session.user = freshUser;
      session.permissions = permissions;
      session.roles = roles;
      session.tenantId = freshUser.tenantId ?? null;
      session.userScope = freshUser.userScope;
      await this.updateRedisToken(session.token, session);
    }
  }

  /**
   * 更新redis中用户权限和角色信息
   */
  async updateRedisUserRolesAndPermissions(uuid: string, userId: number) {
    const userData = await this.getUserinfo(userId);

    const permissions = await this.getUserPermissions(userId);
    const roleKeys = (Array.isArray(userData.roles) ? userData.roles : []).map((item) => item?.roleKey).filter((item) => !!item);
    const roles: string[] = (roleKeys.length > 0 ? Uniq(roleKeys) : ['common']).map((item) => String(item));

    await this.updateRedisToken(uuid, {
      permissions: permissions,
      roles: roles,
    });
  }

  /**
   * 更新redis中的元数据
   * @param token
   * @param metaData
   */
  async updateRedisToken(token: string, metaData: Partial<UserType>) {
    const oldMetaData = await this.redisService.get(this.getAccessSessionKey(token));

    let newMetaData = metaData;
    if (oldMetaData) {
      newMetaData = Object.assign(oldMetaData, metaData);
    }

    await this.redisService.set(this.getAccessSessionKey(token), newMetaData, LOGIN_TOKEN_EXPIRESIN);
  }

  /**
   * 获取角色Id列表
   * @param userId
   * @returns
   */
  async getRoleIds(userIds: Array<number>) {
    const roleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        userId: In(userIds),
      },
      select: ['roleId'],
    });
    const roleIds = roleList.map((item) => item.roleId);
    return Uniq(roleIds);
  }

  /**
   * 获取权限列表
   * @param userId
   * @returns
   */
  async getUserPermissions(userId: number) {
    // 超级管理员 - 根据角色赋予权限
    // if (userId === 1) {
    //   return ['*:*:*'];
    // }
    const roleIds = await this.getRoleIds([userId]);
    if (!roleIds || roleIds.length === 0) {
      return [];
    }
    const list = await this.roleService.getPermissionsByRoleIds(roleIds);
    const permissions = Uniq(list.map((item: { perms: string }) => item.perms)).filter((item) => {
      return item;
    });
    return permissions;
  }

  /**
   * 获取用户信息
   */
  async getUserinfo(userId: number): Promise<{ dept: SysDeptEntity; roles: Array<SysRoleEntity>; posts: Array<SysPostEntity> } & UserEntity> {
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where({
      userId: userId,
      delFlag: DelFlagEnum.NORMAL,
    });
    //联查部门详情
    entity.leftJoinAndMapOne('user.dept', SysDeptEntity, 'dept', 'dept.deptId = user.deptId');
    const roleIds = await this.getRoleIds([userId]);

    const roles = roleIds.length
      ? await this.roleService.findRoles({
          where: {
            delFlag: '0',
            roleId: In(roleIds),
          },
        })
      : [];

    const postIds = (
      await this.sysUserWithPostEntityRep.find({
        where: {
          userId: userId,
        },
        select: ['postId'],
      })
    ).map((item) => item.postId);

    const posts = postIds.length
      ? await this.sysPostEntityRep.find({
          where: {
            delFlag: '0',
            postId: In(postIds),
          },
        })
      : [];

    const data = await entity.getOne();

    const result = {
      ...data,
      roles,
      posts,
      dept: (data as any).dept,
    };

    return this.attachTenantName(result);
  }

  /**
   * 注册
   */
  async register(user: RegisterDto) {
    const loginDate = GetNowDate();
    const salt = bcrypt.genSaltSync(10);
    if (user.password) {
      user.password = await bcrypt.hashSync(user.password, salt);
    }
    user.userName = await this.ensureUserNameAvailable(user.userName);
    user['userName'] = user.userName;
    user['nickName'] = user.userName;
    await this.userRepo.save({ ...user, loginDate, userType: SYS_USER_TYPE.CUSTOM });
    return ResultData.ok();
  }

  /**
   * 从数据声明生成令牌?
   *
   * @param payload 数据声明
   * @return 令牌
   */
  createToken(payload: { uuid: string; userId: number }): string {
    const accessToken = this.jwtService.sign(payload);
    return accessToken;
  }

  /**
   * 从令牌中获取数据声明
   *
   * @param token 令牌
   * @return 数据声明
   */
  parseToken(token: string) {
    try {
      if (!token) return null;
      const payload = this.jwtService.verify(token.replace('Bearer ', ''));
      return payload;
    } catch (error) {
      return null;
    }
  }

  /**
   * 重置密码
   * @param body
   * @returns
   */
  async resetPwd(body: ResetPwdDto) {
    if (body.userId === 1) {
      return ResultData.fail(500, '系统用户不能重置密码');
    }
    await this.ensureUsersTenantAccess([body.userId]);
    if (body.password) {
      body.password = await bcrypt.hashSync(body.password, bcrypt.genSaltSync(10));
    }
    await this.userRepo.update(
      {
        userId: body.userId,
      },
      {
        password: body.password,
      },
    );
    await this.clearUserSessions(body.userId);
    return ResultData.ok();
  }

  /**
   * 批量删除用户
   * @param ids
   * @returns
   */
  async remove(ids: number[]) {
    await this.ensureUsersTenantAccess(ids);
    // 忽略系统角色的删除?
    const data = await this.userRepo.update(
      { userId: In(ids), userType: Not(SYS_USER_TYPE.SYS) },
      {
        delFlag: '1',
      },
    );
    // 清理已删除用户的角色关联
    if (data.affected > 0) {
      await this.sysUserWithRoleEntityRep.delete({
        userId: In(ids),
      });
    }
    for (const userId of ids) {
      await this.clearUserSessions(userId);
    }
    return ResultData.ok(data);
  }

  /**
   * 角色详情
   * @param id
   * @returns
   */
  async authRole(userId: number) {
    await this.ensureUsersTenantAccess([userId]);
    const allRoles = await this.roleService.findRoles({
      where: {
        delFlag: '0',
        tenantId: this.tenantContextService.isPlatformUser() ? undefined : this.currentTenantId(),
      },
    });

    const user = await this.userRepo.findOne({
      where: {
        delFlag: '0',
        userId: userId,
      },
    });
    if (!user) {
      return ResultData.fail(404, '用户不存在');
    }

    const dept = await this.sysDeptEntityRep.findOne({
      where: {
        delFlag: '0',
        deptId: user.deptId,
      },
    });
    user['dept'] = dept;

    const roleIds = await this.getRoleIds([userId]);
    //TODO flag用来给前端表格标记选中状态，后续优化
    user['roles'] = allRoles.filter((item) => {
      if (roleIds.includes(item.roleId)) {
        item['flag'] = true;
        return true;
      } else {
        return true;
      }
    });

    return ResultData.ok({
      roles: allRoles,
      user,
    });
  }

  /**
   * 更新用户角色信息
   * @param query
   * @returns
   */
  async updateAuthRole(query) {
    let roleIds = query.roleIds.split(',');

    //TODO：过滤掉设置超级管理员角色?
    roleIds = roleIds.filter((v) => v != 1);
    await this.ensureUsersTenantAccess([+query.userId]);
    await this.ensureRolesTenantAccess(roleIds.map((id) => +id));

    if (roleIds?.length > 0) {
      //用户已有角色,先删除所有关联角色?
      const hasRoletId = await this.sysUserWithRoleEntityRep.findOne({
        where: {
          userId: query.userId,
        },
        select: ['roleId'],
      });
      if (hasRoletId) {
        await this.sysUserWithRoleEntityRep.delete({
          userId: query.userId,
        });
      }
      const roleEntity = this.sysUserWithRoleEntityRep.createQueryBuilder('roleEntity');
      const roleValues = roleIds.map((id) => {
        return {
          userId: query.userId,
          roleId: id,
        };
      });
      roleEntity.insert().values(roleValues).execute();
    }
    // 角色变更后同步?Redis 会话
    await this.syncUserSessions(+query.userId);
    return ResultData.ok();
  }

  /**
   * 修改用户状态?
   * @param changeStatusDto
   * @returns
   */
  async changeStatus(changeStatusDto: ChangeStatusDto) {
    await this.ensureUsersTenantAccess([changeStatusDto.userId]);
    const userData = await this.userRepo.findOne({
      where: {
        userId: changeStatusDto.userId,
      },
      select: ['userType'],
    });
    if (userData.userType === SYS_USER_TYPE.SYS) {
      return ResultData.fail(500, '系统角色不可停用');
    }

    const res = await this.userRepo.update(
      { userId: changeStatusDto.userId },
      {
        status: changeStatusDto.status,
      },
    );
    if (changeStatusDto.status === StatusEnum.STOP) {
      await this.clearUserSessions(changeStatusDto.userId);
    } else {
      await this.syncUserSessions(changeStatusDto.userId);
    }
    return ResultData.ok(res);
  }

  /**
   * 部门树?
   * @returns
   */
  async deptTree() {
    const tree = await this.deptService.deptTree();
    return ResultData.ok(tree);
  }

  /**
   * 部门树
   * @param query
   * @returns
   */
  async allocatedList(query: AllocatedListDto) {
    await this.ensureRolesTenantAccess([+query.roleId]);
    const roleWidthRoleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        roleId: +query.roleId,
      },
      select: ['userId'],
    });
    if (roleWidthRoleList.length === 0) {
      return ResultData.ok({
        list: [],
        total: 0,
      });
    }
    const userIds = roleWidthRoleList.map((item) => item.userId);
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });
    applyTenantScope(entity, 'user', this.tenantContextService);
    entity.andWhere('user.status = :status', { status: '0' });
    entity.andWhere('user.userId IN (:...userIds)', { userIds: userIds });
    if (query.userName) {
      entity.andWhere('user.userName LIKE :userName', { userName: `%${query.userName}%` });
    }

    if (query.phonenumber) {
      entity.andWhere('user.phonenumber LIKE :phonenumber', { phonenumber: `%${query.phonenumber}%` });
    }
    entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    //联查部门详情
    entity.leftJoinAndMapOne('user.dept', SysDeptEntity, 'dept', 'dept.deptId = user.deptId');
    const [list, total] = await entity.getManyAndCount();
    return ResultData.ok({
      list,
      total,
    });
  }

  /**
   * 获取角色未分配用户?
   * @param query
   * @returns
   */
  async unallocatedList(query: AllocatedListDto) {
    await this.ensureRolesTenantAccess([+query.roleId]);
    const roleWidthRoleList = await this.sysUserWithRoleEntityRep.find({
      where: {
        roleId: +query.roleId,
      },
      select: ['userId'],
    });

    const userIds = roleWidthRoleList.map((item) => item.userId);
    const entity = this.userRepo.createQueryBuilder('user');
    entity.where('user.delFlag = :delFlag', { delFlag: '0' });
    applyTenantScope(entity, 'user', this.tenantContextService);
    entity.andWhere('user.status = :status', { status: '0' });
    entity.andWhere({
      userId: Not(In(userIds)),
    });
    if (query.userName) {
      entity.andWhere('user.userName LIKE :userName', { userName: `%${query.userName}%` });
    }

    if (query.phonenumber) {
      entity.andWhere('user.phonenumber LIKE :phonenumber', { phonenumber: `%${query.phonenumber}%` });
    }
    entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    //联查部门详情
    entity.leftJoinAndMapOne('user.dept', SysDeptEntity, 'dept', 'dept.deptId = user.deptId');
    const [list, total] = await entity.getManyAndCount();
    return ResultData.ok({
      list,
      total,
    });
  }

  /**
   * 用户解绑角色
   * @param data
   * @returns
   */
  async authUserCancel(data: AuthUserCancelDto) {
    await this.ensureUsersTenantAccess([data.userId]);
    await this.ensureRolesTenantAccess([data.roleId]);
    await this.sysUserWithRoleEntityRep.delete({
      userId: data.userId,
      roleId: data.roleId,
    });
    return ResultData.ok();
  }

  /**
   * 用户批量解绑角色
   * @param data
   * @returns
   */
  async authUserCancelAll(data: AuthUserCancelAllDto) {
    const userIds = data.userIds.split(',').map((id) => +id);
    await this.ensureUsersTenantAccess(userIds);
    await this.ensureRolesTenantAccess([+data.roleId]);
    await this.sysUserWithRoleEntityRep.delete({
      userId: In(userIds),
      roleId: +data.roleId,
    });
    return ResultData.ok();
  }

  /**
   * 用户批量绑定角色
   * @param data
   * @returns
   */
  async authUserSelectAll(data: AuthUserSelectAllDto) {
    const userIds = data.userIds.split(',').map((id) => +id);
    await this.ensureUsersTenantAccess(userIds);
    await this.ensureRolesTenantAccess([+data.roleId]);
    const entitys = userIds.map((userId) => {
      const sysDeptEntityEntity = new SysUserWithRoleEntity();
      return Object.assign(sysDeptEntityEntity, {
        userId: userId,
        roleId: +data.roleId,
      });
    });
    await this.sysUserWithRoleEntityRep.save(entitys);
    return ResultData.ok();
  }

  /**
   * 个人中心-用户信息
   * @param user
   * @returns
   */
  async profile(user) {
    return ResultData.ok(user);
  }

  /**
   * 个人中心-用户信息
   * @param user
   * @returns
   */
  async updateProfile(user: UserType, updateProfileDto: UpdateProfileDto) {
    // 1. 更新 DB
    await this.userRepo.update({ userId: user.user.userId }, updateProfileDto);

    // 2. 同步当前用户所有 Redis 会话（防止 null + 保持 TTL）
    await this.syncUserSessions(user.user.userId);
    return ResultData.ok();
  }

  /**
   * 个人中心-修改密码
   * @param user
   * @param updatePwdDto
   * @returns
   */
  async updatePwd(user: UserType, updatePwdDto: UpdatePwdDto) {
    if (updatePwdDto.oldPassword === updatePwdDto.newPassword) {
      return ResultData.fail(500, '新密码不能与旧密码相同');
    }
    if (!bcrypt.compareSync(updatePwdDto.oldPassword, user.user.password)) {
      return ResultData.fail(500, '修改密码失败，旧密码错误');
    }

    const password = await bcrypt.hashSync(updatePwdDto.newPassword, bcrypt.genSaltSync(10));
    await this.userRepo.update({ userId: user.user.userId }, { password: password });
    await this.clearUserSessions(user.user.userId);
    return ResultData.ok();
  }

  /**
   * 导出用户信息数据为xlsx
   * @param res
   */
  async export(res: Response, body: ListUserDto, user: UserType['user']) {
    delete body.pageNum;
    delete body.pageSize;
    const list = await this.findAll(body, user);
    const options = {
      sheetName: '用户数据',
      data: list.data.list,
      header: [
        { title: '用户序号', dataIndex: 'userId' },
        { title: '登录名称', dataIndex: 'userName' },
        { title: '用户昵称', dataIndex: 'nickName' },
        { title: '用户邮箱', dataIndex: 'email' },
        { title: '手机号码', dataIndex: 'phonenumber' },
        { title: '用户性别', dataIndex: 'sex' },
        { title: '账号状态', dataIndex: 'status' },
        { title: '最后登录IP', dataIndex: 'loginIp' },
        { title: '最后登录时间', dataIndex: 'loginDate', width: 20 },
        { title: '部门', dataIndex: 'dept.deptName' },
        { title: '部门负责人', dataIndex: 'dept.leader' },
      ],
    };
    ExportTable(options, res);
  }
}
