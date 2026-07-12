import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BadgeCallbackDto {
  @ApiProperty({ description: '数据类型: Audio|Gps|AudioText|LoginLog|ControlLog|UploadLog|HeartbeatLog|DebugLog|MergeAudio' })
  @IsNotEmpty()
  @IsString()
  dataType: string;

  @ApiProperty({ description: '时间戳' })
  @IsNotEmpty()
  @IsString()
  timeStamp: string;

  @ApiProperty({ description: '设备编号' })
  @IsNotEmpty()
  @IsString()
  deviceNo: string;

  @ApiProperty({ description: '业务数据体' })
  @IsNotEmpty()
  data: BadgePushData;
}

export class AudioPushData {
  fileName: string;
  chunkIndex?: string;
  deviceNo: string;
  startTime: string;
  endTime?: string;
  usrNo?: string;
  deviceType?: string;
  hasBody?: boolean;
  extended?: string;
  orgName?: string;
  roleName?: string;
  userName?: string;
  userId?: string;
}

export class GpsPushData {
  deviceNo: string;
  gpsStatus?: number;
  gpsModel?: number;
  longitude?: number;
  latitude?: number;
  wifiLongitude?: number;
  wifiLatitude?: number;
  gaodeLongitude?: number;
  gaodeLatitude?: number;
  cellLongitude?: number;
  cellLatitude?: number;
  cellWifiLongitude?: number;
  cellWifiLatitude?: number;
  createdTime?: string;
}

export class AudioTextPushData {
  filename: string;
  deviceNo: string;
  taskId?: number;
  size?: number;
  duration?: number;
  status?: string;
  segments?: AudioTextSegment[];
}

export class AudioTextSegment {
  taskId?: number;
  text?: string;
  speakerId?: number;
  language?: string;
  startMillisecond?: number;
  endMillisecond?: number;
  startTimeStr?: string;
  endTimeStr?: string;
  dateStart?: string;
  dateEnd?: string;
  channelId?: number;
}

export class LoginLogPushData {
  deviceNo: string;
  validateResult?: string;
  protocolVersion?: number;
  endpoint?: string;
  createdTime?: string;
}

export class ControlLogPushData {
  deviceNo: string;
  dataType?: string;
  controlValue?: string;
  status?: string;
  createdTime?: string;
}

export class UploadLogPushData {
  deviceNo: string;
  fileName: string;
  chunkIndex?: string;
  startTime: string;
  endTime?: string;
  realStartTime?: string;
  realEndTime?: string;
  usrNo?: string;
  lengthBytes?: number;
  createdTime?: string;
  fileDownLoadUrl?: string;
  objectStoreUrl?: string;
}

export class HeartbeatLogPushData {
  deviceNo: string;
  deviceStatus?: string;
  powerStatus?: boolean;
  remainPower?: number;
  remainStorageSize?: number;
  totalStorageSize?: string;
  heartbeatTime?: string;
  deviceVer?: string;
  extend?: string;
  body?: string;
  createdTime?: string;
}

export class DebugLogPushData {
  deviceNo: string;
  body?: string;
  createdTime?: string;
}

export class MergeAudioPushData {
  deviceNo: string;
  fileDownLoadUrl?: string;
  fileName?: string;
  size?: number;
  duration?: number;
  extension?: string;
  startTime?: string;
  endTime?: string;
  createdTime?: string;
  objectStoreUrl?: string;
}

export type BadgePushData = AudioPushData | GpsPushData | AudioTextPushData | LoginLogPushData | ControlLogPushData | UploadLogPushData | HeartbeatLogPushData | DebugLogPushData | MergeAudioPushData;

export class BindDeviceDto {
  @ApiProperty({ description: '设备号' })
  @IsNotEmpty({ message: '设备号不能为空' })
  @IsString()
  deviceNo: string;

  @ApiProperty({ description: '用户 ID' })
  @IsNotEmpty({ message: '用户 ID 不能为空' })
  @IsInt()
  userId: number;
}

export class UnbindDeviceDto {
  @ApiProperty({ description: '设备号' })
  @IsNotEmpty({ message: '设备号不能为空' })
  @IsString()
  deviceNo: string;
}

export class CreateBadgeDeviceDto {
  @ApiProperty({ description: '设备号' })
  @IsNotEmpty({ message: '设备号不能为空' })
  @IsString()
  deviceNo: string;

  @ApiPropertyOptional({ description: '状态 0启用 1停用' })
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateBadgeDeviceDto extends CreateBadgeDeviceDto {
  @ApiProperty({ description: '设备主键' })
  @IsNotEmpty({ message: '设备主键不能为空' })
  @IsInt()
  id: number;
}

export class DeleteBadgeDeviceDto {
  @ApiProperty({ description: '设备主键' })
  @IsNotEmpty({ message: '设备主键不能为空' })
  @IsInt()
  id: number;

  @ApiProperty({ description: '二次确认的设备号' })
  @IsNotEmpty({ message: '请输入设备号进行确认' })
  @IsString()
  confirmDeviceNo: string;

  @ApiProperty({ description: '删除原因' })
  @IsNotEmpty({ message: '请填写删除原因' })
  @IsString()
  reason: string;
}
