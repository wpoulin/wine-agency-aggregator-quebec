import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { normalizeColor, parsePriceAmount, parseVintage } from '../../../core/normalization';
import { Agency } from '../../_contract/agency.decorator';
import { PdfAdapterBase } from '../../_contract/base/pdf-adapter.base';

interface PdfRow {
  sku: string;
  name: string;
  colorRaw: string;
  priceRaw: string;
}

@Injectable()
@Agency()
export class ExamplePdfAdapter extends PdfAdapterBase<PdfRow> {
  readonly id = 'example-pdf';
  readonly displayName = 'Example PDF Price-list Agency';

  protected pdfUrl(): string {
    return 'https://example.invalid/pricelist.pdf';
  }

  protected parsePdf(_pages: string[], full: string): PdfRow[] {
    // Extremely naive line-based parsing — replace per real PDF layout.
    return full
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d{5,}/.test(line))
      .map((line) => {
        const [sku, ...rest] = line.split(/\s+/);
        const priceRaw = rest.find((t) => /\$/.test(t)) ?? '';
        const colorRaw = rest.find((t) => /(red|white|rouge|blanc)/i.test(t)) ?? '';
        return {
          sku: sku ?? '',
          name: rest.filter((t) => t !== priceRaw && t !== colorRaw).join(' '),
          colorRaw,
          priceRaw,
        };
      });
  }

  normalize(raw: PdfRow): NormalizedWine {
    const priceAmount = parsePriceAmount(raw.priceRaw);
    return {
      agencyId: this.id,
      agencySku: raw.sku,
      name: raw.name,
      producer: null,
      vintage: parseVintage(raw.name),
      color: normalizeColor(raw.colorRaw) ?? WineColor.Other,
      country: null,
      region: null,
      appellation: null,
      grapes: [],
      volumeMl: 750,
      alcoholPct: null,
      price: priceAmount != null ? { amount: priceAmount, currency: 'CAD' } : null,
      available: true,
      sourceUrl: null,
      imageUrl: null,
    };
  }
}
