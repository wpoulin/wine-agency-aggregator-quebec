import { Module } from '@nestjs/common';
import { NobleSelectionAdapter } from './noble-selection.adapter';

@Module({
  providers: [NobleSelectionAdapter],
  exports: [NobleSelectionAdapter],
})
export class NobleSelectionModule {}
