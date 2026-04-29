import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../../_contract/agency.decorator';
import type { FetchContext } from '../../_contract/agency-adapter.interface';
import { RestAdapterBase } from '../../_contract/base/rest-adapter.base';
import { HttpService } from '../../../infrastructure/http/http.service';

interface ExampleRestRaw {
  sku: string;
  title: string;
  producer?: string;
  vintage?: number;
  color: string;
  price?: number;
}

/**
 * Template adapter for REST-backed agencies. Copy this folder, rename, and
 * replace `endpoint`, the raw shape, and the `normalize()` mapping.
 *
 * Disabled by default — not registered in app.module.ts.
 */
@Injectable()
@Agency()
export class ExampleRestAdapter extends RestAdapterBase<ExampleRestRaw> {
  readonly id = 'example-rest';
  readonly displayName = 'Example REST Agency';

  private readonly endpoint = 'https://example.invalid/api/wines';

  constructor(http: HttpService) {
    super(http);
  }

  async fetch(_ctx: FetchContext): Promise<ExampleRestRaw[]> {
    return this.http.json<ExampleRestRaw[]>(this.endpoint);
  }

  normalize(raw: ExampleRestRaw): NormalizedWine {
    return {
      agencyId: this.id,
      agencySku: raw.sku,
      name: raw.title,
      producer: raw.producer ?? null,
      vintage: raw.vintage ?? null,
      color: raw.color === 'red' ? WineColor.Red : WineColor.Other,
      country: null,
      region: null,
      appellation: null,
      grapes: [],
      volumeMl: 750,
      alcoholPct: null,
      price: raw.price != null ? { amount: raw.price, currency: 'CAD' } : null,
      available: true,
      sourceUrl: null,
      imageUrl: null,
    };
  }
}
