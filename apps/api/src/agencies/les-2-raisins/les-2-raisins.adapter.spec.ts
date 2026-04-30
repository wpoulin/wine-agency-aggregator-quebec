import { Logger } from '@nestjs/common';
import { WineColor } from '@wine/types';

import type { HttpService } from '../../infrastructure/http/http.service';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { Les2RaisinsAdapter, type Les2RaisinsRaw } from './les-2-raisins.adapter';

function makeRaw(overrides: Partial<Les2RaisinsRaw> = {}): Les2RaisinsRaw {
  return {
    id: 13985,
    name: 'Querce Bettina Il Campone 2022',
    sku: '15546831',
    permalink: 'https://www.les2raisins.com/product/querce-bettina-il-campone/',
    short_description:
      '<p style="font-weight: 400">Italie, Toscane</p>\n<p>Rosso di Toscana IGT</p>\n<p style="font-weight: 400">Vin rouge</p>\n<p>Cépage:  Sangiovese Grosso (100%)</p>',
    prices: {
      price: '3425',
      currency_code: 'CAD',
      currency_minor_unit: 2,
    },
    categories: [
      { id: 186, name: 'Italie', slug: 'vins-ditalie' },
      { id: 107, name: 'Tous les produits', slug: 'tous-les-produits' },
      { id: 109, name: 'Vins rouges', slug: 'vins-rouges' },
    ],
    tags: [
      { id: 169, name: 'Brunello', slug: 'brunello' },
      { id: 154, name: 'Grand format', slug: 'grand-format' },
      { id: 172, name: 'Querce Bettina', slug: 'querce-bettina' },
    ],
    attributes: [
      {
        name: 'millésime',
        taxonomy: 'pa_vintage',
        terms: [{ name: '2022', slug: '2022' }],
      },
    ],
    is_in_stock: true,
    images: [{ src: 'https://www.les2raisins.com/wp-content/uploads/2026/03/bottle-1.jpg' }],
    ...overrides,
  };
}

function makeCtx(signal: AbortSignal = new AbortController().signal): FetchContext {
  return { runId: 'test-run', logger: new Logger('test'), signal };
}

