import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FileUploadDto {
  @ApiProperty({ type: 'string', format: 'binary' })
  file: any;
}
export class uploadIdDto {
  @ApiProperty({ type: 'string' })
  uploadId: string;
}
export class ChunkFileDto {
  @ApiProperty({ type: 'string' })
  index: number;
  @ApiProperty({ type: 'string' })
  totalChunks: number;
  @ApiProperty({ type: 'string' })
  uploadId: string;
  @ApiProperty({ type: 'string' })
  fileName: string;
}

export class ChunkMergeFileDto {
  @ApiProperty({ type: 'string' })
  uploadId: string;
  @ApiProperty({ type: 'string' })
  fileName: string;
}

/** 文件管理 - 列表查询 */
export class ListUploadDto {
  @ApiPropertyOptional({ description: '文件名关键词' })
  newFileName?: string;

  @ApiPropertyOptional({ description: '文件名路径关键词' })
  fileName?: string;

  @ApiPropertyOptional({ description: '状态 0正常 1删除' })
  status?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  pageNum?: number;

  @ApiPropertyOptional({ description: '每页大小', default: 10 })
  pageSize?: number;
}

/** 文件管理 - 批量删除 */
export class BatchDeleteDto {
  @ApiProperty({ description: '文件ID数组' })
  uploadIds: string[];
}
