import { Controller, Get, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { MainService } from './main.service';
import { RegisterDto, LoginDto } from './dto/index';
import { createMath } from 'src/common/utils/captcha';
import { ResultData } from 'src/common/utils/result';
import { GenerateUUID } from 'src/common/utils/index';
import { RedisService } from 'src/module/common/redis/redis.service';
import { CacheEnum } from 'src/common/enum/index';
import { SysConfigService } from 'src/module/system/sysconfig/sysconfig.service';
import { ClientInfo, ClientInfoDto } from 'src/common/decorators/common.decorator';
import { UserService } from 'src/module/system/user/user.service';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

@ApiTags('根目录')
@Controller('/')
@ApiBearerAuth('Authorization')
export class MainController {
  constructor(
    private readonly mainService: MainService,
    private readonly userService: UserService,
    private readonly redisService: RedisService,
    private readonly configService: SysConfigService,
  ) {}

  @ApiOperation({
    summary: '用户登录',
  })
  @ApiBody({
    type: LoginDto,
    required: true,
  })
  @NotRequireAuth()
  @Post('/login')
  @HttpCode(200)
  login(@Body() user: LoginDto, @ClientInfo() clientInfo: ClientInfoDto) {
    return this.mainService.login(user, clientInfo);
  }

  @ApiOperation({
    summary: '刷新 access_token',
  })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } } } })
  @NotRequireAuth()
  @Post('/refresh-token')
  @HttpCode(200)
  refreshToken(@Body() body: { refreshToken: string }) {
    return this.mainService.refreshToken(body.refreshToken);
  }

  @ApiOperation({
    summary: '退出登录',
  })
  @ApiBody({
    type: LoginDto,
    required: true,
  })
  @NotRequireAuth()
  @Post('/logout')
  @HttpCode(200)
  async logout(@User() user: UserDto, @ClientInfo() clientInfo: ClientInfoDto) {
    if (user?.token) {
      await this.userService.clearUserSession(user.token);
    }
    return this.mainService.logout(clientInfo);
  }

  @ApiOperation({
    summary: '用户注册',
  })
  @ApiBody({
    type: RegisterDto,
    required: true,
  })
  @Post('/register')
  @HttpCode(200)
  register(@Body() user: RegisterDto) {
    return this.mainService.register(user);
  }

  @ApiOperation({
    summary: '账号自助-是否开启用户注册功能',
  })
  @Get('/registerUser')
  async registerUser() {
    const res = await this.configService.getConfigValue('sys.account.registerUser');
    const enable = res === 'true';
    return ResultData.ok(enable, '操作成功');
  }

  @ApiOperation({
    summary: '获取验证码图片',
  })
  @Get('/captchaImage')
  async captchaImage() {
    const enable = await this.configService.getConfigValue('sys.account.captchaEnabled');
    const captchaEnabled: boolean = enable === 'true';
    const data = {
      captchaEnabled,
      img: '',
      uuid: '',
    };
    try {
      if (captchaEnabled) {
        const captchaInfo = createMath();
        data.img = captchaInfo.data;
        data.uuid = GenerateUUID();
        await this.redisService.set(CacheEnum.CAPTCHA_CODE_KEY + data.uuid, captchaInfo.text.toLowerCase(), 1000 * 60 * 5);
      }
      return ResultData.ok(data, '操作成功');
    } catch (err) {
      return ResultData.fail(500, '生成验证码错误，请重试');
    }
  }

  @ApiOperation({
    summary: '用户信息',
  })
  @Get('/getInfo')
  async getInfo(@User() user: UserDto) {
    const userInfo = await this.userService.getUserinfo(user.user.userId);
    delete userInfo.password;
    return ResultData.ok({
      permissions: user.permissions,
      roles: user.roles,
      user: userInfo,
    });
  }

  @ApiOperation({
    summary: '路由信息',
  })
  @Get('/getRouters')
  getRouters(@User() user: UserDto) {
    const userId = user.user.userId.toString();
    return this.mainService.getRouters(+userId);
  }
}
