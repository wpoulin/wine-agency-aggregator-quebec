import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get nodeEnv(): Env['NODE_ENV'] {
    return this.config.get('NODE_ENV', { infer: true });
  }

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get databaseUrl(): string {
    return this.config.get('DATABASE_URL', { infer: true });
  }

  get aggregatorCron(): string {
    return this.config.get('AGGREGATOR_CRON', { infer: true });
  }

  get aggregatorRunOnBoot(): boolean {
    return this.config.get('AGGREGATOR_RUN_ON_BOOT', { infer: true });
  }
}
