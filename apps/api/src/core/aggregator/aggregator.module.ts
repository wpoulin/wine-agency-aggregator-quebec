import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { WineModule } from '../wine/wine.module';
import { AggregatorController } from './aggregator.controller';
import { AggregatorService } from './aggregator.service';

@Module({
  imports: [DiscoveryModule, WineModule],
  controllers: [AggregatorController],
  providers: [AggregatorService],
  exports: [AggregatorService],
})
export class AggregatorModule {}
