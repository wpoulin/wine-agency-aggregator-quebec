import { Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { AggregatorService } from './aggregator.service';

@Controller('aggregator')
export class AggregatorController {
  constructor(private readonly aggregator: AggregatorService) {}

  @Post('run')
  async runAll() {
    return this.aggregator.runAll();
  }

  @Post('run/:agencyId')
  async runOne(@Param('agencyId') agencyId: string) {
    if (!this.aggregator.get(agencyId)) {
      throw new NotFoundException(`Unknown agency: ${agencyId}`);
    }
    return this.aggregator.runOne(agencyId);
  }
}
