import { Module } from '@nestjs/common';
import { ExamplePdfAdapter } from './example-pdf.adapter';

@Module({
  providers: [ExamplePdfAdapter],
  exports: [ExamplePdfAdapter],
})
export class ExamplePdfModule {}
