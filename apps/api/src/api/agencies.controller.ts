import { Controller, Get } from '@nestjs/common';
import type { AgencySummary } from '@wine/types';

import { AggregatorService } from '../core/aggregator/aggregator.service';

@Controller('agencies')
export class AgenciesController {
  constructor(private readonly aggregator: AggregatorService) {}

  @Get()
  list(): AgencySummary[] {
    return this.aggregator.list().map((a) => ({
      id: a.id,
      displayName: a.displayName,
      sourceType: a.sourceType,
    }));
  }
}
