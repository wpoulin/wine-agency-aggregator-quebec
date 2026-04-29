import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { ScrapeAdapterBase } from '../_contract/base/scrape-adapter.base';
import { HttpService } from '../../infrastructure/http/http.service';
import { ScrapingService } from '../../infrastructure/scraping/scraping.service';
import {
  normalizeColor,
  parseAlcoholPct,
  parsePriceAmount,
  parseVintage,
  parseVolumeMl,
} from '../../core/normalization';

/**
 * Raw record shape captured from saq.com listing pages.
 *
 * NOTE: The actual SAQ listing surface mixes a public catalog at
 *   https://www.saq.com/en/products/wine
 * with an Algolia-backed search API. The simplest stable starting point is to
 * scrape the listing pages and follow product links. When you wire this up for
 * real, replace `fetch()` below — the rest of the contract stays the same.
 */
export interface SaqRaw {
  sku: string;
  url: string;
  name: string;
  producer: string | null;
  vintage: string | null;
  colorRaw: string;
  countryRaw: string | null;
  regionRaw: string | null;
  volumeRaw: string | null;
  alcoholRaw: string | null;
  priceRaw: string | null;
  imageUrl: string | null;
}

@Injectable()
@Agency()
export class SaqAdapter extends ScrapeAdapterBase<SaqRaw> {
  readonly id = 'saq';
  readonly displayName = 'SAQ';

  constructor(http: HttpService, scraper: ScrapingService) {
    super(http, scraper);
  }

  // biome-ignore lint/suspicious/useAwait: stub will become async when implemented
  async fetch(ctx: FetchContext): Promise<SaqRaw[]> {
    ctx.logger.warn(
      'SaqAdapter.fetch() is a stub. Implement listing scrape or Algolia API call before relying on this run.',
    );
    return [];
  }

  normalize(raw: SaqRaw): NormalizedWine {
    return {
      agencyId: this.id,
      agencySku: raw.sku,
      name: raw.name,
      producer: raw.producer,
      vintage: parseVintage(raw.vintage ?? raw.name),
      color: normalizeColor(raw.colorRaw) ?? WineColor.Other,
      country: raw.countryRaw,
      region: raw.regionRaw,
      appellation: null,
      grapes: [],
      volumeMl: parseVolumeMl(raw.volumeRaw),
      alcoholPct: parseAlcoholPct(raw.alcoholRaw),
      price:
        parsePriceAmount(raw.priceRaw) != null
          ? { amount: parsePriceAmount(raw.priceRaw)!, currency: 'CAD' }
          : null,
      available: true,
      sourceUrl: raw.url,
      imageUrl: raw.imageUrl,
    };
  }
}
