import { Module } from '@nestjs/common';
import { ExampleScrapeAdapter } from './example-scrape.adapter';

@Module({
  providers: [ExampleScrapeAdapter],
  exports: [ExampleScrapeAdapter],
})
export class ExampleScrapeModule {}
