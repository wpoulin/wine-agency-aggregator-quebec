import { Logger } from '@nestjs/common';
import { WineColor } from '@wine/types';

import type { HttpService } from '../../infrastructure/http/http.service';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { AboireDeboutAdapter, type AboireDeboutRaw } from './a-boire-debout.adapter';

function makeRaw(overrides: Partial<AboireDeboutRaw> = {}): AboireDeboutRaw {
  return {
    id: 8647910785174,
    title: 'Sauvignon Granit 2024 - 39.00$',
    handle: 'sauvignon-granit-2024-39-00',
    vendor: 'Hannes Bergdoll, All',
    product_type: 'Vin',
    body_html: '<h3>Cépage : Sauvignon Blanc</h3>\n<p>Format : 6 x 750 ml</p>',
    tags: [
      'Couleur_Blanc',
      'Format_6 x 750 ml',
      'Pays_Allemagne',
      'Producteur_Hannes Bergdoll',
      'V2',
      'vin',
    ],
    variants: [{ sku: null, price: '36.48', available: true }],
    images: [{ src: 'https://cdn.shopify.com/s/files/1/0421/0904/2838/files/SITE2026.png' }],
    ...overrides,
  };
}

function makeCtx(signal: AbortSignal = new AbortController().signal): FetchContext {
  return { runId: 'test-run', logger: new Logger('test'), signal };
}

