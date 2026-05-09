import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { parseVintage, parseVolumeMl, stripHtml } from '../../core/normalization';
import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { RestAdapterBase } from '../_contract/base/rest-adapter.base';

interface Term {
  name: string;
  slug: string;
}

interface Taxonomy {
  id?: number;
  name: string;
  slug: string;
}

interface Attribute {
  name: string;
  taxonomy: string;
  terms: Term[];
}

/**
 * Subset of the WooCommerce Store API `/wp-json/wc/store/v1/products` shape
 * that we actually consume. Les 2 Raisins runs vanilla WooCommerce — the
 * Store API ships with the platform and is publicly readable.
 */
export interface Les2RaisinsRaw {
  id: number;
  name: string;
  sku: string;
  permalink: string;
  short_description: string;
  prices: {
    price: string;
    currency_code: string;
    /** Number of decimal places baked into the integer `price` string. */
    currency_minor_unit?: number;
  };
  categories: Taxonomy[];
  tags: Taxonomy[];
  attributes: Attribute[];
  is_in_stock: boolean;
  images: Array<{ src: string }>;
}

const ENDPOINT = 'https://www.les2raisins.com/wp-json/wc/store/v1/products';
const PER_PAGE = 100;

/**
 * The Store API defaults to `stock_status=instock` and silently drops
 * everything else, which on L2R hides ~120 out-of-stock and back-ordered
 * wines that still appear on `/nos-vins/`. Fetch each status explicitly so
 * the catalog matches what's listed on the site; the per-product
 * `is_in_stock` flag still drives the `available` field.
 */
const STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'] as const;

/**
 * Country names L2R uses as top-level WooCommerce categories. Kept in French
 * to align with La QV's existing `country` values (`'Italie'`, `'France'`,
 * etc.) so cross-agency search filters on `country` match across both.
 */
const KNOWN_COUNTRIES = new Set([
  'Italie',
  'France',
  'Espagne',
  'Portugal',
  'USA',
  'Belgique',
  'Allemagne',
  'Autriche',
  'Suisse',
  'Canada',
  'Argentine',
  'Chili',
  'Australie',
  'Afrique du Sud',
]);

/**
 * Map L2R color/category names to canonical `WineColor`. Their "Vins blancs,
 * rosés, orange" bucket lumps three colors into one — we default to White
 * since whites dominate it; refine per-product if a better signal surfaces.
 */
const COLOR_BY_CATEGORY: Record<string, WineColor> = {
  'vins rouges': WineColor.Red,
  'vins blancs, rosés, orange': WineColor.White,
  'vins blancs': WineColor.White,
  'vins rosés': WineColor.Rose,
  'vins orange': WineColor.Orange,
  'vins effervescents': WineColor.Sparkling,
  mousseux: WineColor.Sparkling,
  champagne: WineColor.Sparkling,
  'spiritueux, vins de dessert': WineColor.Dessert,
  'vins de dessert': WineColor.Dessert,
  spiritueux: WineColor.Other,
};

@Injectable()
@Agency()
export class Les2RaisinsAdapter extends RestAdapterBase<Les2RaisinsRaw> {
  readonly id = 'les-2-raisins';
  readonly displayName = 'Les 2 Raisins';

  async fetch(ctx: FetchContext): Promise<Les2RaisinsRaw[]> {
    const seen = new Set<number>();
    const all: Les2RaisinsRaw[] = [];
    for (const status of STOCK_STATUSES) {
      for (let page = 1; ; page++) {
        if (ctx.signal.aborted) {
          ctx.logger.warn('Les2Raisins fetch aborted via signal');
          return all;
        }
        const url = `${ENDPOINT}?per_page=${PER_PAGE}&page=${page}&stock_status=${status}`;
        const batch = await this.http.json<Les2RaisinsRaw[]>(url);
        for (const p of batch) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            all.push(p);
          }
        }
        if (batch.length < PER_PAGE) break;
      }
    }
    return all;
  }

  normalize(raw: Les2RaisinsRaw): NormalizedWine {
    const description = stripHtml(raw.short_description);
    const country = pickCountry(raw.categories);
    const color = pickColor(raw.categories);
    const producer = pickProducer(raw.tags, raw.name);
    const vintage = pickVintage(raw.attributes, raw.name);
    const { region, appellation } = parseRegionAndAppellation(description, country);
    const grapes = parseGrapes(description);
    const price = parsePrice(raw.prices);

    return {
      agencyId: this.id,
      agencySku: raw.sku?.trim() || String(raw.id),
      name: raw.name.trim(),
      producer,
      vintage,
      color,
      country,
      region,
      appellation,
      grapes,
      volumeMl: parseVolumeMl(raw.name) ?? (/\bmagnum\b/i.test(raw.name) ? 1500 : 750),
      // L2R doesn't publish ABV in `short_description` — the parenthetical
      // grape percentages (e.g. "Sangiovese (100%)") would false-positive a
      // generic %-regex, so we skip the parse rather than risk junk data.
      alcoholPct: null,
      price,
      available: raw.is_in_stock === true,
      sourceUrl: raw.permalink || null,
      imageUrl: raw.images[0]?.src ?? null,
      raw: {
        categorySlugs: raw.categories.map((c) => c.slug),
        tagSlugs: raw.tags.map((t) => t.slug),
      },
    };
  }
}

