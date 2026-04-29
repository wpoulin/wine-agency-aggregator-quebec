import { Module } from '@nestjs/common';
import { AggregatorModule } from '../aggregator/aggregator.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [AggregatorModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
