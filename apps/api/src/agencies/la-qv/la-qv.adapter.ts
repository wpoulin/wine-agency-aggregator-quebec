import { Injectable } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

import { normalizeColor, parseVintage, parseVolumeMl } from '../../core/normalization';
import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { GraphqlAdapterBase } from '../_contract/base/graphql-adapter.base';

interface Metafield {
  key: string;
  value: string;
}

/**
 * Raw record shape returned by Shopify's Storefront `products` query, with the
 * metafields we read from La QV's `laqv` namespace. The `metafields` array is
 * order-aligned with the identifiers we send and contains `null` slots for
 * unset metafields — we filter those before reading.
 */
export interface LaQvRaw {
  id: string;
  handle: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  onlineStoreUrl: string | null;
  featuredImage: { url: string } | null;
  priceRange: {
    minVariantPrice: { amount: string; currencyCode: string };
  };
  variants: {
    nodes: Array<{ sku: string | null; availableForSale: boolean; title: string | null }>;
  };
  metafields: Array<Metafield | null>;
}

interface ProductsPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: LaQvRaw[];
  };
}

/**
 * Metafield identifiers we request, in order. La QV publishes everything in
 * the `laqv` namespace; the storefront table on the site is rendered from
 * these same fields.
 */
const METAFIELD_IDENTIFIERS = [
  { namespace: 'laqv', key: 'grape' },
  { namespace: 'laqv', key: 'year' },
  { namespace: 'laqv', key: 'agriculture' },
  { namespace: 'laqv', key: 'price_licence' },
  { namespace: 'laqv', key: 'price_individual' },
  { namespace: 'laqv', key: 'available' },
  { namespace: 'laqv', key: 'bf_order' },
  { namespace: 'laqv', key: 'ccnp' },
  { namespace: 'laqv', key: 'uvc' },
] as const;

const PRODUCTS_QUERY = /* GraphQL */ `
  query LaQvProducts($cursor: String, $identifiers: [HasMetafieldsIdentifier!]!) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        vendor
        productType
        tags
        onlineStoreUrl
        featuredImage { url }
        priceRange { minVariantPrice { amount currencyCode } }
        variants(first: 1) {
          nodes { sku availableForSale title }
        }
        metafields(identifiers: $identifiers) { key value }
      }
    }
  }
`;

const STOREFRONT_ENDPOINT = 'https://la-qv.myshopify.com/api/2025-07/graphql.json';
const THEME_BUNDLE_URL = 'https://laqv.ca/cdn/shop/t/2/assets/app.js';
const TOKEN_RE = /"X-Shopify-Storefront-Access-Token"\s*:\s*"([a-f0-9]{32})"/;

@Injectable()
@Agency()
export class LaQvAdapter extends GraphqlAdapterBase<LaQvRaw> {
  readonly id = 'la-qv';
  readonly displayName = 'La QV';

  protected readonly endpoint = STOREFRONT_ENDPOINT;

  async fetch(ctx: FetchContext): Promise<LaQvRaw[]> {
    const token = await this.resolveAccessToken(ctx);
    const headers = { 'X-Shopify-Storefront-Access-Token': token };

    const all: LaQvRaw[] = [];
    let cursor: string | null = null;

    while (true) {
      if (ctx.signal.aborted) {
        ctx.logger.warn('LaQv fetch aborted via signal');
        break;
      }

      const data: ProductsPage = await this.query<ProductsPage>(
        PRODUCTS_QUERY,
        { cursor, identifiers: METAFIELD_IDENTIFIERS },
        headers,
      );
      all.push(...data.products.nodes);
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
    }

    return all;
  }

  /**
   * Discover the public Storefront access token from La QV's published theme
   * bundle. The token is shipped to every visitor's browser so the storefront
   * can render metafield-driven columns. If LaQV ever rotates it, the next run
   * picks up the new value automatically.
   */
  private async resolveAccessToken(ctx: FetchContext): Promise<string> {
    const js = await this.http.text(THEME_BUNDLE_URL, { timeoutMs: 30_000 });
    const token = js.match(TOKEN_RE)?.[1];
    if (!token) {
      ctx.logger.error(`Could not extract Storefront token from ${THEME_BUNDLE_URL}`);
      throw new Error('LaQv: storefront access token not found in theme bundle');
    }
    return token;
  }

