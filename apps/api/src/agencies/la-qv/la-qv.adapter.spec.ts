import { Logger } from '@nestjs/common';
import { WineColor } from '@wine/types';

import type { FetchContext } from '../_contract/agency-adapter.interface';
import type { HttpService } from '../../infrastructure/http/http.service';
import { LaQvAdapter, type LaQvRaw } from './la-qv.adapter';

const FAKE_TOKEN = 'e05b9057651913ff021a4247e25c3a6f';
const FAKE_THEME_JS = `var ea="https://la-qv.myshopify.com/api/2025-07/graphql.json";return{headers:{"X-Shopify-Storefront-Access-Token":"${FAKE_TOKEN}","Content-Type":"application/json"}}`;

function makeRaw(overrides: Partial<LaQvRaw> = {}): LaQvRaw {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'esino-rosso',
    title: 'Esino, Rosso 2016',
    vendor: 'Failoni',
    productType: 'Rouge',
    tags: ['Italie', 'Italie/Marche'],
    onlineStoreUrl: 'https://laqv.ca/products/esino-rosso',
    featuredImage: { url: 'https://cdn.shopify.com/s/files/1/0487/test.png?v=1' },
    priceRange: { minVariantPrice: { amount: '32.04', currencyCode: 'CAD' } },
    variants: { nodes: [{ sku: '122947', availableForSale: false, title: '750ml' }] },
    metafields: [
      { key: 'grape', value: 'sangiovese, montepulciano' },
      { key: 'year', value: '2016' },
      { key: 'agriculture', value: 'Biologique|Nature' },
      { key: 'price_licence', value: '20.75' },
      { key: 'price_individual', value: '23.90' },
      { key: 'available', value: 'Disponible' },
      null,
      { key: 'ccnp', value: '14738962' },
      { key: 'uvc', value: '12' },
    ],
    ...overrides,
  };
}

function makeCtx(signal: AbortSignal = new AbortController().signal): FetchContext {
  return { runId: 'test-run', logger: new Logger('test'), signal };
}

