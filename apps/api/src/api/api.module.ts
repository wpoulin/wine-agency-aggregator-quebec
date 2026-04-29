import { Module } from '@nestjs/common';

import { AggregatorModule } from '../core/aggregator/aggregator.module';
import { WineModule } from '../core/wine/wine.module';
import { AgenciesController } from './agencies.controller';
import { HealthController } from './health.controller';
import { WinesController } from './wines.controller';

@Module({
  imports: [WineModule, AggregatorModule],
  controllers: [HealthController, AgenciesController, WinesController],
})
export class ApiModule {}
