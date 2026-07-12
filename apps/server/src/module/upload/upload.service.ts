import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ResultData } from 'src/common/utils/result';
import { SysUploadEntity } from './entities/upload.entity';
import { ChunkFileDto, ChunkMergeFileDto, ListUploadDto, BatchDeleteDto } from './dto/index';
import { GenerateUUID } from 'src/common/utils/index';
import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import OSS from 'ali-oss';
import Mime from 'mime-types';

@Injectable()
export class UploadService {
  private thunkDir: string;
  private isLocal: boolean;
  private ossClient?: OSS;

  constructor(
    @InjectRepository(SysUploadEntity)
    private readonly sysUploadEntityRep: Repository<SysUploadEntity>,
    @Inject(ConfigService)
    private config: ConfigService,
  ) {
    this.thunkDir = 'thunk';
    this.isLocal = this.config.get('app.file.isLocal');

    if (!this.isLocal) {
      this.ossClient = new OSS({
        region: this.config.get('oss.region'),
        accessKeyId: this.config.get('oss.secretId'),
        accessKeySecret: this.config.get('oss.secretKey'),
        bucket: this.config.get('oss.bucket'),
        secure: true,
      });
    }
  }

  private getOssClient() {
    if (!this.ossClient) {
      throw new Error('OSS client is not configured');
    }
    return this.ossClient;
  }

  /**
   * 单文件上传
   */
  async singleFileUpload(file: Express.Multer.File) {
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    if (Number(fileSize) > this.config.get('app.file.maxSize')) {
      return ResultData.fail(500, `文件大小不能超过${this.config.get('app.file.maxSize')}MB`);
    }

    let res;
    if (this.isLocal) {
      res = await this.saveFileLocal(file);
    } else {
      const targetDir = this.config.get('oss.location') || 'common';
      res = await this.saveFileOss(targetDir, file);
    }

    const uploadId = GenerateUUID();
    await this.sysUploadEntityRep.save({
      uploadId,
      ...res,
      ext: path.extname(res.newFileName),
      size: file.size,
    });
    return res;
  }

  /**
   * 获取上传任务Id
   */
  async getChunkUploadId() {
    const uploadId = GenerateUUID();
    return ResultData.ok({ uploadId });
  }

  /**
   * 文件切片上传
   */
  async chunkFileUpload(file: Express.Multer.File, body: ChunkFileDto) {
    const rootPath = process.cwd();
    const baseDirPath = path.posix.join(rootPath, this.config.get('app.file.location'));
    const chunckDirPath = path.posix.join(baseDirPath, this.thunkDir, body.uploadId);
    if (!fs.existsSync(chunckDirPath)) {
      this.mkdirsSync(chunckDirPath);
    }
    const chunckFilePath = path.posix.join(chunckDirPath, `${body.uploadId}${body.fileName}@${body.index}`);
    if (fs.existsSync(chunckFilePath)) {
      return ResultData.ok();
    } else {
      fs.writeFileSync(chunckFilePath, file.buffer);
      return ResultData.ok();
    }
  }

  /**
   * 检查切片是否已上传
   */
  async checkChunkFile(body) {
    const rootPath = process.cwd();
    const baseDirPath = path.posix.join(rootPath, this.config.get('app.file.location'));
    const chunckDirPath = path.posix.join(baseDirPath, this.thunkDir, body.uploadId);
    const chunckFilePath = path.posix.join(chunckDirPath, `${body.uploadId}${body.fileName}@${body.index}`);
    if (!fs.existsSync(chunckFilePath)) {
      return ResultData.fail(500, '文件不存在');
    } else {
      return ResultData.ok();
    }
  }

  /**
   * 递归创建目录 同步方法
   */
  mkdirsSync(dirname) {
    if (fs.existsSync(dirname)) {
      return true;
    } else {
      if (this.mkdirsSync(path.dirname(dirname))) {
        fs.mkdirSync(dirname);
        return true;
      }
    }
  }

