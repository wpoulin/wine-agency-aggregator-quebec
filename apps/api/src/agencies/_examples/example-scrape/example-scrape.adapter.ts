import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../../_contract/agency.decorator';
import type { FetchContext } from '../../_contract/agency-adapter.interface';
import { ScrapeAdapterBase } from '../../_contract/base/scrape-adapter.base';
import { HttpService } from '../../../infrastructure/http/http.service';
import { ScrapingService } from '../../../infrastructure/scraping/scraping.service';
import { normalizeColor, parsePriceAmount, parseVintage } from '../../../core/normalization';

interface ScrapedRow {
  href: string;
  name: string;
  priceRaw: string;
  colorRaw: string;
}

@Injectable()
@Agency()
export class ExampleScrapeAdapter extends ScrapeAdapterBase<ScrapedRow> {
  readonly id = 'example-scrape';
  readonly displayName = 'Example HTML-scrape Agency';

  private readonly listingUrl = 'https://example.invalid/wines';

  constructor(http: HttpService, scraper: ScrapingService) {
    super(http, scraper);
  }

  async fetch(_ctx: FetchContext): Promise<ScrapedRow[]> {
    const html = await this.http.text(this.listingUrl);
    const $ = this.scraper.load(html);
    return $('.wine-card')
      .map((_, el) => {
        const name = $(el).find('.name').text().trim();
        const href = $(el).find('a').attr('href') ?? '';
        const priceRaw = $(el).find('.price').text().trim();
        const colorRaw = $(el).attr('data-color') ?? '';
        return { name, href, priceRaw, colorRaw } satisfies ScrapedRow;
      })
      .get();
  }

  normalize(raw: ScrapedRow): NormalizedWine {
    const sku = raw.href.split('/').filter(Boolean).pop() ?? raw.name;
    return {
      agencyId: this.id,
      agencySku: sku,
      name: raw.name,
      producer: null,
      vintage: parseVintage(raw.name),
      color: normalizeColor(raw.colorRaw) ?? WineColor.Other,
      country: null,
      region: null,
      appellation: null,
      grapes: [],
      volumeMl: 750,
      alcoholPct: null,
      price:
        parsePriceAmount(raw.priceRaw) != null
          ? { amount: parsePriceAmount(raw.priceRaw)!, currency: 'CAD' }
          : null,
      available: true,
      sourceUrl: raw.href ? new URL(raw.href, this.listingUrl).toString() : null,
      imageUrl: null,
    };
  }
}
