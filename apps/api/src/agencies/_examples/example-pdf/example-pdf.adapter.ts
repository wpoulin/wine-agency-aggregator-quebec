import { Injectable } from '@nestjs/common';
import { type NormalizedWine, WineColor } from '@wine/types';

import { Agency } from '../../_contract/agency.decorator';
import { PdfAdapterBase } from '../../_contract/base/pdf-adapter.base';
import { HttpService } from '../../../infrastructure/http/http.service';
import { PdfService } from '../../../infrastructure/pdf/pdf.service';
import { normalizeColor, parsePriceAmount, parseVintage } from '../../../core/normalization';

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

  constructor(http: HttpService, pdf: PdfService) {
    super(http, pdf);
  }

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
      price:
        parsePriceAmount(raw.priceRaw) != null
          ? { amount: parsePriceAmount(raw.priceRaw)!, currency: 'CAD' }
          : null,
      available: true,
      sourceUrl: null,
      imageUrl: null,
    };
  }
}