describe('AboireDeboutAdapter', () => {
  describe('normalize', () => {
    it('maps a full Shopify record across every NormalizedWine field', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw());

      expect(out).toEqual({
        agencyId: 'a-boire-debout',
        agencySku: '8647910785174',
        name: 'Sauvignon Granit',
        producer: 'Hannes Bergdoll',
        vintage: 2024,
        color: WineColor.White,
        country: 'Allemagne',
        region: null,
        appellation: null,
        grapes: ['sauvignon blanc'],
        volumeMl: 750,
        alcoholPct: null,
        price: { amount: 36.48, currency: 'CAD' },
        available: true,
        sourceUrl: 'https://aboiredebout.com/products/sauvignon-granit-2024-39-00',
        imageUrl: 'https://cdn.shopify.com/s/files/1/0421/0904/2838/files/SITE2026.png',
        raw: {
          tags: [
            'Couleur_Blanc',
            'Format_6 x 750 ml',
            'Pays_Allemagne',
            'Producteur_Hannes Bergdoll',
            'V2',
            'vin',
          ],
          productType: 'Vin',
        },
      });
    });

    it('strips the trailing " - <price>$" from the title and pulls vintage', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ title: 'Mezzosangue 2023 - 38.00$' }));
      expect(out.name).toBe('Mezzosangue');
      expect(out.vintage).toBe(2023);
    });

    it('handles titles without a vintage', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ title: 'Roc Cab - 39.00$' }));
      expect(out.name).toBe('Roc Cab');
      expect(out.vintage).toBe(null);
    });

    it('handles titles without the price suffix', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ title: 'Calvados Lelouvier' }));
      expect(out.name).toBe('Calvados Lelouvier');
      expect(out.vintage).toBe(null);
    });

    it('extracts the bottle size from "<n> x <volume>" format tags, ignoring pack count', () => {
      const adapter = new AboireDeboutAdapter();
      expect(
        adapter.normalize(makeRaw({ tags: ['Format_3 x 1500 ml', 'Pays_France'] })).volumeMl,
      ).toBe(1500);
      expect(
        adapter.normalize(makeRaw({ tags: ['Format_12 x 1000 ml', 'Pays_France'] })).volumeMl,
      ).toBe(1000);
      expect(adapter.normalize(makeRaw({ tags: ['Format_4 x 700 ml'] })).volumeMl).toBe(700);
    });

    it('returns null volumeMl when no Format_ tag is present and body_html has no format line', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({ tags: ['Pays_France', 'Couleur_Rouge'], body_html: '' }),
      );
      expect(out.volumeMl).toBe(null);
    });

    it('falls back to body_html "Format : ..." when no Format_ tag is present', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({
          tags: ['Pays_France', 'Couleur_Rouge'],
          body_html: '<p>Format : 1 litre</p>',
        }),
      );
      expect(out.volumeMl).toBe(1000);
    });

    it('prefers Format_ tag over body_html format', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({
          tags: ['Format_6 x 750 ml'],
          body_html: '<p>Format : 1 litre</p>',
        }),
      );
      expect(out.volumeMl).toBe(750);
    });

    it('maps Couleur tags via normalizeColor', () => {
      const adapter = new AboireDeboutAdapter();
      const red = adapter.normalize(makeRaw({ tags: ['Couleur_Rouge'] }));
      const rose = adapter.normalize(makeRaw({ tags: ['Couleur_Rosé'] }));
      const orange = adapter.normalize(makeRaw({ tags: ['Couleur_Orange'] }));
      const fallback = adapter.normalize(makeRaw({ tags: ['Pays_France'] }));
      expect(red.color).toBe(WineColor.Red);
      expect(rose.color).toBe(WineColor.Rose);
      expect(orange.color).toBe(WineColor.Orange);
      expect(fallback.color).toBe(WineColor.Other);
    });

    it('prefers Producteur_ tag over the vendor field', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({
          vendor: 'Wrong Vendor, Fr',
          tags: ['Producteur_Right Producer'],
        }),
      );
      expect(out.producer).toBe('Right Producer');
    });

    it('falls back to vendor with the trailing country code stripped', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({ vendor: 'Calalta, It', tags: ['Pays_Italie', 'Couleur_Rouge'] }),
      );
      expect(out.producer).toBe('Calalta');
    });

    it('uses variant.sku when provided, falls back to product id', () => {
      const adapter = new AboireDeboutAdapter();
      const withSku = adapter.normalize(
        makeRaw({ variants: [{ sku: 'ABD-001', price: '36.48', available: true }] }),
      );
      const noSku = adapter.normalize(makeRaw());
      expect(withSku.agencySku).toBe('ABD-001');
      expect(noSku.agencySku).toBe('8647910785174');
    });

    it('reflects variant.available as the available flag', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({ variants: [{ sku: null, price: '36.48', available: false }] }),
      );
      expect(out.available).toBe(false);
    });

    it('builds sourceUrl from the handle', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ handle: 'mezzosangue-2023-38-00' }));
      expect(out.sourceUrl).toBe('https://aboiredebout.com/products/mezzosangue-2023-38-00');
    });

    it('returns null imageUrl when images array is empty', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ images: [] }));
      expect(out.imageUrl).toBe(null);
    });

    it('returns null price/false available when variants array is empty', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(makeRaw({ variants: [] }));
      expect(out.price).toBe(null);
      expect(out.available).toBe(false);
    });

    it('returns null price (rather than NaN) when variant.price is unparseable', () => {
      const adapter = new AboireDeboutAdapter();
      const out = adapter.normalize(
        makeRaw({ variants: [{ sku: null, price: '', available: true }] }),
      );
      expect(out.price).toBe(null);
    });

    describe('grapes (from body_html "Cépage : ..." line)', () => {
      it('parses a single grape', () => {
        const adapter = new AboireDeboutAdapter();
        const out = adapter.normalize(makeRaw({ body_html: '<h3>Cépage : Riesling</h3>' }));
        expect(out.grapes).toEqual(['riesling']);
      });

      it('splits on the spaced dash À Boire Debout uses ("Pinot Noir - Dornfelder")', () => {
        const adapter = new AboireDeboutAdapter();
        const out = adapter.normalize(
          makeRaw({ body_html: '<h3>Cépage : Pinot Noir - Dornfelder</h3>' }),
        );
        expect(out.grapes).toEqual(['pinot noir', 'dornfelder']);
      });

      it('keeps bare hyphens inside grape names ("Saint-Laurent") while splitting on the spaced dash between grapes', () => {
        // Real example from the catalog: `Cépage : Riesling - Saint-Laurent`.
        // Saint-Laurent is a single Austrian/Czech red grape — its hyphen
        // must survive while the spaced dash between Riesling and it splits.
        const adapter = new AboireDeboutAdapter();
        const out = adapter.normalize(
          makeRaw({
            body_html: '<h3>Cépage : Riesling - Saint-Laurent</h3>\n<p>Format : 1 litre</p>',
          }),
        );
        expect(out.grapes).toEqual(['riesling', 'saint-laurent']);
      });

      it('splits on commas, slashes, ampersands, and " et "', () => {
        const adapter = new AboireDeboutAdapter();
        expect(
          adapter.normalize(makeRaw({ body_html: '<p>Cépage : Sangiovese, Canaiolo</p>' })).grapes,
        ).toEqual(['sangiovese', 'canaiolo']);
        expect(
          adapter.normalize(makeRaw({ body_html: '<p>Cépages : Grenache / Syrah</p>' })).grapes,
        ).toEqual(['grenache', 'syrah']);
        expect(
          adapter.normalize(makeRaw({ body_html: '<p>Cépage : Merlot & Cabernet</p>' })).grapes,
        ).toEqual(['merlot', 'cabernet']);
        expect(
          adapter.normalize(makeRaw({ body_html: '<p>Cépage : Chardonnay et Pinot Noir</p>' }))
            .grapes,
        ).toEqual(['chardonnay', 'pinot noir']);
      });

      it('keeps apostrophes inside grape names ("Pineau d\'Aunis") when comma-splitting', () => {
        // Real example: `Cépage : Grolleau, Gamay, Pineau d'Aunis`. The
        // apostrophe must survive — only commas/etc. split.
        const adapter = new AboireDeboutAdapter();
        const out = adapter.normalize(
          makeRaw({ body_html: "<h3>Cépage : Grolleau, Gamay, Pineau d'Aunis</h3>" }),
        );
        expect(out.grapes).toEqual(['grolleau', 'gamay', "pineau d'aunis"]);
      });

      it('accepts "Cepage" without the accent', () => {
        const adapter = new AboireDeboutAdapter();
        const out = adapter.normalize(makeRaw({ body_html: '<h3>Cepage : Nebbiolo</h3>' }));
        expect(out.grapes).toEqual(['nebbiolo']);
      });

      it('returns [] when body_html is empty or has no Cépage line', () => {
        const adapter = new AboireDeboutAdapter();
        expect(adapter.normalize(makeRaw({ body_html: '' })).grapes).toEqual([]);
        expect(
          adapter.normalize(makeRaw({ body_html: '<p>Just some prose, no labels.</p>' })).grapes,
        ).toEqual([]);
      });
    });

    it.each([
      'Calvados',
      'Cidre',
      'Hydromel',
      'Liqueur',
      'Vermouth',
    ])('throws (and is counted as a skip) for non-wine product_type "%s"', (productType) => {
      const adapter = new AboireDeboutAdapter();
      expect(() => adapter.normalize(makeRaw({ product_type: productType }))).toThrow(
        /non-wine product_type/,
      );
    });
  });

  describe('fetch', () => {
    it('paginates until a short page', async () => {
      const calls: string[] = [];
      const http: Pick<HttpService, 'json'> = {
        async json<T>(url: string): Promise<T> {
          calls.push(url);
          if (url.includes('page=1')) {
            return {
              products: Array.from({ length: 250 }, (_, i) => makeRaw({ id: 1000 + i })),
            } as unknown as T;
          }
          if (url.includes('page=2')) {
            return { products: [makeRaw({ id: 9999 })] } as unknown as T;
          }
          return { products: [] } as unknown as T;
        },
      };
      const adapter = new AboireDeboutAdapter();
      Object.assign(adapter, { http });
      const result = await adapter.fetch(makeCtx());

      expect(result).toHaveLength(251);
      expect(calls).toEqual([
        'https://aboiredebout.com/collections/v2/products.json?limit=250&page=1',
        'https://aboiredebout.com/collections/v2/products.json?limit=250&page=2',
      ]);
    });

    it("returns every product unfiltered — non-wine filtering is normalize()'s job", async () => {
      // Filtering at fetch would hide the drops from aggregation_runs.skipped;
      // normalize() throws on non-wine product_types so they show up in
      // run telemetry instead.
      const http: Pick<HttpService, 'json'> = {
        async json<T>(): Promise<T> {
          return {
            products: [
              makeRaw({ id: 1, product_type: 'Vin' }),
              makeRaw({ id: 2, product_type: 'Calvados' }),
              makeRaw({ id: 3, product_type: 'Hydromel' }),
              makeRaw({ id: 4, product_type: 'Liqueur' }),
              makeRaw({ id: 5, product_type: 'Vermouth' }),
              makeRaw({ id: 6, product_type: '' }),
            ],
          } as unknown as T;
        },
      };
      const adapter = new AboireDeboutAdapter();
      Object.assign(adapter, { http });
      const result = await adapter.fetch(makeCtx());
      expect(result.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('stops after MAX_PAGES (10) when the source keeps returning full pages', async () => {
      let pageCount = 0;
      const http: Pick<HttpService, 'json'> = {
        async json<T>(): Promise<T> {
          pageCount++;
          return {
            products: Array.from({ length: 250 }, (_, i) => makeRaw({ id: pageCount * 1000 + i })),
          } as unknown as T;
        },
      };
      const adapter = new AboireDeboutAdapter();
      Object.assign(adapter, { http });
      const result = await adapter.fetch(makeCtx());
      expect(pageCount).toBe(10);
      expect(result).toHaveLength(10 * 250);
    });

    it('honours an aborted signal between pages', async () => {
      const ctrl = new AbortController();
      let pageCount = 0;
      const http: Pick<HttpService, 'json'> = {
        async json<T>(): Promise<T> {
          pageCount++;
          ctrl.abort();
          return {
            products: Array.from({ length: 250 }, (_, i) => makeRaw({ id: i + 1 })),
          } as unknown as T;
        },
      };
      const adapter = new AboireDeboutAdapter();
      Object.assign(adapter, { http });
      const result = await adapter.fetch(makeCtx(ctrl.signal));
      expect(pageCount).toBe(1);
      expect(result).toHaveLength(250);
    });
  });
});
