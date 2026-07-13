import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { SysMenuEntity } from './entities/menu.entity';
import { SysRoleWithMenuEntity } from '../role/entities/role-width-menu.entity';
import { CreateMenuDto, UpdateMenuDto, ListDeptDto } from './dto/index';
import { ListToTree, Uniq } from 'src/common/utils/index';
import { UserService } from '../user/user.service';
import { buildMenus } from './utils';
import { UserEntity } from '../user/entities/sys-user.entity';
import { TENANT_USER_SCOPE } from 'src/common/tenant/tenant.constants';
import { TYPE_BUTTON, TYPE_DIR } from '../user/user.constant';

const TENANT_EXCLUDED_PATHS = new Set(['/', 'index', '/index']);
const TENANT_EXCLUDED_PERM_PREFIXES = ['system:tenant:'];
const TENANT_ALLOWED_PATH_PREFIXES = ['tenant-care', '/tenant-care'];
const TENANT_ALLOWED_PERM_PREFIXES = ['tenant-care:'];
const TENANT_ENTRY_PATH_PREFIXES = ['tenant-care', '/tenant-care'];
const OBSOLETE_SMART_BADGE_PATH_PREFIXES = ['smart-badge', '/smart-badge', 'system/smart-badge', '/system/smart-badge'];
const OBSOLETE_SMART_BADGE_COMPONENT_PREFIXES = ['system/smart-badge/'];
const OBSOLETE_SMART_BADGE_PERM_PREFIXES = ['system:badge:'];

@Injectable()
export class MenuService {
  constructor(
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    @InjectRepository(SysMenuEntity)
    private readonly sysMenuEntityRep: Repository<SysMenuEntity>,
    @InjectRepository(SysRoleWithMenuEntity)
    private readonly sysRoleWithMenuEntityRep: Repository<SysRoleWithMenuEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async create(createMenuDto: CreateMenuDto) {
    const res = await this.sysMenuEntityRep.save(createMenuDto);
    return ResultData.ok(res);
  }

  async findAll(query: ListDeptDto) {
    const entity = this.sysMenuEntityRep.createQueryBuilder('entity');
    entity.where('entity.delFlag = :delFlag', { delFlag: '0' });

    if (query.menuName) {
      entity.andWhere('entity.menuName LIKE :menuName', { menuName: `%${query.menuName}%` });
    }
    if (query.status) {
      entity.andWhere('entity.status = :status', { status: query.status });
    }
    entity.orderBy('entity.orderNum', 'ASC');

    const res = await entity.getMany();
    return ResultData.ok(res);
  }

  async treeSelect() {
    const res = await this.sysMenuEntityRep.find({
      where: {
        delFlag: '0',
      },
      order: {
        orderNum: 'ASC',
      },
    });
    const tree = ListToTree(
      res,
      (m) => m.menuId,
      (m) => m.menuName,
    );
    return ResultData.ok(tree);
  }

  async roleMenuTreeselect(roleId: number): Promise<any> {
    const res = await this.sysMenuEntityRep.find({
      where: {
        delFlag: '0',
      },
      order: {
        orderNum: 'ASC',
        parentId: 'ASC',
      },
    });
    const tree = ListToTree(
      res,
      (m) => m.menuId,
      (m) => m.menuName,
    );
    const menuIds = await this.sysRoleWithMenuEntityRep.find({
      where: { roleId: roleId },
      select: ['menuId'],
    });
    const checkedKeys = menuIds.map((item) => {
      return item.menuId;
    });
    return ResultData.ok({
      menus: tree,
      checkedKeys: checkedKeys,
    });
  }

  async findOne(menuId: number) {
    const res = await this.sysMenuEntityRep.findOne({
      where: {
        delFlag: '0',
        menuId: menuId,
      },
    });
    return ResultData.ok(res);
  }

  async update(updateMenuDto: UpdateMenuDto) {
    const res = await this.sysMenuEntityRep.update({ menuId: updateMenuDto.menuId }, updateMenuDto);
    return ResultData.ok(res);
  }

  async remove(menuId: number) {
    const data = await this.sysMenuEntityRep.update(
      { menuId: menuId },
      {
        delFlag: '1',
      },
    );
    return ResultData.ok(data);
  }

  async findMany(where: FindManyOptions<SysMenuEntity>) {
    return await this.sysMenuEntityRep.find(where);
  }

  private isTenantExcludedMenu(menu: SysMenuEntity) {
    const path = String(menu.path || '').trim();
    const perms = String(menu.perms || '').trim();
    return TENANT_EXCLUDED_PATHS.has(path) || TENANT_EXCLUDED_PERM_PREFIXES.some((prefix) => perms.startsWith(prefix));
  }

  private isObsoleteSmartBadgeMenu(menu: SysMenuEntity) {
    const path = String(menu.path || '').trim();
    const component = String(menu.component || '').trim();
    const perms = String(menu.perms || '').trim();
    return (
      (menu.menuName === '智能工牌' && path === 'badge') ||
      OBSOLETE_SMART_BADGE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ||
      OBSOLETE_SMART_BADGE_COMPONENT_PREFIXES.some((prefix) => component.startsWith(prefix)) ||
      OBSOLETE_SMART_BADGE_PERM_PREFIXES.some((prefix) => perms.startsWith(prefix))
    );
  }

  private isTenantAllowedMenu(menu: SysMenuEntity) {
    const path = String(menu.path || '').trim();
    const perms = String(menu.perms || '').trim();
    return TENANT_ALLOWED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) || TENANT_ALLOWED_PERM_PREFIXES.some((prefix) => perms.startsWith(prefix));
  }