function pickCountry(categories: Taxonomy[]): string | null {
  for (const cat of categories) {
    const name = cat.name?.trim();
    if (name && KNOWN_COUNTRIES.has(name)) return name;
  }
  return null;
}

function pickColor(categories: Taxonomy[]): WineColor {
  for (const cat of categories) {
    const key = cat.name?.trim().toLowerCase();
    const hit = key ? COLOR_BY_CATEGORY[key] : undefined;
    if (hit) return hit;
  }
  return WineColor.Other;
}

/**
 * L2R tags producers (e.g. `Querce Bettina`, `Lucie Thiéblemont`) alongside
 * generic descriptors (`Brunello`, `Grand format`). The producer tag is
 * almost always a substring of the product title, so we prefer the longest
 * tag whose name appears in the title and fall back to null when nothing
 * matches — better to miss a producer than mislabel one as `Brunello`.
 */
function pickProducer(tags: Taxonomy[], title: string): string | null {
  const lower = title.toLowerCase();
  const hits = tags
    .map((t) => t.name?.trim() ?? '')
    .filter((name) => name.length > 0 && lower.includes(name.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  return hits[0] ?? null;
}

function pickVintage(attributes: Attribute[], title: string): number | null {
  const attr = attributes.find((a) => a.taxonomy === 'pa_vintage');
  const term = attr?.terms[0]?.name;
  if (term) {
    const n = Number.parseInt(term, 10);
    if (Number.isFinite(n) && n >= 1800 && n <= 2100) return n;
  }
  return parseVintage(title);
}

/**
 * Best-effort region/appellation parser. L2R writes `short_description` as a
 * sequence of `<p>` paragraphs — after `stripHtml` we have one line per
 * paragraph. Typical shapes:
 *   "Italie, Toscane"
 *   "Rosso di Toscana IGT"
 *   "France, Bourgogne (département de l'Yonne)"
 *   "AOC Chablis Premier Cru"
 *
 * Region: scan lines for one starting with the recognized country and a
 * comma, take what follows on the same line.
 * Appellation: scan lines for the first `AOC|IGP|IGT|DOC(G)|AOP|AVA|...`
 * keyword and return the keyword (stripped of trailing punctuation). The
 * keyword alone is enough to filter on; richer parsing can come later.
 */
function parseRegionAndAppellation(
  description: string,
  country: string | null,
): { region: string | null; appellation: string | null } {
  if (!description) return { region: null, appellation: null };
  const lines = description
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let region: string | null = null;
  if (country) {
    const re = new RegExp(`${escapeRe(country)}\\s*,\\s*(.+)`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m?.[1]) {
        region = cleanText(m[1]);
        break;
      }
    }
  }

  let appellation: string | null = null;
  for (const line of lines) {
    const m = line.match(/\b(AOC|AOP|AVA|DOCG?|IGT|IGP|VDP|VDQS)\b/i);
    if (m) {
      appellation = m[0].toUpperCase();
      break;
    }
  }

  return { region, appellation };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanText(s: string): string | null {
  const trimmed = s
    .replace(/\s+/g, ' ')
    .replace(/[,.;]+$/, '')
    .trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse the `Cépage(s):` line of the product description into a lowercased,
 * percentage-stripped grape list. Lowercasing matches La QV's convention
 * (`['sangiovese', 'montepulciano']`) so cross-agency grape filters work.
 */
function parseGrapes(description: string): string[] {
  if (!description) return [];
  const m = description.match(/c[ée]page[s]?\s*:\s*([^.\n]+)/i);
  const list = m?.[1];
  if (!list) return [];
  return list
    .split(/[,;/&]|\bet\b/i)
    .map((g) =>
      g
        // Drop any parenthetical annotation: "(100%)", "(Magnum)", etc.
        .replace(/\([^)]*\)/g, '')
        // Drop bare percentage suffixes/prefixes: "60%", "100 %", "100%".
        .replace(/\d+\s*%/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase(),
    )
    .filter((g) => g.length > 0);
}

/**
 * Convert the Store API's integer-minor-unit price string (e.g. `"3425"`
 * with `currency_minor_unit: 2` → 34.25) into a major-unit decimal number.
 * Returns null only if the value or currency cannot be parsed.
 */
function parsePrice(prices: Les2RaisinsRaw['prices']): NormalizedWine['price'] {
  const minorUnit = prices.currency_minor_unit ?? 2;
  const raw = Number.parseInt(prices.price, 10);
  if (!Number.isFinite(raw)) return null;
  const amount = raw / 10 ** minorUnit;
  const currency = prices.currency_code as 'CAD' | 'USD' | 'EUR';
  if (currency !== 'CAD' && currency !== 'USD' && currency !== 'EUR') return null;
  return { amount, currency };
}