  normalize(raw: LaQvRaw): NormalizedWine {
    const variant = raw.variants.nodes[0] ?? null;
    const meta = indexMetafields(raw.metafields);
    const currency = raw.priceRange.minVariantPrice.currencyCode as 'CAD' | 'USD' | 'EUR';
    const { country, region } = splitCountryRegion(raw.tags);

    const grapes = splitMulti(meta.grape);
    const yearFromMeta = meta.year ? Number.parseInt(meta.year, 10) : null;

    return {
      agencyId: this.id,
      agencySku: variant?.sku?.trim() || raw.handle,
      name: raw.title,
      producer: raw.vendor?.trim() || null,
      vintage:
        parseVintage(raw.title) ??
        (yearFromMeta && Number.isFinite(yearFromMeta) ? yearFromMeta : null),
      color: normalizeColor(raw.productType ?? ''),
      country,
      region,
      appellation: null,
      grapes,
      volumeMl: parseVolumeMl(variant?.title) ?? parseVolumeMl(raw.title) ?? 750,
      alcoholPct: null,
      price: pickPrice(meta.price_individual, raw.priceRange.minVariantPrice.amount, currency),
      available: parseAvailable(meta.available, variant?.availableForSale ?? false),
      sourceUrl: raw.onlineStoreUrl ?? `https://laqv.ca/products/${raw.handle}`,
      imageUrl: raw.featuredImage?.url ?? null,
      raw: {
        agriculture: splitMulti(meta.agriculture),
        priceLicence: parseDecimal(meta.price_licence),
        priceIndividual: parseDecimal(meta.price_individual),
        bfOrder: meta.bf_order ?? null,
        ccnp: meta.ccnp ?? null,
        uvc: meta.uvc ?? null,
      },
    };
  }
}

function indexMetafields(list: Array<Metafield | null>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of list) {
    if (m && m.value != null && m.value !== '') out[m.key] = m.value;
  }
  return out;
}

/** Split values like "sangiovese, montepulciano" or "Biologique|Nature" into a clean array. */
function splitMulti(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseDecimal(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * "Prix part." on the storefront table is the `price_individual` metafield —
 * the canonical consumer price for private-import customers. The variant price
 * is often a placeholder (sometimes 0 for pre-arrival drafts), so prefer the
 * metafield and fall back to the variant only when the metafield is absent.
 */
function pickPrice(
  metaValue: string | undefined,
  variantAmount: string,
  currency: 'CAD' | 'USD' | 'EUR',
): { amount: number; currency: 'CAD' | 'USD' | 'EUR' } | null {
  const fromMeta = parseDecimal(metaValue);
  if (fromMeta != null && fromMeta > 0) return { amount: fromMeta, currency };
  const fromVariant = Number.parseFloat(variantAmount);
  return Number.isFinite(fromVariant) ? { amount: fromVariant, currency } : null;
}

function parseAvailable(metaValue: string | undefined, variantFallback: boolean): boolean {
  if (metaValue) return metaValue.toLowerCase().startsWith('disponible');
  return variantFallback;
}

/**
 * La QV tags products with a country (`"Italie"`) and a `country/X` pair
 * (`"Italie/Marche"`). The slash-suffix carries whatever LaQV considers the
 * relevant locale — sometimes a region (Marche, Burgenland), sometimes an
 * appellation (Sablet). Their data model has no separate appellation slot, so
 * we surface the suffix as `region` and leave `appellation` null. Don't trust
 * `region` to be strictly a region across all wines.
 */
function splitCountryRegion(tags: string[]): { country: string | null; region: string | null } {
  let country: string | null = null;
  let region: string | null = null;
  for (const tag of tags) {
    const slash = tag.indexOf('/');
    if (slash === -1) {
      country ??= tag.trim() || null;
    } else {
      region ??= tag.slice(slash + 1).trim() || null;
      country ??= tag.slice(0, slash).trim() || null;
    }
  }
  return { country, region };
}
