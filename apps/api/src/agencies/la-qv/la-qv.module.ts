import { Module } from '@nestjs/common';
import { LaQvAdapter } from './la-qv.adapter';

@Module({
  providers: [LaQvAdapter],
  exports: [LaQvAdapter],
})
export class LaQvModule {}
