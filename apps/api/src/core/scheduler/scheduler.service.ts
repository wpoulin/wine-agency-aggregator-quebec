import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { AppConfigService } from '../../config/app-config.service';
import { AggregatorService } from '../aggregator/aggregator.service';

@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly registry: SchedulerRegistry,
    private readonly aggregator: AggregatorService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.registerAggregatorCron();
    if (this.config.aggregatorRunOnBoot) {
      this.logger.log('AGGREGATOR_RUN_ON_BOOT=true — kicking off initial run');
      void this.runAndLog();
    }
  }

  private registerAggregatorCron(): void {
    const cron = this.config.aggregatorCron || CronExpression.EVERY_DAY_AT_4AM;
    const job = new CronJob(cron, () => {
      void this.runAndLog();
    });
    this.registry.addCronJob('aggregator', job);
    job.start();
    this.logger.log(`Scheduled aggregator cron: "${cron}"`);
  }

  private async runAndLog(): Promise<void> {
    try {
      const reports = await this.aggregator.runAll();
      this.logger.log(
        `Aggregator run complete: ${reports
          .map((r) => `${r.agencyId}=${r.upserted}/${r.fetched}`)
          .join(' ')}`,
      );
    } catch (err) {
      this.logger.error(
        `Scheduled aggregator run failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
