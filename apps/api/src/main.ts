import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  app.enableShutdownHooks();
  app.setGlobalPrefix('', { exclude: ['health'] });

  await app.listen(config.port);
  app.get(Logger).log(`API listening on http://localhost:${config.port}`, 'Bootstrap');
}

void bootstrap();
