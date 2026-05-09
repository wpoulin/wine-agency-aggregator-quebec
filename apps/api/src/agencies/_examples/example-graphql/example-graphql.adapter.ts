import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../../_contract/agency.decorator';
import type { FetchContext } from '../../_contract/agency-adapter.interface';
import { GraphqlAdapterBase } from '../../_contract/base/graphql-adapter.base';

interface GqlWine {
  id: string;
  name: string;
  vintage: number | null;
  color: string;
  priceCad: number | null;
}

@Injectable()
@Agency()
export class ExampleGraphqlAdapter extends GraphqlAdapterBase<GqlWine> {
  readonly id = 'example-graphql';
  readonly displayName = 'Example GraphQL Agency';

  protected readonly endpoint = 'https://example.invalid/graphql';

  async fetch(_ctx: FetchContext): Promise<GqlWine[]> {
    const data = await this.query<{ wines: GqlWine[] }>(
      'query AllWines { wines { id name vintage color priceCad } }',
    );
    return data.wines;
  }

  normalize(raw: GqlWine): NormalizedWine {
    return {
      agencyId: this.id,
      agencySku: raw.id,
      name: raw.name,
      producer: null,
      vintage: raw.vintage,
      color: raw.color === 'RED' ? WineColor.Red : WineColor.Other,
      country: null,
      region: null,
      appellation: null,
      grapes: [],
      volumeMl: 750,
      alcoholPct: null,
      price: raw.priceCad != null ? { amount: raw.priceCad, currency: 'CAD' } : null,
      available: true,
      sourceUrl: null,
      imageUrl: null,
    };
  }
}
