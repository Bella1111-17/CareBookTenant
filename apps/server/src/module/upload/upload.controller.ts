import { Controller, Get, Post, Delete, Body, Query, Param, UploadedFile, UseInterceptors, HttpCode } from '@nestjs/common';
import { UploadService } from './upload.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { ChunkFileDto, ChunkMergeFileDto, FileUploadDto, uploadIdDto, ListUploadDto, BatchDeleteDto } from './dto/index';
import { ResultData } from 'src/common/utils/result';

@ApiTags('通用-文件上传')
@Controller('common/upload')
@ApiBearerAuth('Authorization')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 文件上传
   * @param file
   * @returns
   */
  @ApiOperation({
    summary: '文件上传',
  })
  @ApiBody({
    type: FileUploadDto,
    required: true,
  })
  @HttpCode(200)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async singleFileUpload(@UploadedFile() file: Express.Multer.File) {
    const res = await this.uploadService.singleFileUpload(file);
    if (res instanceof ResultData) return res;
    return ResultData.ok(res);
  }

  /**
   * 获取切片上传任务Id
   * @param file
   * @returns
   */
  @ApiOperation({
    summary: '获取切片上传任务Id',
  })
  @ApiBody({
    required: true,
  })
  @HttpCode(200)
  @Get('/chunk/uploadId')
  getChunkUploadId() {
    return this.uploadService.getChunkUploadId();
  }

  /**
   * 文件分片上传
   * @param file
   * @returns
   */
  @ApiOperation({
    summary: '文件切片上传',
  })
  @ApiBody({
    required: true,
  })
  @HttpCode(200)
  @Post('/chunk')
  @UseInterceptors(FileInterceptor('file'))
  chunkFileUpload(@UploadedFile() file: Express.Multer.File, @Body() body: ChunkFileDto) {
    return this.uploadService.chunkFileUpload(file, body);
  }

  /**
   * 文件分片合并
   * @returns
   */
  @ApiOperation({
    summary: '合并切片',
  })
  @ApiBody({
    type: ChunkMergeFileDto,
    required: true,
  })
  @HttpCode(200)
  @Post('/chunk/merge')
  chunkMergeFile(@Body() body: ChunkMergeFileDto) {
    return this.uploadService.chunkMergeFile(body);
  }

  /**
   * 获取切片上传任务结果
   * @param file
   * @returns
   *
   */
  @ApiOperation({
    summary: '获取切片上传结果',
  })
  @ApiQuery({
    type: uploadIdDto,
    required: true,
  })
  @HttpCode(200)
  @Get('/chunk/result')
  getChunkUploadResult(@Query() query: { uploadId: string }) {
    return this.uploadService.getChunkUploadResult(query.uploadId);
  }

  /**
   * 获取cos授权
   * @param query
   */
  @ApiOperation({
    summary: '获取OSS上传签名',
  })
  @ApiBody({
    required: true,
  })
  @Get('/cos/authorization')
  getAuthorization(@Query() query: { key: string }) {
    return this.uploadService.getAuthorization(query.key);
  }

  // ==================== 文件管理 CRUD ====================

  /**
   * 文件管理 - 列表查询
   */
  @ApiOperation({ summary: '文件列表' })
  @ApiQuery({ type: ListUploadDto })
  @Get('/list')
  findAll(@Query() query: ListUploadDto) {
    return this.uploadService.findAll(query);
  }

  /**
   * 文件管理 - 详情
   */
  @ApiOperation({ summary: '文件详情' })
  @Get('/detail/:uploadId')
  findOne(@Param('uploadId') uploadId: string) {
    return this.uploadService.findOne(uploadId);
  }

  /**
   * 文件管理 - 删除单个文件
   */
  @ApiOperation({ summary: '删除文件' })
  @Delete('/:uploadId')
  remove(@Param('uploadId') uploadId: string) {
    return this.uploadService.remove(uploadId);
  }

  /**
   * 文件管理 - 批量删除
   */
  @ApiOperation({ summary: '批量删除文件' })
  @Delete('/batch')
  batchRemove(@Body() dto: BatchDeleteDto) {
    return this.uploadService.batchRemove(dto);
  }
}
