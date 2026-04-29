import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../_contract/agency.decorator';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { GraphqlAdapterBase } from '../_contract/base/graphql-adapter.base';
import { normalizeColor, parseVintage, parseVolumeMl } from '../../core/normalization';
import { HttpService } from '@/infrastructure/http/http.service';

/**
 * Raw record shape returned by the Shopify Storefront `products` query.
 * Only fields we actually consume in normalize() are typed here.
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
}

interface ProductsPage {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: LaQvRaw[];
  };
}

const PRODUCTS_QUERY = /* GraphQL */ `
  query LaQvProducts($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        handle
        title
        vendor
        productType
        tags
        onlineStoreUrl
        featuredImage {
          url
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        variants(first: 1) {
          nodes {
            sku
            availableForSale
            title
          }
        }
      }
    }
  }
`;

@Injectable()
@Agency()
export class LaQvAdapter extends GraphqlAdapterBase<LaQvRaw> {
  readonly id = 'la-qv';
  readonly displayName = 'La QV';

  protected readonly endpoint = 'https://la-qv.myshopify.com/api/2025-07/graphql.json';

  // biome-ignore lint/complexity/noUselessConstructor: required so Nest DI sees the constructor's HttpService param
  constructor(http: HttpService) {
    super(http);
  }

  async fetch(_ctx: FetchContext): Promise<LaQvRaw[]> {
    const all: LaQvRaw[] = [];
    let cursor: string | null = null;

    while (true) {
      const data: ProductsPage = await this.query<ProductsPage>(PRODUCTS_QUERY, { cursor });
      all.push(...data.products.nodes);
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
    }

    return all;
  }

  normalize(raw: LaQvRaw): NormalizedWine {
    const variant = raw.variants.nodes[0] ?? null;
    const amount = Number.parseFloat(raw.priceRange.minVariantPrice.amount);
    const currency = raw.priceRange.minVariantPrice.currencyCode as 'CAD' | 'USD' | 'EUR';
    const tagText = raw.tags.join(' ');
    const colorSource = raw.productType ?? findColorTag(raw.tags) ?? '';

    return {
      agencyId: this.id,
      agencySku: variant?.sku?.trim() || raw.handle,
      name: raw.title,
      producer: raw.vendor?.trim() || null,
      vintage: parseVintage(raw.title) ?? parseVintage(tagText),
      color: normalizeColor(colorSource) ?? WineColor.Other,
      country: findTagValue(raw.tags, 'country') ?? findTagValue(raw.tags, 'pays'),
      region: findTagValue(raw.tags, 'region') ?? findTagValue(raw.tags, 'région'),
      appellation: findTagValue(raw.tags, 'appellation'),
      grapes: findTagList(raw.tags, ['grape', 'cépage', 'cepage']),
      volumeMl: parseVolumeMl(variant?.title) ?? parseVolumeMl(raw.title) ?? 750,
      alcoholPct: null,
      price: Number.isFinite(amount) ? { amount, currency } : null,
      available: variant?.availableForSale ?? false,
      sourceUrl: raw.onlineStoreUrl ?? `https://la-qv.com/products/${raw.handle}`,
      imageUrl: raw.featuredImage?.url ?? null,
    };
  }
}

const COLOR_KEYS = ['red', 'white', 'rose', 'rosé', 'sparkling', 'orange', 'rouge', 'blanc'];

function findColorTag(tags: string[]): string | null {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (COLOR_KEYS.some((k) => lower === k || lower.endsWith(`:${k}`))) return lower;
  }
  return null;
}

function findTagValue(tags: string[], key: string): string | null {
  const prefix = `${key.toLowerCase()}:`;
  for (const tag of tags) {
    if (tag.toLowerCase().startsWith(prefix)) return tag.slice(prefix.length).trim() || null;
  }
  return null;
}

function findTagList(tags: string[], keys: string[]): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    for (const key of keys) {
      if (lower.startsWith(`${key}:`)) {
        const value = tag.slice(key.length + 1).trim();
        if (value) out.push(value);
      }
    }
  }
  return out;
}
