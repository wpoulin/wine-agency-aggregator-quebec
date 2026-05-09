import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { normalizeColor, parseVintage, parseVolumeMl, stripHtml } from '../../core/normalization';
import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { RestAdapterBase } from '../_contract/base/rest-adapter.base';

/**
 * Subset of the Shopify products.json shape we consume. À Boire Debout is a
 * vanilla Shopify storefront — `<collection>/products.json` is publicly
 * readable and returns up to 250 products per page with no auth.
 */
export interface AboireDeboutRaw {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  body_html: string;
  tags: string[];
  variants: Array<{
    sku: string | null;
    price: string;
    available: boolean;
  }>;
  images: Array<{ src: string }>;
}

const STORE_ORIGIN = 'https://aboiredebout.com';
const COLLECTION_URL = `${STORE_ORIGIN}/collections/v2/products.json`;
const PER_PAGE = 250;
// Bound the pagination loop. 10 × 250 = 2.5k products, well above À Boire
// Debout's real catalog; if we ever hit this, pagination is broken and we'd
// rather stop than spin forever.
const MAX_PAGES = 10;

/**
 * The /v2 collection mixes wine with cider/calvados/liqueur/vermouth/hydromel.
 * `product_type` is the only reliable discriminator (the `vin` tag is
 * inconsistent — two wines lack it). Skip these and let the canonical
 * "wine" catalog stay wine-only.
 */
const NON_WINE_PRODUCT_TYPES = new Set(['Calvados', 'Cidre', 'Hydromel', 'Liqueur', 'Vermouth']);

@Injectable()
@Agency()
export class AboireDeboutAdapter extends RestAdapterBase<AboireDeboutRaw> {
  readonly id = 'a-boire-debout';
  readonly displayName = 'À Boire Debout';

  async fetch(ctx: FetchContext): Promise<AboireDeboutRaw[]> {
    const all: AboireDeboutRaw[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (ctx.signal.aborted) {
        ctx.logger.warn('AboireDebout fetch aborted via signal');
        return all;
      }
      const url = `${COLLECTION_URL}?limit=${PER_PAGE}&page=${page}`;
      const batch = await this.http.json<{ products: AboireDeboutRaw[] }>(url);
      const products = batch.products ?? [];
      all.push(...products);
      if (products.length < PER_PAGE) return all;
    }
    ctx.logger.warn(`AboireDebout pagination hit MAX_PAGES (${MAX_PAGES}) — stopping`);
    return all;
  }

  normalize(raw: AboireDeboutRaw): NormalizedWine {
    // The /v2 collection mixes wine with cider/calvados/liqueur/vermouth/
    // hydromel. Throw rather than pre-filter at fetch so the aggregator's
    // skip counter (and aggregation_runs row) reflects what was dropped.
    if (NON_WINE_PRODUCT_TYPES.has(raw.product_type)) {
      throw new Error(`non-wine product_type: ${raw.product_type}`);
    }

    const tags = parseTags(raw.tags);
    const body = parseBodyHtml(raw.body_html);
    const { name, vintage } = parseTitle(raw.title);
    const variant = raw.variants[0];

    return {
      agencyId: this.id,
      agencySku: variant?.sku?.trim() || String(raw.id),
      name,
      producer: tags.producteur ?? cleanVendor(raw.vendor),
      vintage: vintage ?? parseVintage(raw.title),
      color: tags.couleur ? normalizeColor(tags.couleur) : WineColor.Other,
      country: tags.pays ?? null,
      region: null,
      appellation: null,
      grapes: body.grapes,
      // Tag is canonical when present; body_html "Format : ..." is the
      // fallback for the rare product whose Format_ tag is missing.
      volumeMl: parseBottleMl(tags.format) ?? parseBottleMl(body.format ?? undefined),
      alcoholPct: null,
      // À Boire Debout sells case-only; `variant.price` is the per-bottle
      // case price (e.g. $36.48 inside a 6-pack listed at $39 headline). We
      // store the per-bottle price for parity with single-bottle agencies.
      price: parsePrice(variant?.price),
      available: variant?.available === true,
      sourceUrl: `${STORE_ORIGIN}/products/${raw.handle}`,
      imageUrl: raw.images[0]?.src ?? null,
      raw: { tags: raw.tags, productType: raw.product_type },
    };
  }
}

/**
 * Shopify emits `variant.price` as a decimal string (`"36.48"`). Guard
 * against missing/garbage values — a NaN amount would survive `NormalizedWine`
 * typing but fail Postgres's numeric column on upsert, killing the whole
 * record rather than just the price field.
 */
