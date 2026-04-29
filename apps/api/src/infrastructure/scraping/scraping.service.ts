import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

@Injectable()
export class ScrapingService {
  /** Parse an HTML string and return a cheerio API. */
  load(html: string): cheerio.CheerioAPI {
    return cheerio.load(html);
  }

  /**
   * Convenience helper: extract trimmed text for every match of `selector`.
   */
  textAll($: cheerio.CheerioAPI, selector: string): string[] {
    return $(selector)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
  }
}