  private normalizeTenantMenuList(menuList: SysMenuEntity[]) {
    const menuMap = new Map(menuList.map((item) => [item.menuId, item]));
    const tenantVisibleMenuIds = new Set<number>();

    menuList.forEach((item) => {
      if (this.isTenantExcludedMenu(item) || !this.isTenantAllowedMenu(item)) return;
      let current: SysMenuEntity | undefined = item;
      while (current && !tenantVisibleMenuIds.has(current.menuId)) {
        tenantVisibleMenuIds.add(current.menuId);
        current = current.parentId ? menuMap.get(current.parentId) : undefined;
      }
    });

    const visibleMenuList = menuList.filter((item) => tenantVisibleMenuIds.has(item.menuId) && !this.isTenantExcludedMenu(item));
    const visibleMenuIds = new Set(visibleMenuList.map((item) => item.menuId));

    const tenantMenuList = visibleMenuList.map((item) => {
      const path = String(item.path || '').trim();
      const isTenantEntryMenu = TENANT_ENTRY_PATH_PREFIXES.some((prefix) => path === prefix);
      if (isTenantEntryMenu || (item.parentId !== 0 && !visibleMenuIds.has(item.parentId))) {
        return {
          ...item,
          path: isTenantEntryMenu ? path.replace(/^\/+/, '') : item.path,
          parentId: 0,
        } as SysMenuEntity;
      }
      return item;
    });
    const parentIds = new Set(tenantMenuList.filter((item) => item.parentId !== 0).map((item) => item.parentId));
    return tenantMenuList.filter((item) => item.menuType !== TYPE_DIR || parentIds.has(item.menuId));
  }

  /**
   * 根据用户ID查询菜单
   *
   * @param userId 用户ID
   * @return 菜单列表
   */
  async getMenuListByUserId(userId: number) {
    let menuWidthRoleList = [];
    const currentUser = await this.userRepo.findOne({
      where: {
        userId,
        delFlag: '0',
      },
      select: ['userId', 'userScope'],
    });
    const roleIds = await this.userService.getRoleIds([userId]);
    if (roleIds.includes(1)) {
      // 超管roleId=1，所有菜单权限
      menuWidthRoleList = await this.sysMenuEntityRep.find({
        where: {
          delFlag: '0',
          status: '0',
        },
        select: ['menuId'],
      });
    } else {
      // 查询角色绑定的菜单
      menuWidthRoleList = await this.sysRoleWithMenuEntityRep.find({
        where: { roleId: In(roleIds) },
        select: ['menuId'],
      });
    }
    // 菜单Id去重
    const menuIds = Uniq(menuWidthRoleList.map((item) => item.menuId));
    // 菜单列表
    const menuList = await this.sysMenuEntityRep.find({
      where: {
        delFlag: '0',
        status: '0',
        menuId: In(menuIds),
      },
      order: {
        orderNum: 'ASC',
      },
    });
    const activeMenuList = menuList.filter((item) => !this.isObsoleteSmartBadgeMenu(item));
    const filteredMenuList = currentUser?.userScope === TENANT_USER_SCOPE ? this.normalizeTenantMenuList(activeMenuList) : activeMenuList;
    const routerMenuList = filteredMenuList.filter((item) => item.menuType !== TYPE_BUTTON);
    // 构建前端需要的菜单树
    const menuTree = buildMenus(routerMenuList);
    return menuTree;
  }
}