describe('LaQvAdapter', () => {
  describe('normalize', () => {
    it('maps a full Storefront record with metafields', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw());

      expect(out).toEqual({
        agencyId: 'la-qv',
        agencySku: '122947',
        name: 'Esino, Rosso 2016',
        producer: 'Failoni',
        vintage: 2016,
        color: WineColor.Red,
        country: 'Italie',
        region: 'Marche',
        appellation: null,
        grapes: ['sangiovese', 'montepulciano'],
        volumeMl: 750,
        alcoholPct: null,
        price: { amount: 23.9, currency: 'CAD' },
        available: true,
        sourceUrl: 'https://laqv.ca/products/esino-rosso',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0487/test.png?v=1',
        raw: {
          agriculture: ['Biologique', 'Nature'],
          priceLicence: 20.75,
          priceIndividual: 23.9,
          bfOrder: null,
          ccnp: '14738962',
          uvc: '12',
        },
      });
    });

    it('falls back to variant price when price_individual metafield is missing', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          metafields: [
            { key: 'grape', value: 'sangiovese' },
            { key: 'year', value: '2016' },
          ],
          priceRange: { minVariantPrice: { amount: '32.04', currencyCode: 'CAD' } },
        }),
      );
      expect(out.price).toEqual({ amount: 32.04, currency: 'CAD' });
    });

    it('uses price_individual when variant price is 0', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          priceRange: { minVariantPrice: { amount: '0', currencyCode: 'CAD' } },
        }),
      );
      expect(out.price).toEqual({ amount: 23.9, currency: 'CAD' });
    });

    it('returns a zero variant price as last resort when no metafield', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          metafields: [],
          priceRange: { minVariantPrice: { amount: '0', currencyCode: 'CAD' } },
        }),
      );
      expect(out.price).toEqual({ amount: 0, currency: 'CAD' });
    });

    it('falls back to year metafield when title has no vintage', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ title: 'Esino, Rosso' }));
      expect(out.vintage).toBe(2016);
    });

    it('treats missing available metafield as variant availableForSale', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          metafields: [],
          variants: { nodes: [{ sku: 'x', availableForSale: true, title: '750ml' }] },
        }),
      );
      expect(out.available).toBe(true);
    });

    it('marks unavailable when available metafield is "Épuisé" and variant is unavailable', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          metafields: [{ key: 'available', value: 'Épuisé' }],
          variants: { nodes: [{ sku: 'x', availableForSale: false, title: '750ml' }] },
        }),
      );
      expect(out.available).toBe(false);
    });

    it('falls back to handle when variant has no SKU', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({ variants: { nodes: [{ sku: null, availableForSale: true, title: '750ml' }] } }),
      );
      expect(out.agencySku).toBe('esino-rosso');
    });

    it('survives null-only metafields array', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ metafields: [null, null, null] }));
      expect(out.grapes).toEqual([]);
      expect(out.raw).toEqual({
        agriculture: [],
        priceLicence: null,
        priceIndividual: null,
        bfOrder: null,
        ccnp: null,
        uvc: null,
      });
    });

    it('returns null country/region when tags do not match the pattern', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ tags: [] }));
      expect(out.country).toBe(null);
      expect(out.region).toBe(null);
    });

    it('falls back to 750ml when neither variant nor title declare a volume', () => {
      const adapter = new LaQvAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          title: 'Esino Rosso',
          variants: { nodes: [{ sku: 'x', availableForSale: true, title: null }] },
        }),
      );
      expect(out.volumeMl).toBe(750);
    });
  });

  describe('fetch', () => {
    it('discovers the storefront token and paginates via cursor', async () => {
      const tokenCalls: string[] = [];
      const queryCalls: Array<{ headers: Record<string, string>; body: string }> = [];

      const http: Pick<HttpService, 'text' | 'json'> = {
        async text(url: string): Promise<string> {
          tokenCalls.push(url);
          return FAKE_THEME_JS;
        },
        async json<T>(_url: string, opts?: { headers?: Record<string, string>; body?: string }): Promise<T> {
          queryCalls.push({
            headers: opts?.headers ?? {},
            body: typeof opts?.body === 'string' ? opts.body : '',
          });
          // First call → page 1 with hasNextPage=true; second → page 2 stop.
          if (queryCalls.length === 1) {
            return {
              data: {
                products: {
                  pageInfo: { hasNextPage: true, endCursor: 'CURSOR_1' },
                  nodes: [makeRaw({ handle: 'a' }), makeRaw({ handle: 'b' })],
                },
              },
            } as unknown as T;
          }
          return {
            data: {
              products: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [makeRaw({ handle: 'c' })],
              },
            },
          } as unknown as T;
        },
      };

      const adapter = new LaQvAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx());

      expect(tokenCalls).toEqual(['https://laqv.ca/cdn/shop/t/2/assets/app.js']);
      expect(result.map((r) => r.handle)).toEqual(['a', 'b', 'c']);
      expect(queryCalls).toHaveLength(2);
      for (const call of queryCalls) {
        expect(call.headers['X-Shopify-Storefront-Access-Token']).toBe(FAKE_TOKEN);
      }
      expect(queryCalls[1]!.body).toContain('CURSOR_1');
    });

    it('throws when the theme bundle does not contain a token', async () => {
      const http: Pick<HttpService, 'text' | 'json'> = {
        async text(): Promise<string> {
          return 'var x = "no token here";';
        },
        async json<T>(): Promise<T> {
          throw new Error('should not be called');
        },
      };
      const adapter = new LaQvAdapter(http as HttpService);
      await expect(adapter.fetch(makeCtx())).rejects.toThrow(/storefront access token not found/i);
    });

    it('honours an aborted signal between pages', async () => {
      const ctrl = new AbortController();
      let queryCount = 0;

      const http: Pick<HttpService, 'text' | 'json'> = {
        async text(): Promise<string> {
          return FAKE_THEME_JS;
        },
        async json<T>(): Promise<T> {
          queryCount++;
          ctrl.abort();
          return {
            data: {
              products: {
                pageInfo: { hasNextPage: true, endCursor: 'NEXT' },
                nodes: [makeRaw({ handle: 'a' })],
              },
            },
          } as unknown as T;
        },
      };

      const adapter = new LaQvAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx(ctrl.signal));

      expect(queryCount).toBe(1);
      expect(result).toHaveLength(1);
    });
  });
});