  /**
   * 文件切片合并
   */
  async chunkMergeFile(body: ChunkMergeFileDto) {
    const { uploadId, fileName } = body;
    const rootPath = process.cwd();
    const baseDirPath = path.posix.join(rootPath, this.config.get('app.file.location'));
    const sourceFilesDir = path.posix.join(baseDirPath, this.thunkDir, uploadId);

    if (!fs.existsSync(sourceFilesDir)) {
      return ResultData.fail(500, '文件不存在');
    }

    const newFileName = this.getNewFileName(fileName);
    const targetFile = path.posix.join(baseDirPath, newFileName);
    await this.thunkStreamMerge(sourceFilesDir, targetFile);

    const relativeFilePath = targetFile.replace(baseDirPath, '');
    const url = path.posix.join(this.config.get('app.file.domain'), fileName);
    const key = path.posix.join('test', relativeFilePath);
    const data = {
      fileName: key,
      newFileName: newFileName,
      url: url,
    };
    const stats = fs.statSync(targetFile);

    if (!this.isLocal) {
      await this.uploadLargeFileOss(targetFile, key, uploadId);
      data.url = `${this.config.get('oss.domain')}/${key}`;
      await this.sysUploadEntityRep.save({
        uploadId,
        ...data,
        ext: path.extname(data.newFileName),
        size: stats.size,
        status: '0',
      });
      return ResultData.ok(data);
    }

    await this.sysUploadEntityRep.save({
      uploadId,
      ...data,
      ext: path.extname(data.newFileName),
      size: stats.size,
    });
    return ResultData.ok(data);
  }

  /**
   * 流合并切片
   */
  async thunkStreamMerge(sourceFilesDir, targetFile) {
    const fileList = fs
      .readdirSync(sourceFilesDir)
      .filter((file) => fs.lstatSync(path.posix.join(sourceFilesDir, file)).isFile())
      .sort((a, b) => parseInt(a.split('@')[1]) - parseInt(b.split('@')[1]))
      .map((name) => ({
        name,
        filePath: path.posix.join(sourceFilesDir, name),
      }));

    const fileWriteStream = fs.createWriteStream(targetFile);
    let onResolve: (value) => void;
    const callbackPromise = new Promise((resolve) => {
      onResolve = resolve;
    });
    this.thunkStreamMergeProgress(fileList, fileWriteStream, sourceFilesDir, onResolve);
    return callbackPromise;
  }

  /**
   * 合并每一个切片
   */
  thunkStreamMergeProgress(fileList, fileWriteStream, sourceFilesDir, onResolve) {
    if (!fileList.length) {
      fs.rmdirSync(sourceFilesDir, { recursive: true });
      onResolve(true);
      return;
    }

    const { filePath: chunkFilePath } = fileList.shift();
    const currentReadStream = fs.createReadStream(chunkFilePath);
    currentReadStream.pipe(fileWriteStream, { end: false });
    currentReadStream.on('end', () => {
      this.thunkStreamMergeProgress(fileList, fileWriteStream, sourceFilesDir, onResolve);
    });
  }

  /**
   * 保存文件到本地
   */
  async saveFileLocal(file: Express.Multer.File) {
    const rootPath = process.cwd();
    const baseDirPath = path.posix.join(rootPath, this.config.get('app.file.location'));
    const originalname = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');
    const ext = Mime.extension(file.mimetype);
    const newFileName = this.getNewFileName(originalname) + '.' + ext;
    const targetFile = path.posix.join(baseDirPath, newFileName);
    const sourceFilesDir = path.dirname(targetFile);
    const relativeFilePath = targetFile.replace(baseDirPath, '');

    if (!fs.existsSync(sourceFilesDir)) {
      this.mkdirsSync(sourceFilesDir);
    }
    fs.writeFileSync(targetFile, file.buffer);

    const fileName = path.posix.join(this.config.get('app.file.serveRoot'), relativeFilePath);
    const url = path.posix.join(this.config.get('app.file.domain'), fileName);
    return {
      fileName: fileName,
      newFileName: newFileName,
      url: url,
    };
  }

  /**
   * 生成新的文件名
   */
  getNewFileName(originalname: string): string {
    if (!originalname) return originalname;
    const newFileNameArr = originalname.split('.');
    newFileNameArr[newFileNameArr.length - 1] = `${newFileNameArr[newFileNameArr.length - 1]}_${new Date().getTime()}`;
    return newFileNameArr.join('.');
  }

  /**
   * 阿里云 OSS 单文件上传
   */
  async saveFileOss(targetDir: string, file: Express.Multer.File) {
    const originalname = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf8');
    const ext = path.extname(originalname);
    const newFileName = `${GenerateUUID()}_${new Date().getTime()}${ext}`;
    const targetKey = targetDir ? `${targetDir}/${newFileName}` : newFileName;

    await this.getOssClient().put(targetKey, file.buffer, {
      headers: { 'x-oss-object-acl': 'public-read' },
    });

    const url = `${this.config.get('oss.domain')}/${targetKey}`;
    return {
      fileName: targetKey,
      newFileName: newFileName,
      url: url,
    };
  }

