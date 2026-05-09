import { Injectable } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

import { type WineFilter, WineRepository } from './wine.repository';

@Injectable()
export class WineService {
  constructor(private readonly repo: WineRepository) {}

  upsert(w: NormalizedWine) {
    return this.repo.upsert(w);
  }

  list(filter: WineFilter) {
    return this.repo.findMany(filter);
  }

  get(id: string) {
    return this.repo.findById(id);
  }
}