function parsePrice(price: string | undefined): NormalizedWine['price'] {
  if (!price) return null;
  const amount = Number.parseFloat(price);
  return Number.isFinite(amount) && amount >= 0 ? { amount, currency: 'CAD' } : null;
}

interface ParsedTags {
  couleur?: string;
  pays?: string;
  producteur?: string;
  format?: string;
}

/**
 * Tags follow a `Prefix_Value` convention (e.g. `Couleur_Blanc`,
 * `Pays_Italie`, `Producteur_Hannes Bergdoll`, `Format_6 x 750 ml`). A few
 * bare tags (`vin`, `V2`) are noise and ignored.
 */
function parseTags(tags: string[]): ParsedTags {
  const out: ParsedTags = {};
  for (const tag of tags) {
    const idx = tag.indexOf('_');
    if (idx <= 0) continue;
    const prefix = tag.slice(0, idx).toLowerCase();
    const value = tag.slice(idx + 1).trim();
    if (!value) continue;
    if (prefix === 'couleur') out.couleur = value;
    else if (prefix === 'pays') out.pays = value;
    else if (prefix === 'producteur') out.producteur = value;
    else if (prefix === 'format') out.format = value;
  }
  return out;
}

/**
 * Strip the trailing `" - <price>$"` headline from product titles like
 * `"Sauvignon Granit 2024 - 39.00$"` and pull out an explicit vintage if it
 * sits at the end of the cleaned name. Falls back to whatever cleanup we can
 * do — never throws.
 */
function parseTitle(title: string): { name: string; vintage: number | null } {
  const stripped = title.replace(/\s*-\s*\d+(?:[.,]\d+)?\s*\$\s*$/, '').trim();
  const trailing = stripped.match(/\b((?:19|20)\d{2})\s*$/);
  const year = trailing?.[1];
  const vintage = year ? Number.parseInt(year, 10) : null;
  const name = trailing ? stripped.slice(0, trailing.index).trim() : stripped;
  return { name: name || stripped || title, vintage };
}

/**
 * Format tags carry both pack count and bottle size (`6 x 750 ml`,
 * `1 x 1500 ml`). We want bottle volume; ignore everything before the `x`.
 */
function parseBottleMl(format: string | undefined): number | null {
  if (!format) return null;
  const tail = format.includes('x') ? format.slice(format.lastIndexOf('x') + 1) : format;
  return parseVolumeMl(tail);
}

/**
 * Vendors carry a trailing `, <country-code>` (e.g. `"Hannes Bergdoll, All"`,
 * `"Calalta, It"`, `"Foo, Port"`). 2–4 letters covers the codes seen so far.
 * The `Producteur_*` tag is preferred; this is the fallback for the rare
 * product without one.
 */
function cleanVendor(vendor: string): string | null {
  if (!vendor) return null;
  const trimmed = vendor.replace(/,\s*[A-Za-zÀ-ÿ]{2,4}\s*$/, '').trim();
  return trimmed || null;
}

/**
 * `body_html` is a small chunk of HTML laid out as labelled lines, e.g.
 * `<h3>Cépage : Pinot Noir - Dornfelder</h3><p>Format : 1 litre</p>`. We
 * pull out the cépage list and the format string; everything else is
 * free-form prose we ignore for now.
 */
interface ParsedBody {
  grapes: string[];
  format: string | null;
}

function parseBodyHtml(html: string | undefined): ParsedBody {
  if (!html) return { grapes: [], format: null };
  const text = stripHtml(html);
  return {
    grapes: parseGrapesLine(text),
    format: matchLabel(text, /format/i),
  };
}

/**
 * Parse the `Cépage(s) : ...` line into a lowercased grape list. Splits on
 * comma, slash, ampersand, semicolon, ` et `, and ` - ` (the spaced dash
 * À Boire Debout uses between grapes — bare hyphens stay intact since some
 * grape names like `pinot-meunier` are hyphenated).
 */
function parseGrapesLine(text: string): string[] {
  const m = text.match(/c[ée]page[s]?\s*:\s*([^\n]+)/i);
  const list = m?.[1];
  if (!list) return [];
  return list
    .split(/[,;/&]|\bet\b|\s-\s/i)
    .map((g) => g.replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((g) => g.length > 0);
}

function matchLabel(text: string, label: RegExp): string | null {
  const re = new RegExp(`${label.source}\\s*:\\s*([^\\n]+)`, label.flags);
  const m = text.match(re);
  return m?.[1]?.trim() || null;
}
