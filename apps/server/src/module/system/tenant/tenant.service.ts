import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { GenerateUUID } from 'src/common/utils';
import { ResultData } from 'src/common/utils/result';
import { SysTenantEntity } from './entities/tenant.entity';
import { CreateTenantDto, InitTenantAdminDto, ListTenantDto, UpdateTenantDto } from './dto';
import { UserEntity } from '../user/entities/sys-user.entity';
import { SysRoleEntity } from '../role/entities/role.entity';
import { SysUserWithRoleEntity } from '../user/entities/user-width-role.entity';
import { SysRoleWithMenuEntity } from '../role/entities/role-width-menu.entity';
import { SYS_USER_TYPE } from 'src/common/constant';
import { TENANT_USER_SCOPE } from 'src/common/tenant/tenant.constants';

@Injectable()
export class TenantService {
  private readonly tenantMenuTemplateIds = [230, 231, 232, 233, 234, 235, 236, 3300, 3301, 3302, 3303, 3310, 3311, 3320, 3321, 3322, 3323, 3324, 3330, 3340, 3341, 3350, 3360];

  constructor(
    @InjectRepository(SysTenantEntity)
    private readonly tenantRepo: Repository<SysTenantEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysRoleEntity)
    private readonly roleRepo: Repository<SysRoleEntity>,
    @InjectRepository(SysUserWithRoleEntity)
    private readonly userRoleRepo: Repository<SysUserWithRoleEntity>,
    @InjectRepository(SysRoleWithMenuEntity)
    private readonly roleMenuRepo: Repository<SysRoleWithMenuEntity>,
  ) {}

  private normalizeAdminUserName(userName: string) {
    return String(userName || '')
      .trim()
      .toLowerCase();
  }

  private buildSuggestedAdminUserName(tenantCode: string) {
    return `${String(tenantCode || '')
      .trim()
      .toLowerCase()}_admin`;
  }

  private async ensureGlobalUserNameAvailable(userName: string) {
    const normalizedUserName = this.normalizeAdminUserName(userName);
    if (!normalizedUserName) {
      throw new BadRequestException('管理员账号不能为空');
    }

    const existingUser = await this.userRepo.findOne({
      where: {
        userName: normalizedUserName,
        delFlag: '0',
      },
      select: ['userId', 'userName', 'tenantId'],
    });

    if (existingUser) {
      throw new BadRequestException(`管理员账号已存在，请改用其他账号，如 ${normalizedUserName}_01`);
    }

    return normalizedUserName;
  }

  private async resolveTenantAdminUser(userName: string, tenantId: string) {
    const normalizedUserName = this.normalizeAdminUserName(userName);
    if (!normalizedUserName) {
      throw new BadRequestException('管理员账号不能为空');
    }

    const existingUsers = await this.userRepo.find({
      where: {
        userName: normalizedUserName,
        delFlag: '0',
      },
      select: ['userId', 'userName', 'tenantId', 'userScope'],
      order: {
        userId: 'ASC',
      },
    });

    const tenantUser = existingUsers.find((item) => item.tenantId === tenantId);
    if (tenantUser) {
      return { userName: normalizedUserName, user: tenantUser };
    }

    const occupiedUser = existingUsers.find((item) => item.tenantId !== tenantId);
    if (occupiedUser) {
      throw new BadRequestException(`管理员账号已被其他账号使用，请更换账号：${normalizedUserName}`);
    }

    return { userName: await this.ensureGlobalUserNameAvailable(normalizedUserName), user: null };
  }

  private async bindTenantMenuTemplate(roleId: number) {
    await this.roleMenuRepo
      .createQueryBuilder()
      .delete()
      .where('roleId = :roleId', { roleId })
      .andWhere('menuId NOT IN (:...templateMenuIds)', { templateMenuIds: this.tenantMenuTemplateIds })
      .execute();

    const existing = await this.roleMenuRepo.find({
      where: {
        roleId,
      },
      select: ['menuId'],
    });
    const existingMenuIds = new Set(existing.map((item) => item.menuId));
    const templateMenuIds = Array.from(new Set(this.tenantMenuTemplateIds));
    const missingMenuIds = templateMenuIds.filter((menuId) => !existingMenuIds.has(menuId));
    if (!missingMenuIds.length) return;

    await this.roleMenuRepo.save(
      missingMenuIds.map((menuId) =>
        this.roleMenuRepo.create({
          roleId,
          menuId,
        }),
      ),
    );
  }

  async create(dto: CreateTenantDto) {
    const entity = this.tenantRepo.create({
      tenantId: GenerateUUID(),
      tenantCode: dto.tenantCode,
      tenantName: dto.tenantName,
      contactName: dto.contactName || '',
      contactPhone: dto.contactPhone || '',
      status: '0',
      delFlag: '0',
      createBy: 'system',
      updateBy: 'system',
    });
    const data = await this.tenantRepo.save(entity);
    return ResultData.ok(data);
  }

  async findAll(query: ListTenantDto) {
    const qb = this.tenantRepo.createQueryBuilder('tenant').where('tenant.delFlag = :delFlag', { delFlag: '0' }).orderBy('tenant.createTime', 'DESC');

    if (query.tenantCode) {
      qb.andWhere('tenant.tenantCode LIKE :tenantCode', { tenantCode: `%${query.tenantCode}%` });
    }

    if (query.tenantName) {
      qb.andWhere('tenant.tenantName LIKE :tenantName', { tenantName: `%${query.tenantName}%` });
    }

    if (query.status) {
      qb.andWhere('tenant.status = :status', { status: query.status });
    }

    if (query.pageSize && query.pageNum) {
      qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await qb.getManyAndCount();

    return ResultData.ok({
      list,
      total,
    });
  }

  async findOne(tenantId: string) {
    const data = await this.tenantRepo.findOne({
      where: {
        tenantId,
        delFlag: '0',
      },
    });
    return ResultData.ok(data);
  }

  async update(dto: UpdateTenantDto) {
    const tenantId = dto.tenantId;
    delete (dto as any).tenantId;
    const data = await this.tenantRepo.update({ tenantId }, dto);
    return ResultData.ok(data);
  }

  async initAdmin(tenantId: string, dto: InitTenantAdminDto) {
    const tenant = await this.tenantRepo.findOne({
      where: {
        tenantId,
        delFlag: '0',
      },
    });
    if (!tenant) {
      return ResultData.fail(404, '租户不存在');
    }

    const suggestedUserName = this.buildSuggestedAdminUserName(tenant.tenantCode);
    const resolvedAdmin = await this.resolveTenantAdminUser(dto.userName || suggestedUserName, tenantId);
    dto.userName = resolvedAdmin.userName;

    let tenantAdminRole = await this.roleRepo.findOne({
      where: {
        tenantId,
        roleKey: 'tenant_admin',
        delFlag: '0',
      },
    });

    if (!tenantAdminRole) {
      tenantAdminRole = await this.roleRepo.save(
        this.roleRepo.create({
          tenantId,
          roleName: `${tenant.tenantName}管理员`,
          roleKey: 'tenant_admin',
          roleSort: 1,
          status: '0',
          dataScope: '1',
          menuCheckStrictly: false,
          deptCheckStrictly: false,
          remark: '多租户一期默认管理员角色',
          createBy: 'system',
          updateBy: 'system',
          delFlag: '0',
        }),
      );
    }

    await this.bindTenantMenuTemplate(tenantAdminRole.roleId);

    if (resolvedAdmin.user) {
      const password = bcrypt.hashSync(dto.password, bcrypt.genSaltSync(10));
      await this.userRepo.update(
        { userId: resolvedAdmin.user.userId },
        {
          tenantId,
          userScope: TENANT_USER_SCOPE,
          userType: SYS_USER_TYPE.CUSTOM,
          userName: dto.userName,
          nickName: dto.nickName,
          password,
          phonenumber: dto.phonenumber || '',
          email: dto.email || '',
          status: '0',
          userSource: 'tenant_admin_init',
          updateBy: 'system',
          delFlag: '0',
          remark: `绉熸埛绠＄悊鍛樺垵濮嬪寲: ${tenant.tenantName}`,
        },
      );

      const existingUserRole = await this.userRoleRepo.findOne({
        where: {
          userId: resolvedAdmin.user.userId,
          roleId: tenantAdminRole.roleId,
        },
      });
      if (!existingUserRole) {
        await this.userRoleRepo.save(
          this.userRoleRepo.create({
            userId: resolvedAdmin.user.userId,
            roleId: tenantAdminRole.roleId,
          }),
        );
      }

      return ResultData.ok({
        tenantId,
        adminUserId: resolvedAdmin.user.userId,
        adminRoleId: tenantAdminRole.roleId,
        userName: dto.userName,
        suggestedUserName,
      });
    }

    const salt = bcrypt.genSaltSync(10);
    const password = bcrypt.hashSync(dto.password, salt);
    const user = await this.userRepo.save(
      this.userRepo.create({
        tenantId,
        userScope: TENANT_USER_SCOPE,
        userType: SYS_USER_TYPE.CUSTOM,
        userName: dto.userName,
        nickName: dto.nickName,
        password,
        phonenumber: dto.phonenumber || '',
        email: dto.email || '',
        status: '0',
        sex: '0',
        avatar: '',
        deptId: null,
        loginIp: '',
        openid: '',
        unionid: '',
        loginDate: null,
        userSource: 'tenant_admin_init',
        createBy: 'system',
        updateBy: 'system',
        delFlag: '0',
        remark: `租户管理员初始化: ${tenant.tenantName}`,
      }),
    );

    await this.userRoleRepo.save(
      this.userRoleRepo.create({
        userId: user.userId,
        roleId: tenantAdminRole.roleId,
      }),
    );

    return ResultData.ok({
      tenantId,
      adminUserId: user.userId,
      adminRoleId: tenantAdminRole.roleId,
      userName: user.userName,
      suggestedUserName,
    });
  }
}
