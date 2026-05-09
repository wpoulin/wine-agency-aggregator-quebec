import { Inject } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

import { HttpService } from '../../../infrastructure/http/http.service';
import { ScrapingService } from '../../../infrastructure/scraping/scraping.service';
import type { AgencyAdapter, AgencySourceType, FetchContext } from '../agency-adapter.interface';

/**
 * Base for HTML-scraping adapters. Subclasses fetch one or more pages via
 * HttpService and use `this.scraper.load(html)` to parse with cheerio.
 * Dependencies are property-injected so subclasses don't need a constructor.
 */
export abstract class ScrapeAdapterBase<Raw> implements AgencyAdapter<Raw> {
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly sourceType: AgencySourceType = 'scrape';

  @Inject(HttpService) protected readonly http!: HttpService;
  @Inject(ScrapingService) protected readonly scraper!: ScrapingService;

  abstract fetch(ctx: FetchContext): Promise<Raw[]>;
  abstract normalize(raw: Raw): NormalizedWine;
}
