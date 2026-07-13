import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SmartBadgeService } from './smart-badge.service';
import { BadgeCallbackDto } from './dto/index';
import { ResultData } from 'src/common/utils/result';
import { NotRequireAuth } from 'src/module/system/user/user.decorator';

@ApiTags('硬件-护理设备回调')
@Controller('hardware/badge')
export class SmartBadgeController {
  constructor(private readonly smartBadgeService: SmartBadgeService) {}

  @ApiOperation({ summary: '护理设备数据回调' })
  @NotRequireAuth()
  @Post('/callback')
  @HttpCode(200)
  async callback(@Body() body: BadgeCallbackDto) {
    const { dataType, deviceNo, data } = body;
    if (!dataType || !deviceNo) {
      return ResultData.fail(400, '缺少 dataType 或 deviceNo');
    }
    return this.smartBadgeService.dispatch(dataType, deviceNo, data);
  }
}
