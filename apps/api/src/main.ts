import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { MulterExceptionFilter } from './common/upload/multer-exception.filter';

async function bootstrap() {
  // Multer's diskStorage needs these to already exist - it doesn't create them.
  for (const dir of ['products', 'tickets', 'product-version-icons']) {
    mkdirSync(join(process.cwd(), 'uploads', dir), { recursive: true });
  }
  // Deliberately NOT under uploads/ (see file-upload.options.ts) - product
  // deliverables must only be reachable through the license-gated download
  // endpoint, never a public static path. Same reasoning for app-version installers.
  mkdirSync(join(process.cwd(), 'product-files'), { recursive: true });
  mkdirSync(join(process.cwd(), 'product-version-files'), { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const configService = app.get(ConfigService);

  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new MulterExceptionFilter());

  const port = Number(configService.get<string>('PORT', '3000'));
  const host = configService.get<string>('HOST', '127.0.0.1');
  await app.listen(port, host);
}
bootstrap();
