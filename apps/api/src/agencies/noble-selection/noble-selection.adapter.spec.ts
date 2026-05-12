import { Logger } from '@nestjs/common';
import { WineColor } from '@wine/types';

import type { HttpService } from '../../infrastructure/http/http.service';
import { ScrapingService } from '../../infrastructure/scraping/scraping.service';
import type { FetchContext } from '../_contract/agency-adapter.interface';
import { NobleSelectionAdapter, type NobleSelectionRaw } from './noble-selection.adapter';

function makeRaw(overrides: Partial<NobleSelectionRaw> = {}): NobleSelectionRaw {
  return {
    cspc: '15412649',
    name: 'Mainqué Chardonnay',
    brand: 'BODEGA CHACRA',
    priceRaw: '88,75$',
    path: '/qc/fr/nos-domaines/bodega-chacra/mainque-chardonnay/2024/15412649',
    imageSrc: 'https://dfalvymn23xg3.cloudfront.net/images/c_65x180_bodega-chacra-mainqui--.png',
    listingHeading: '2024 Mainqué Chardonnay',
    countryFromList: 'Argentine',
    regionFromList: 'Patagonia',
    sizeRaw: '6 x 750',
    detailCountry: 'Argentine',
    detailRegion: 'Patagonia',
    detailAppellation: 'Patagonia',
    detailColor: 'Blanc',
    detailGrapes: 'Chardonnay',
    detailAlcohol: '12.7%',
    detailVolume: '6 x 750ml',
    detailStatus: 'Disponible',
    ...overrides,
  };
}

function makeCtx(signal: AbortSignal = new AbortController().signal): FetchContext {
  return { runId: 'test-run', logger: new Logger('test'), signal };
}

/** Single listing card matching the live page's structure (li.js-infowine). */
const LISTING_CARD_HTML = `
<li itemscope itemtype="http://schema.org/Product"
    class="js-infowine bordered"
    data-agent="" data-price="88,75$" data-cspc="15412649" data-brand="BODEGA CHACRA"
    data-url="/qc/fr/nos-domaines/bodega-chacra/mainque-chardonnay/2024/15412649"
    data-qty="0" data-id="193302658" data-name="Mainqué Chardonnay">
  <a href="/qc/fr/nos-domaines/bodega-chacra/mainque-chardonnay/2024/15412649" class="wrapper">
    <div class="main padded">
      <div class="img">
        <img alt="Snow" itemprop="image"
             src="https://dfalvymn23xg3.cloudfront.net/images/c_65x180_bodega-chacra-mainqui--.png">
      </div>
      <h4>2024 Mainqué Chardonnay</h4>
      <p class="kind">BODEGA CHACRA</p>
    </div>
    <div class="more padded">
      <div class="content">
        <h4>2024 Mainqué Chardonnay</h4>
        <p class="kind">BODEGA CHACRA</p>
        <div class="price"><p>88,75$</p></div>
        <span class="code">+15412649</span>
        <ul class="unstyled infos">
          <li>Argentine</li>
          <li>Patagonia</li>
        </ul>
        <p class="size">6 x 750</p>
      </div>
    </div>
  </a>
</li>`;

function listingPageHtml(cardCount: number, startCspc = 15400000): string {
  const cards = Array.from({ length: cardCount }, (_, i) =>
    LISTING_CARD_HTML.replace(/data-cspc="15412649"/g, `data-cspc="${startCspc + i}"`).replace(
      /\/qc\/fr\/nos-domaines\/bodega-chacra\/mainque-chardonnay\/2024\/15412649/g,
      `/qc/fr/nos-domaines/bodega-chacra/wine-${i}/2024/${startCspc + i}`,
    ),
  ).join('\n');
  return `<html><body><ul class="ul-catalogue">${cards}</ul></body></html>`;
}

/** Detail-page spec block matching the live page's `.fiche .row-table` layout. */
const DETAIL_HTML = `
<html><body>
<section class="fiche">
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Code produit</span></div>
    <div class="col"><div class="content"><strong>15412649</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Conditionnement</span></div>
    <div class="col"><div class="content"><strong>6 x 750ml</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Statut</span></div>
    <div class="col"><div class="content"><strong>Disponible</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Pays</span></div>
    <div class="col"><div class="content"><strong>Argentine</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Région</span></div>
    <div class="col"><div class="content"><strong>Patagonia</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Appellation</span></div>
    <div class="col"><div class="content"><strong>Patagonia</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Cépage(s)</span></div>
    <div class="col"><div class="content"><strong>Chardonnay</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Pourcentage d'alcool</span></div>
    <div class="col"><div class="content"><strong>12.7%</strong></div></div>
  </div>
  <div class="row row-table">
    <div class="col"><span class="ic"></span><span class="txt">Couleur</span></div>
    <div class="col"><div class="content"><strong>Blanc</strong></div></div>
  </div>
</section>
</body></html>`;

