import { Module } from '@nestjs/common';
import { SaqAdapter } from './saq.adapter';

@Module({
  providers: [SaqAdapter],
  exports: [SaqAdapter],
})
export class SaqModule {}
