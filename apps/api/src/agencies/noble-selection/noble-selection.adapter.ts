import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';
import type { CheerioAPI } from 'cheerio';

import {
  normalizeColor,
  parseAlcoholPct,
  parsePriceAmount,
  parseVintage,
  parseVolumeMl,
} from '../../core/normalization';
import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { ScrapeAdapterBase } from '../_contract/base/scrape-adapter.base';

const ORIGIN = 'https://nobleselection.kork.ca';
// `nature[]=9` → wine, `listing[]=16` → IP (Importation Privée — excludes
// SAQ-listed wines, which already live in the SAQ catalog and would
// otherwise duplicate), `status[]=1` → Disponible.
const LISTING_BASE = `${ORIGIN}/qc/fr/?search=&nature%5B%5D=9&listing%5B%5D=16&status%5B%5D=1&total=`;
// Bound pagination. Noble Sélection's IP catalog is ~50 wines across two
// pages today; 30 pages is well past anything plausible. Hitting this means
// pagination is broken and we'd rather stop than spin forever.
const MAX_PAGES = 30;

/**
 * Two-stage record: listing pages give us most of `NormalizedWine`, and the
 * detail page fills in `appellation`, `grapes`, `alcoholPct`, plus confirms
 * `color` and `country`/`region`. Detail fields stay `null` if enrichment
 * fails so a single broken page doesn't drop the wine from the catalog.
 */
export interface NobleSelectionRaw {
  // From listing card
  cspc: string;
  name: string;
  brand: string | null;
  priceRaw: string;
  path: string;
  imageSrc: string | null;
  listingHeading: string | null;
  countryFromList: string | null;
  regionFromList: string | null;
  sizeRaw: string | null;
  // From detail page (best-effort)
  detailCountry: string | null;
  detailRegion: string | null;
  detailAppellation: string | null;
  detailColor: string | null;
  detailGrapes: string | null;
  detailAlcohol: string | null;
  detailVolume: string | null;
  detailStatus: string | null;
}

@Injectable()
@Agency()
export class NobleSelectionAdapter extends ScrapeAdapterBase<NobleSelectionRaw> {
  readonly id = 'noble-selection';
  readonly displayName = 'Noble Sélection';

