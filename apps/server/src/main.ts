import 'dotenv/config';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mw as requestIpMw } from 'request-ip';
import path from 'path';
import { writeFileSync } from 'fs';
import { AppModule } from 'src/app.module';
import { HttpExceptionsFilter } from 'src/common/filters/http-exceptions-filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: true,
  });
  const config = app.get(ConfigService);

  app.set('trust proxy', 1);
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
    }),
  );

  const prefix = config.get<string>('app.prefix') || '';
  const rootPath = process.cwd();
  const baseDirPath = path.posix.join(rootPath, config.get('app.file.location'));
  const serveRoot = config.get<string>('app.file.serveRoot') || '/upload';

  app.useStaticAssets(baseDirPath, {
    prefix: serveRoot,
    maxAge: 86400000 * 365,
  });

  app.useStaticAssets('public', {
    prefix: '/public/',
    maxAge: 0,
  });

  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionsFilter());

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  const swaggerOptions = new DocumentBuilder()
    .setTitle('Nest-Admin')
    .setDescription('Nest-Admin 接口文档')
    .setVersion('2.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        name: 'Authorization',
        description: '请在请求头中携带 JWT 令牌，格式：Bearer <token>',
      },
      'Authorization',
    )
    .addServer(config.get<string>('app.file.domain'))
    .build();

  const document = SwaggerModule.createDocument(app, swaggerOptions);
  writeFileSync(path.posix.join(process.cwd(), 'public', 'openApi.json'), JSON.stringify(document, null, 2));

  SwaggerModule.setup(`${prefix}/swagger-ui`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
    customSiteTitle: 'Nest-Admin API Docs',
  });

  app.use(requestIpMw({ attributeName: 'ip' }));

  const port = config.get<number>('app.port') || 8080;
  await app.listen(port);

  console.log('Nest-Admin 服务启动成功');
  console.log('服务地址', `http://localhost:${port}${prefix}/`);
  console.log('Swagger 文档地址', `http://localhost:${port}${prefix}/swagger-ui/`);
}

bootstrap();
