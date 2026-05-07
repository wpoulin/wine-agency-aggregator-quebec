import { Module } from '@nestjs/common';
import { AboireDeboutAdapter } from './a-boire-debout.adapter';

@Module({
  providers: [AboireDeboutAdapter],
  exports: [AboireDeboutAdapter],
})
export class AboireDeboutModule {}
