import { Module } from '@nestjs/common';
import { ExampleRestAdapter } from './example-rest.adapter';

@Module({
  providers: [ExampleRestAdapter],
  exports: [ExampleRestAdapter],
})
export class ExampleRestModule {}