describe('Les2RaisinsAdapter', () => {
  describe('normalize', () => {
    it('maps a full Store API record across every NormalizedWine field', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw());

      expect(out).toEqual({
        agencyId: 'les-2-raisins',
        agencySku: '15546831',
        name: 'Querce Bettina Il Campone 2022',
        producer: 'Querce Bettina',
        vintage: 2022,
        color: WineColor.Red,
        country: 'Italie',
        region: 'Toscane',
        appellation: 'IGT',
        grapes: ['sangiovese grosso'],
        volumeMl: 750,
        alcoholPct: null,
        price: { amount: 34.25, currency: 'CAD' },
        available: true,
        sourceUrl: 'https://www.les2raisins.com/product/querce-bettina-il-campone/',
        imageUrl: 'https://www.les2raisins.com/wp-content/uploads/2026/03/bottle-1.jpg',
        raw: {
          categorySlugs: ['vins-ditalie', 'tous-les-produits', 'vins-rouges'],
          tagSlugs: ['brunello', 'grand-format', 'querce-bettina'],
        },
      });
    });

    it('converts price from minor units using currency_minor_unit', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({ prices: { price: '14750', currency_code: 'CAD', currency_minor_unit: 2 } }),
      );
      expect(out.price).toEqual({ amount: 147.5, currency: 'CAD' });
    });

    it('defaults currency_minor_unit to 2 when omitted', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ prices: { price: '7000', currency_code: 'CAD' } }));
      expect(out.price).toEqual({ amount: 70, currency: 'CAD' });
    });

    it('reads vintage from the pa_vintage attribute', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ name: 'Querce Bettina Il Campone' }));
      expect(out.vintage).toBe(2022);
    });

    it('falls back to vintage parsed from title when no attribute', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ attributes: [] }));
      expect(out.vintage).toBe(2022);
    });

    it('returns null vintage when neither attribute nor title carries a year', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ name: 'Querce Bettina Il Campone', attributes: [] }));
      expect(out.vintage).toBe(null);
    });

    it('returns null producer when no tag is a substring of the title', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          name: 'Some Random Wine 2022',
          tags: [{ id: 1, name: 'Brunello', slug: 'brunello' }],
        }),
      );
      expect(out.producer).toBe(null);
    });

    it('picks the longest substring-matching tag as producer', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          name: 'Domaine de la Côte Bloomfield Pinot Noir 2021',
          tags: [
            { id: 1, name: 'Pinot', slug: 'pinot' },
            { id: 2, name: 'Domaine de la Côte', slug: 'domaine-de-la-cote' },
            { id: 3, name: 'Bloomfield', slug: 'bloomfield' },
          ],
        }),
      );
      expect(out.producer).toBe('Domaine de la Côte');
    });

    it('detects Magnum in the title and emits 1500ml', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({ name: 'Lucie Thiéblemont Chablis Premier Cru (Magnum) 2023' }),
      );
      expect(out.volumeMl).toBe(1500);
    });

    it('maps Vins rouges → Red, combined-color → White, unknown → Other', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const red = adapter.normalize(makeRaw());
      const white = adapter.normalize(
        makeRaw({
          categories: [
            { id: 186, name: 'France', slug: 'vins-de-france' },
            { id: 108, name: 'Vins blancs, rosés, orange', slug: 'vins-blancs-et-roses' },
          ],
        }),
      );
      const other = adapter.normalize(
        makeRaw({
          categories: [{ id: 1, name: 'Tous les produits', slug: 'tous-les-produits' }],
        }),
      );
      expect(red.color).toBe(WineColor.Red);
      expect(white.color).toBe(WineColor.White);
      expect(other.color).toBe(WineColor.Other);
    });

    it('returns null country when no category matches the known-countries set', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          categories: [
            { id: 107, name: 'Tous les produits', slug: 'tous-les-produits' },
            { id: 109, name: 'Vins rouges', slug: 'vins-rouges' },
          ],
        }),
      );
      expect(out.country).toBe(null);
    });

    it('falls back agencySku to id when sku is empty', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ sku: '' }));
      expect(out.agencySku).toBe('13985');
    });

    it('returns null imageUrl when images array is empty', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ images: [] }));
      expect(out.imageUrl).toBe(null);
    });

    it('reflects is_in_stock as the available flag', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const inStock = adapter.normalize(makeRaw({ is_in_stock: true }));
      const outOfStock = adapter.normalize(makeRaw({ is_in_stock: false }));
      expect(inStock.available).toBe(true);
      expect(outOfStock.available).toBe(false);
    });

    // Cross-agency search consistency: these keep L2R aligned with La QV so
    // unified filters on country / color / grapes work across agencies.

    it('lowercases grapes and strips parenthetical percentage annotations', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          short_description: '<p>Cépages: Sangiovese Grosso (60%), Merlot (40%)</p>',
        }),
      );
      expect(out.grapes).toEqual(['sangiovese grosso', 'merlot']);
    });

    it('strips bare percentage suffixes/prefixes and splits on " et "', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          short_description:
            '<p>Cépage: Teroldego 100 %, 100% Chardonnay, Grenache 60% et Syrah</p>',
        }),
      );
      expect(out.grapes).toEqual(['teroldego', 'chardonnay', 'grenache', 'syrah']);
    });

    it('emits country in French ("Italie") to match the La QV convention', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw());
      expect(out.country).toBe('Italie');
    });

    it('strips HTML tags and entities from short_description before parsing', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(
        makeRaw({
          short_description: '<p>Italie,&nbsp;Toscane</p><p>Cépage: Sangiovese &amp; Merlot</p>',
        }),
      );
      expect(out.region).toBe('Toscane');
      expect(out.grapes).toEqual(['sangiovese', 'merlot']);
    });

    it('collapses an empty short_description to null region/appellation and empty grapes', () => {
      const adapter = new Les2RaisinsAdapter({} as HttpService);
      const out = adapter.normalize(makeRaw({ short_description: '' }));
      expect(out.region).toBe(null);
      expect(out.appellation).toBe(null);
      expect(out.grapes).toEqual([]);
    });
  });

  describe('fetch', () => {
    it('queries every stock_status and paginates each until a short page', async () => {
      const calls: string[] = [];
      const http: Pick<HttpService, 'json'> = {
        async json<T>(url: string): Promise<T> {
          calls.push(url);
          // instock: page 1 full → page 2 short. outofstock: 1 short page.
          // onbackorder: 1 short page.
          if (url.includes('stock_status=instock') && url.includes('page=1')) {
            return Array.from({ length: 100 }, (_, i) =>
              makeRaw({ id: 1000 + i, sku: `in-${i}` }),
            ) as unknown as T;
          }
          if (url.includes('stock_status=instock') && url.includes('page=2')) {
            return [makeRaw({ id: 2000, sku: 'in-last' })] as unknown as T;
          }
          if (url.includes('stock_status=outofstock')) {
            return [makeRaw({ id: 3000, sku: 'oos-1', is_in_stock: false })] as unknown as T;
          }
          if (url.includes('stock_status=onbackorder')) {
            return [makeRaw({ id: 4000, sku: 'bo-1' })] as unknown as T;
          }
          return [] as unknown as T;
        },
      };

      const adapter = new Les2RaisinsAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx());

      // 100 instock page1 + 1 instock page2 + 1 outofstock + 1 onbackorder.
      expect(result).toHaveLength(103);
      expect(calls).toEqual([
        'https://www.les2raisins.com/wp-json/wc/store/v1/products?per_page=100&page=1&stock_status=instock',
        'https://www.les2raisins.com/wp-json/wc/store/v1/products?per_page=100&page=2&stock_status=instock',
        'https://www.les2raisins.com/wp-json/wc/store/v1/products?per_page=100&page=1&stock_status=outofstock',
        'https://www.les2raisins.com/wp-json/wc/store/v1/products?per_page=100&page=1&stock_status=onbackorder',
      ]);
    });

    it('deduplicates products that appear under more than one stock_status query', async () => {
      const http: Pick<HttpService, 'json'> = {
        async json<T>(url: string): Promise<T> {
          if (url.includes('stock_status=instock')) {
            return [makeRaw({ id: 42, sku: 'shared' })] as unknown as T;
          }
          if (url.includes('stock_status=outofstock')) {
            return [makeRaw({ id: 42, sku: 'shared' })] as unknown as T;
          }
          return [] as unknown as T;
        },
      };
      const adapter = new Les2RaisinsAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx());
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe(42);
    });

    it('honours an aborted signal between pages', async () => {
      const ctrl = new AbortController();
      let pageCount = 0;
      const http: Pick<HttpService, 'json'> = {
        async json<T>(): Promise<T> {
          pageCount++;
          ctrl.abort();
          // Returning a full page would normally trigger another fetch — the
          // abort check at the top of the next iteration must stop us first.
          return Array.from({ length: 100 }, (_, i) =>
            makeRaw({ id: i + 1, sku: `sku-${i + 1}` }),
          ) as unknown as T;
        },
      };

      const adapter = new Les2RaisinsAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx(ctrl.signal));

      expect(pageCount).toBe(1);
      expect(result).toHaveLength(100);
    });

    it('stops a status loop after a single short first page', async () => {
      let pageCount = 0;
      const http: Pick<HttpService, 'json'> = {
        async json<T>(): Promise<T> {
          pageCount++;
          return [makeRaw({ id: pageCount })] as unknown as T;
        },
      };

      const adapter = new Les2RaisinsAdapter(http as HttpService);
      const result = await adapter.fetch(makeCtx());

      // One short page per status × 3 statuses.
      expect(pageCount).toBe(3);
      expect(result).toHaveLength(3);
    });
  });
});
