import { Module } from '@nestjs/common';
import { ExampleGraphqlAdapter } from './example-graphql.adapter';

@Module({
  providers: [ExampleGraphqlAdapter],
  exports: [ExampleGraphqlAdapter],
})
export class ExampleGraphqlModule {}
