import { Module } from '@nestjs/common';
import { WineRepository } from './wine.repository';
import { WineService } from './wine.service';

@Module({
  providers: [WineRepository, WineService],
  exports: [WineService],
})
export class WineModule {}