  /**
   * 阿里云 OSS 大文件分片上传
   */
  async uploadLargeFileOss(sourceFile: string, targetFile: string, uploadId: string) {
    try {
      await this.getOssClient().multipartUpload(targetFile, sourceFile, {
        parallel: 4,
        partSize: 1024 * 1024 * 5,
        headers: { 'x-oss-object-acl': 'public-read' },
        progress: (p) => {
          if (p === 1) {
            this.sysUploadEntityRep.update({ uploadId }, { status: '0' });
          }
        },
      });
    } catch (error) {
      console.error('阿里云OSS分片上传失败:', error);
    } finally {
      if (fs.existsSync(sourceFile)) {
        fs.unlinkSync(sourceFile);
      }
    }
    return targetFile;
  }

  /**
   * 检查 OSS 资源是否存在
   */
  async ossHeadObject(targetFile: string) {
    try {
      return await this.getOssClient().head(targetFile);
    } catch (error) {
      return error;
    }
  }

  /**
   * 获取 OSS 临时签名 URL
   */
  async getAuthorization(key: string) {
    const url = this.getOssClient().signatureUrl(key, { expires: 60 });
    return ResultData.ok({ sign: url });
  }

  /**
   * 文件管理 - 分页列表
   */
  async findAll(query: ListUploadDto) {
    const entity = this.sysUploadEntityRep.createQueryBuilder('upload');
    entity.where('upload.delFlag = :delFlag', { delFlag: '0' });

    if (query.newFileName) {
      entity.andWhere('upload.newFileName LIKE :name', { name: `%${query.newFileName}%` });
    }
    if (query.fileName) {
      entity.andWhere('upload.fileName LIKE :key', { key: `%${query.fileName}%` });
    }
    if (query.status) {
      entity.andWhere('upload.status = :status', { status: query.status });
    }

    entity.orderBy('upload.createTime', 'DESC');

    if (query.pageSize && query.pageNum) {
      entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    }

    const [list, total] = await entity.getManyAndCount();
    return ResultData.ok({ list, total });
  }

  /**
   * 文件管理 - 单文件详情
   */
  async findOne(uploadId: string) {
    const data = await this.sysUploadEntityRep.findOne({
      where: { uploadId, delFlag: '0' },
    });
    if (!data) {
      return ResultData.fail(500, '文件不存在');
    }
    return ResultData.ok(data);
  }

  /**
   * 文件管理 - 删除单个文件（OSS + DB）
   */
  async remove(uploadId: string) {
    const record = await this.sysUploadEntityRep.findOne({
      where: { uploadId },
    });
    if (!record) {
      return ResultData.fail(500, '文件记录不存在');
    }

    // 从存储介质删除实际文件
    if (this.isLocal) {
      // 本地存储：从磁盘删除文件
      try {
        const rootPath = process.cwd();
        const baseDirPath = path.posix.join(rootPath, this.config.get('app.file.location'));
        const serveRoot = this.config.get('app.file.serveRoot');
        // fileName 格式: /profile/uuid_xxx.jpg，需要去掉 serveRoot 前缀
        const relativePath = record.fileName.replace(serveRoot, '');
        const actualPath = path.posix.join(baseDirPath, relativePath);
        if (fs.existsSync(actualPath)) {
          fs.unlinkSync(actualPath);
        }
      } catch (err) {
        // 文件可能已被删除，忽略
      }
    } else {
      // OSS 存储：从阿里云删除
      try {
        await this.getOssClient().delete(record.fileName);
      } catch (err) {
        // OSS 文件可能已不存在，忽略
      }
    }

    // 软删除 DB 记录
    await this.sysUploadEntityRep.update({ uploadId }, { delFlag: '1' });
    return ResultData.ok(null, '删除成功');
  }

  /**
   * 文件管理 - 批量删除
   */
  async batchRemove(dto: BatchDeleteDto) {
    if (!dto.uploadIds || dto.uploadIds.length === 0) {
      return ResultData.fail(500, '请选择要删除的文件');
    }

    await Promise.all(dto.uploadIds.map((id) => this.remove(id)));

    return ResultData.ok(null, `成功删除 ${dto.uploadIds.length} 个文件`);
  }

  /**
   * 获取分片上传结果
   */
  async getChunkUploadResult(uploadId: string) {
    const data = await this.sysUploadEntityRep.findOne({
      where: { uploadId },
      select: ['status', 'fileName', 'newFileName', 'url'],
    });

    if (data) {
      return ResultData.ok({
        data: data,
        msg: data.status === '0' ? '上传成功' : '上传中',
      });
    } else {
      return ResultData.fail(500, '文件不存在');
    }
  }
}
