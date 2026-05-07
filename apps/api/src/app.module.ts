import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';

import { ApiModule } from './api/api.module';
import { AppConfigModule } from './config/config.module';
import { AggregatorModule } from './core/aggregator/aggregator.module';
import { SchedulerModule } from './core/scheduler/scheduler.module';
import { WineModule } from './core/wine/wine.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { HttpModule } from './infrastructure/http/http.module';
import { PdfModule } from './infrastructure/pdf/pdf.module';
import { ScrapingModule } from './infrastructure/scraping/scraping.module';

// Agencies — adding a new one is one import.
import { AboireDeboutModule } from './agencies/a-boire-debout/a-boire-debout.module';
import { LaQvModule } from './agencies/la-qv/la-qv.module';
import { Les2RaisinsModule } from './agencies/les-2-raisins/les-2-raisins.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        ...(process.env.NODE_ENV === 'production'
          ? {}
          : {
              transport: { target: 'pino-pretty', options: { singleLine: true } },
            }),
      },
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    HttpModule,
    PdfModule,
    ScrapingModule,
    WineModule,
    AggregatorModule,
    SchedulerModule,
    ApiModule,

    // Agencies
    AboireDeboutModule,
    LaQvModule,
    Les2RaisinsModule,
  ],
})
export class AppModule {}
