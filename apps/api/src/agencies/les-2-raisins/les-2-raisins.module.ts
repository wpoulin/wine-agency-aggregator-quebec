import { Module } from '@nestjs/common';
import { Les2RaisinsAdapter } from './les-2-raisins.adapter';

@Module({
  providers: [Les2RaisinsAdapter],
  exports: [Les2RaisinsAdapter],
})
export class Les2RaisinsModule {}