  async fetch(ctx: FetchContext): Promise<NobleSelectionRaw[]> {
    const cards = await this.fetchListing(ctx);
    for (const card of cards) {
      if (ctx.signal.aborted) {
        ctx.logger.warn('NobleSelection enrichment aborted via signal');
        break;
      }
      try {
        const detail = await this.fetchDetail(card.path);
        Object.assign(card, detail);
      } catch (err) {
        ctx.logger.warn(
          `NobleSelection detail fetch failed for ${card.path}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return cards;
  }

  private async fetchListing(ctx: FetchContext): Promise<NobleSelectionRaw[]> {
    // Page-size doesn't reliably signal the last page: page 1 of the IP
    // catalog returns 24 cards today even though page 2 still has more. Walk
    // until an empty page and dedupe by CSPC — page 2 also occasionally
    // repeats the same card twice within itself.
    const seen = new Set<string>();
    const all: NobleSelectionRaw[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (ctx.signal.aborted) {
        ctx.logger.warn('NobleSelection listing aborted via signal');
        return all;
      }
      const html = await this.http.text(`${LISTING_BASE}&p=${page}`);
      const cards = parseListing(this.scraper.load(html));
      if (cards.length === 0) return all;
      for (const card of cards) {
        if (seen.has(card.cspc)) continue;
        seen.add(card.cspc);
        all.push(card);
      }
    }
    ctx.logger.warn(`NobleSelection listing hit MAX_PAGES (${MAX_PAGES}) — stopping`);
    return all;
  }

  private async fetchDetail(path: string): Promise<Partial<NobleSelectionRaw>> {
    const html = await this.http.text(`${ORIGIN}${path}`);
    return parseDetail(this.scraper.load(html));
  }

  normalize(raw: NobleSelectionRaw): NormalizedWine {
    const vintage = parseVintage(raw.listingHeading) ?? parseVintageFromPath(raw.path);
    const color = raw.detailColor ? normalizeColor(raw.detailColor) : WineColor.Other;
    const priceAmount = parsePriceAmount(raw.priceRaw);
    return {
      agencyId: this.id,
      agencySku: raw.cspc,
      name: raw.name,
      producer: raw.brand,
      vintage,
      color,
      country: raw.detailCountry ?? raw.countryFromList,
      region: raw.detailRegion ?? raw.regionFromList,
      appellation: raw.detailAppellation,
      grapes: parseGrapesList(raw.detailGrapes),
      volumeMl: parseBottleMl(raw.detailVolume) ?? parseBottleMl(raw.sizeRaw),
      alcoholPct: parseAlcoholPct(raw.detailAlcohol),
      price: priceAmount != null ? { amount: priceAmount, currency: 'CAD' } : null,
      available: raw.detailStatus ? raw.detailStatus.toLowerCase().startsWith('disponible') : true,
      sourceUrl: `${ORIGIN}${raw.path}`,
      imageUrl: raw.imageSrc,
      raw: { status: raw.detailStatus ?? null },
    };
  }
}

function parseListing($: CheerioAPI): NobleSelectionRaw[] {
  const out: NobleSelectionRaw[] = [];
  $('li.js-infowine').each((_, el) => {
    const $el = $(el);
    const cspc = $el.attr('data-cspc')?.trim() ?? '';
    const path = $el.attr('data-url')?.trim() ?? '';
    if (!cspc || !path) return;
    const infos = $el
      .find('.more .infos li')
      .map((_, li) => $(li).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);
    out.push({
      cspc,
      name: $el.attr('data-name')?.trim() ?? '',
      brand: $el.attr('data-brand')?.trim() || null,
      priceRaw: $el.attr('data-price')?.trim() ?? '',
      path,
      imageSrc: $el.find('.main .img img').attr('src')?.trim() ?? null,
      listingHeading: $el.find('.main h4').first().text().replace(/\s+/g, ' ').trim() || null,
      countryFromList: infos[0] ?? null,
      regionFromList: infos[1] ?? null,
      sizeRaw: $el.find('.more .size').first().text().replace(/\s+/g, ' ').trim() || null,
      detailCountry: null,
      detailRegion: null,
      detailAppellation: null,
      detailColor: null,
      detailGrapes: null,
      detailAlcohol: null,
      detailVolume: null,
      detailStatus: null,
    });
  });
  return out;
}

/**
 * Detail pages render each spec as a `.row-table` block with a `<span class="txt">LABEL</span>`
 * paired with a `<strong>VALUE</strong>`. Labels are stable French strings; we
 * index them and pluck the ones we care about. Unknown labels are ignored so
 * the page can grow new fields without breaking us.
 */
function parseDetail($: CheerioAPI): Partial<NobleSelectionRaw> {
  const fields: Record<string, string> = {};
  $('.fiche .row-table').each((_, el) => {
    const $el = $(el);
    const label = $el.find('.txt').first().text().replace(/\s+/g, ' ').trim();
    const value = $el.find('.content strong').first().text().replace(/\s+/g, ' ').trim();
    if (label && value && !(label in fields)) fields[label] = value;
  });
  return {
    detailCountry: fields.Pays ?? null,
    detailRegion: fields['Région'] ?? null,
    detailAppellation: fields.Appellation ?? null,
    detailColor: fields.Couleur ?? null,
    detailGrapes: fields['Cépage(s)'] ?? null,
    detailAlcohol: fields["Pourcentage d'alcool"] ?? null,
    detailVolume: fields.Conditionnement ?? null,
    detailStatus: fields.Statut ?? null,
  };
}

/**
 * Product paths look like `/qc/fr/nos-domaines/<producer>/<wine>/<vintage>/<cspc>`.
 * Vintage sits at index -2; treat it as authoritative when the listing heading
 * has no recognizable year.
 */
function parseVintageFromPath(path: string): number | null {
  const parts = path.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return parseVintage(parts[parts.length - 2] ?? null);
}

/**
 * Cépage strings are comma-separated, occasionally with parenthetical
 * percentages (`Cabernet Sauvignon (60%), Merlot`). Lowercase to match
 * cross-agency grape filtering (À Boire Debout, La QV, Les 2 Raisins).
 */
function parseGrapesList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;/&]|\bet\b/i)
    .map((g) =>
      g
        .replace(/\([^)]*\)/g, '')
        .replace(/\d+\s*%/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter((g) => g.length > 0);
}

/**
 * Format strings carry the case count and bottle size: `"6 x 750ml"` (detail
 * page) or the unit-less `"6 x 750"` (listing card). Keep only the part after
 * the `x` and append a unit when missing so `parseVolumeMl` can match.
 */
function parseBottleMl(format: string | null): number | null {
  if (!format) return null;
  const tail = format.includes('x') ? format.slice(format.lastIndexOf('x') + 1) : format;
  const trimmed = tail.trim();
  if (!trimmed) return null;
  const withUnit = /[a-z]/i.test(trimmed) ? trimmed : `${trimmed}ml`;
  return parseVolumeMl(withUnit);
}