function makeAdapter(opts: { http?: Pick<HttpService, 'text'> } = {}): NobleSelectionAdapter {
  const adapter = new NobleSelectionAdapter();
  Object.assign(adapter, {
    http: opts.http ?? {
      async text() {
        return '';
      },
    },
    scraper: new ScrapingService(),
  });
  return adapter;
}

describe('NobleSelectionAdapter', () => {
  describe('normalize', () => {
    it('maps a fully-enriched record across every NormalizedWine field', () => {
      const adapter = makeAdapter();
      expect(adapter.normalize(makeRaw())).toEqual({
        agencyId: 'noble-selection',
        agencySku: '15412649',
        name: 'Mainqué Chardonnay',
        producer: 'BODEGA CHACRA',
        vintage: 2024,
        color: WineColor.White,
        country: 'Argentine',
        region: 'Patagonia',
        appellation: 'Patagonia',
        grapes: ['chardonnay'],
        volumeMl: 750,
        alcoholPct: 12.7,
        price: { amount: 88.75, currency: 'CAD' },
        available: true,
        sourceUrl:
          'https://nobleselection.kork.ca/qc/fr/nos-domaines/bodega-chacra/mainque-chardonnay/2024/15412649',
        imageUrl:
          'https://dfalvymn23xg3.cloudfront.net/images/c_65x180_bodega-chacra-mainqui--.png',
        raw: { status: 'Disponible' },
      });
    });

    it('falls back to listing country/region when detail enrichment is missing', () => {
      const adapter = makeAdapter();
      const out = adapter.normalize(
        makeRaw({
          detailCountry: null,
          detailRegion: null,
          detailAppellation: null,
          detailColor: null,
          detailGrapes: null,
          detailAlcohol: null,
          detailVolume: null,
          detailStatus: null,
        }),
      );
      expect(out.country).toBe('Argentine');
      expect(out.region).toBe('Patagonia');
      // No detail → no color signal → Other (color is detail-only).
      expect(out.color).toBe(WineColor.Other);
      expect(out.grapes).toEqual([]);
      expect(out.appellation).toBe(null);
      expect(out.alcoholPct).toBe(null);
      // Falls back to listing's unit-less "6 x 750".
      expect(out.volumeMl).toBe(750);
      // No status → assume available (the catalog only lists sellable wines).
      expect(out.available).toBe(true);
      expect(out.raw).toEqual({ status: null });
    });

    it('parses vintage from the path when the listing heading omits a year', () => {
      const adapter = makeAdapter();
      const out = adapter.normalize(
        makeRaw({
          listingHeading: 'Mainqué Chardonnay',
          path: '/qc/fr/nos-domaines/bodega-chacra/mainque-chardonnay/2021/15412649',
        }),
      );
      expect(out.vintage).toBe(2021);
    });

    it('maps each detail Couleur via normalizeColor', () => {
      const adapter = makeAdapter();
      expect(adapter.normalize(makeRaw({ detailColor: 'Rouge' })).color).toBe(WineColor.Red);
      expect(adapter.normalize(makeRaw({ detailColor: 'Rosé' })).color).toBe(WineColor.Rose);
      expect(adapter.normalize(makeRaw({ detailColor: 'Orange' })).color).toBe(WineColor.Orange);
      expect(adapter.normalize(makeRaw({ detailColor: 'unknown' })).color).toBe(WineColor.Other);
    });

    it('splits multi-grape cépage strings and strips parenthetical percentages', () => {
      const adapter = makeAdapter();
      expect(
        adapter.normalize(
          makeRaw({ detailGrapes: 'Cabernet Sauvignon (60%), Merlot, Cabernet Franc' }),
        ).grapes,
      ).toEqual(['cabernet sauvignon', 'merlot', 'cabernet franc']);
      expect(
        adapter.normalize(makeRaw({ detailGrapes: 'Chardonnay et Pinot Noir' })).grapes,
      ).toEqual(['chardonnay', 'pinot noir']);
    });

    it('reads bottle size from "<n> x <volume>" detail volume, ignoring case count', () => {
      const adapter = makeAdapter();
      expect(adapter.normalize(makeRaw({ detailVolume: '12 x 1000ml' })).volumeMl).toBe(1000);
      expect(adapter.normalize(makeRaw({ detailVolume: '6 x 1500ml' })).volumeMl).toBe(1500);
    });

    it('prefers detail volume over the listing size when both are present', () => {
      const adapter = makeAdapter();
      const out = adapter.normalize(makeRaw({ detailVolume: '6 x 1500ml', sizeRaw: '12 x 750' }));
      expect(out.volumeMl).toBe(1500);
    });

    it('treats non-"Disponible" status as unavailable', () => {
      const adapter = makeAdapter();
      expect(adapter.normalize(makeRaw({ detailStatus: 'Épuisé' })).available).toBe(false);
      expect(adapter.normalize(makeRaw({ detailStatus: 'Succ. Seul.' })).available).toBe(false);
    });

    it('returns null price (rather than NaN) when data-price is unparseable', () => {
      const adapter = makeAdapter();
      expect(adapter.normalize(makeRaw({ priceRaw: '' })).price).toBe(null);
    });
  });

  describe('fetch', () => {
    it('paginates the listing until an empty page, then enriches each card with detail', async () => {
      // Noble Sélection's IP listing page 1 returns 24 cards (under the
      // nominal 25 per page) but page 2 still has more — stopping on the
      // short page would silently lose half the catalog. Walk to the first
      // empty page instead.
      const calls: string[] = [];
      const http: Pick<HttpService, 'text'> = {
        async text(url: string) {
          calls.push(url);
          if (url.includes('&p=1')) return listingPageHtml(24, 15400000);
          if (url.includes('&p=2')) return listingPageHtml(22, 15500000);
          if (url.includes('&p=3')) return listingPageHtml(0);
          // Any other URL is a detail-page request.
          return DETAIL_HTML;
        },
      };
      const adapter = makeAdapter({ http });
      const result = await adapter.fetch(makeCtx());

      expect(result).toHaveLength(46);
      // Three listing-page requests, then one detail fetch per card (46).
      expect(calls.slice(0, 3)).toEqual([
        'https://nobleselection.kork.ca/qc/fr/?search=&nature%5B%5D=9&listing%5B%5D=16&status%5B%5D=1&total=&p=1',
        'https://nobleselection.kork.ca/qc/fr/?search=&nature%5B%5D=9&listing%5B%5D=16&status%5B%5D=1&total=&p=2',
        'https://nobleselection.kork.ca/qc/fr/?search=&nature%5B%5D=9&listing%5B%5D=16&status%5B%5D=1&total=&p=3',
      ]);
      expect(calls.slice(3)).toHaveLength(46);
      expect(result[0]?.detailColor).toBe('Blanc');
      expect(result[0]?.detailGrapes).toBe('Chardonnay');
    });

    it('dedupes cards by CSPC across pages and within a single page', async () => {
      // Page 2 of the real IP listing returns the same CSPC twice in a row
      // for a couple of wines. Without dedupe we'd normalize and upsert the
      // same row twice. CSPC is the canonical key.
      const dupeCardHtml = LISTING_CARD_HTML; // cspc 15412649
      const http: Pick<HttpService, 'text'> = {
        async text(url: string) {
          if (url.includes('&p=1')) {
            return `<html><body><ul>${dupeCardHtml}${dupeCardHtml}</ul></body></html>`;
          }
          if (url.includes('&p=2')) {
            // Same CSPC repeated across pages.
            return `<html><body><ul>${dupeCardHtml}</ul></body></html>`;
          }
          if (url.includes('&p=3')) return listingPageHtml(0);
          return DETAIL_HTML;
        },
      };
      const adapter = makeAdapter({ http });
      const result = await adapter.fetch(makeCtx());
      expect(result).toHaveLength(1);
      expect(result[0]?.cspc).toBe('15412649');
    });

    it('keeps cards in the catalog when their detail fetch fails', async () => {
      const http: Pick<HttpService, 'text'> = {
        async text(url: string) {
          if (url.includes('&p=1')) return listingPageHtml(2, 15400000);
          if (url.includes('/nos-domaines/')) throw new Error('detail boom');
          return listingPageHtml(0);
        },
      };
      const adapter = makeAdapter({ http });
      const result = await adapter.fetch(makeCtx());

      expect(result).toHaveLength(2);
      expect(result[0]?.detailColor).toBe(null);
      expect(result[0]?.cspc).toBe('15400000');
    });

    it('honours an aborted signal between listing pages', async () => {
      const ctrl = new AbortController();
      const http: Pick<HttpService, 'text'> = {
        async text(url: string) {
          if (url.includes('&p=1')) {
            ctrl.abort();
            return listingPageHtml(25, 15400000);
          }
          throw new Error('should not reach page 2');
        },
      };
      const adapter = makeAdapter({ http });
      // Listing page 1 returns 25 cards and aborts; the loop should not request
      // page 2, but should still enrich the already-collected cards.
      const result = await adapter.fetch(makeCtx(ctrl.signal));
      // 25 cards collected, none enriched (abort halts the enrichment loop).
      expect(result).toHaveLength(25);
      expect(result[0]?.detailColor).toBe(null);
    });
  });
});
