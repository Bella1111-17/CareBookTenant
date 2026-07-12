import { Body, Controller, Delete, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import dayjs from 'dayjs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SmartBadgeService } from './smart-badge.service';
import { AudioAuditService } from './services/audio-audit.service';
import { BadgeCallbackDto, BindDeviceDto, CreateBadgeDeviceDto, DeleteBadgeDeviceDto, UnbindDeviceDto, UpdateBadgeDeviceDto } from './dto/index';
import { ResultData } from 'src/common/utils/result';
import { NotRequireAuth, User, UserDto } from 'src/module/system/user/user.decorator';

@ApiTags('硬件-智能工牌')
@Controller('hardware/badge')
export class SmartBadgeController {
  constructor(
    private readonly smartBadgeService: SmartBadgeService,
    private readonly auditService: AudioAuditService,
  ) {}

  @ApiOperation({ summary: '工牌回调通知' })
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

  @ApiOperation({ summary: '绑定设备到用户' })
  @Post('/bind')
  @HttpCode(200)
  bindDevice(@Body() dto: BindDeviceDto) {
    return this.smartBadgeService.bindDevice(dto);
  }

  @ApiOperation({ summary: '新增设备主档' })
  @Post('/device')
  @HttpCode(200)
  createDevice(@Body() dto: CreateBadgeDeviceDto) {
    return this.smartBadgeService.createDevice(dto);
  }

  @ApiOperation({ summary: '编辑设备主档' })
  @Post('/device/update')
  @HttpCode(200)
  updateDevice(@Body() dto: UpdateBadgeDeviceDto) {
    return this.smartBadgeService.updateDevice(dto);
  }

  @ApiOperation({ summary: '多级校验删除设备主档' })
  @Post('/device/delete-review')
  @HttpCode(200)
  deleteDevice(@User() user: UserDto, @Body() dto: DeleteBadgeDeviceDto) {
    return this.smartBadgeService.deleteDevice(dto, user?.user?.userName);
  }

  @ApiOperation({ summary: '恢复已删除设备主档' })
  @Post('/device/restore/:id')
  @HttpCode(200)
  restoreDevice(@User() user: UserDto, @Param('id') id: number) {
    return this.smartBadgeService.restoreDevice(Number(id), user?.user?.userName);
  }

  @ApiOperation({ summary: '解绑设备' })
  @Post('/unbind')
  @HttpCode(200)
  unbindDevice(@Body() dto: UnbindDeviceDto) {
    return this.smartBadgeService.unbindDevice(dto);
  }

  @ApiOperation({ summary: '设备主档列表' })
  @Get('/device/list')
  deviceList(@Query() query: any) {
    return this.smartBadgeService.deviceList(query);
  }

  @ApiOperation({ summary: '设备绑定列表' })
  @Get('/binding/list')
  bindingList(@Query() query: any) {
    return this.smartBadgeService.bindingList(query);
  }

  @ApiOperation({ summary: '设备绑定概览' })
  @Get('/binding/device-summary')
  bindingDeviceSummary(@Query() query: any) {
    return this.smartBadgeService.bindingDeviceSummary(query);
  }

  @ApiOperation({ summary: '录音记录列表' })
  @Get('/record/list')
  recordList(@Query() query: any) {
    return this.smartBadgeService.recordList(query);
  }

  @ApiOperation({ summary: 'GPS 定位日志' })
  @Get('/gps/list')
  gpsLogList(@Query() query: any) {
    return this.smartBadgeService.gpsLogList(query);
  }

  @ApiOperation({ summary: '设备事件日志' })
  @Get('/event/list')
  eventLogList(@Query() query: any) {
    return this.smartBadgeService.eventLogList(query);
  }

  @ApiOperation({ summary: '删除录音记录' })
  @Delete('/record/:id')
  recordDelete(@Param('id') id: number) {
    return this.smartBadgeService.recordDelete(id);
  }

  @ApiOperation({ summary: '手动触发阿里云 ASR 转写' })
  @Post('/transcribe/:id')
  @HttpCode(200)
  manualTranscribe(@Param('id') id: number) {
    return this.smartBadgeService.manualTranscribe(id);
  }

  @ApiOperation({ summary: '从原始 JSON 重新生成带时间戳的纯文本' })
  @Post('/record/rebuild-text')
  @HttpCode(200)
  async rebuildText(@Body() dto: { ids: number[] }) {
    let ok = 0;
    let fail = 0;

    for (const id of dto.ids) {
      try {
        await this.smartBadgeService.rebuildTranscriptText(id);
        ok++;
      } catch {
        fail++;
      }
    }

    return ResultData.ok({ ok, fail }, `重组完成，成功 ${ok}，失败 ${fail}`);
  }

  @ApiOperation({ summary: '生成单设备护工日报' })
  @Post('/audit/report/generate')
  @HttpCode(200)
  async generateReport(@Body() dto: { deviceNo?: string; dateStr?: string }) {
    const dateStr = dto.dateStr || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    try {
      if (!dto.deviceNo) {
        return ResultData.fail(400, '批量生成日报已临时停用，请指定设备号');
      }
      const report = await this.auditService.generateDailyReport(dto.deviceNo, dateStr);
      return ResultData.ok(report, '日报生成成功');
    } catch (err) {
      return ResultData.fail(500, err.message);
    }
  }

  @ApiOperation({ summary: 'AI 日报列表' })
  @Get('/audit/report/list')
  @HttpCode(200)
  reportList(@Query() query: any) {
    return this.smartBadgeService.reportList(query);
  }

  @ApiOperation({ summary: 'AI 日报详情，包含大文本' })
  @Get('/audit/report/detail/:id')
  @HttpCode(200)
  reportDetail(@Param('id') id: number) {
    return this.smartBadgeService.reportDetail(id);
  }
}
