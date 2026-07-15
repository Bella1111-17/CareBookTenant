import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { pathToRegexp } from 'path-to-regexp';
import { ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { UserService } from 'src/module/system/user/user.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private globalWhiteList = [];
  private readonly globalPrefix: string;
  constructor(
    private readonly reflector: Reflector,
    @Inject(UserService)
    private readonly userService: UserService,
    private readonly config: ConfigService,
  ) {
    super();
    this.globalWhiteList = [].concat(this.config.get('perm.router.whitelist') || []);
    this.globalPrefix = this.normalizePath(this.config.get<string>('app.prefix') || '');
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const notRequireAuth = this.reflector.getAllAndOverride('notRequireAuth', [ctx.getClass(), ctx.getHandler()]);

    if (notRequireAuth) {
      await this.jumpActivate(ctx);
      return true;
    }

    const isInWhiteList = this.checkWhiteList(ctx);
    if (isInWhiteList) {
      await this.jumpActivate(ctx);
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const accessToken = req.get('Authorization');

    if (!accessToken) throw new UnauthorizedException('请重新登录');
    const atUserId = await this.userService.parseToken(accessToken);
    if (!atUserId) throw new UnauthorizedException('当前登录已过期，请重新登录');
    return await this.activate(ctx);
  }

  async activate(ctx: ExecutionContext) {
    return super.canActivate(ctx) as boolean;
  }

  /**
   * 跳过验证
   * @param ctx
   * @returns
   */
  async jumpActivate(ctx: ExecutionContext) {
    try {
      await this.activate(ctx);
    } catch (e) {
      // 未登录不做任何处理，直接返回 true
    }

    return true;
  }

  /**
   * 检查接口是否在白名单内
   * @param ctx
   * @returns
   */
  checkWhiteList(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const requestPaths = this.getRequestPaths(req);
    const i = this.globalWhiteList.findIndex((route) => {
      // 请求方法类型相同
      if (!route.method || req.method.toUpperCase() === route.method.toUpperCase()) {
        // 对比 url
        const routeRegexp = pathToRegexp(route.path);
        return requestPaths.some((requestPath) => routeRegexp.exec(requestPath));
      }
      return false;
    });
    // 在白名单内 则 进行下一步， i === -1 ，则不在白名单，需要 比对是否有当前接口权限
    return i > -1;
  }

  private getRequestPaths(req: any): string[] {
    const rawPaths = [req.route?.path, req.path, req.originalUrl, req.url]
      .filter(Boolean)
      .map((item: string) => this.normalizePath(item));
    const paths = new Set<string>();

    rawPaths.forEach((item) => {
      paths.add(item);
      if (this.globalPrefix && item.startsWith(`${this.globalPrefix}/`)) {
        paths.add(this.normalizePath(item.slice(this.globalPrefix.length)));
      }
    });

    return [...paths];
  }

  private normalizePath(pathValue: string): string {
    const pathWithoutQuery = pathValue.split('?')[0] || '/';
    const normalized = pathWithoutQuery.startsWith('/') ? pathWithoutQuery : `/${pathWithoutQuery}`;
    return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
  }
}
