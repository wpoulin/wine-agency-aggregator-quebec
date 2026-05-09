import { Inject } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

import { HttpService } from '../../../infrastructure/http/http.service';
import { PdfService } from '../../../infrastructure/pdf/pdf.service';
import type { AgencyAdapter, AgencySourceType, FetchContext } from '../agency-adapter.interface';

/**
 * Base class for adapters that ingest a published PDF price list. Subclasses
 * implement `pdfUrl()` (or override `fetch()` if multiple PDFs) and
 * `parsePdf()`. Dependencies are property-injected so subclasses don't need
 * a constructor.
 */
export abstract class PdfAdapterBase<Raw> implements AgencyAdapter<Raw> {
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly sourceType: AgencySourceType = 'pdf';

  @Inject(HttpService) protected readonly http!: HttpService;
  @Inject(PdfService) protected readonly pdf!: PdfService;

  /** URL of the PDF to ingest. Default `fetch()` downloads + parses it. */
  protected abstract pdfUrl(): string | Promise<string>;

  /** Convert extracted PDF text + per-page text into raw records. */
  protected abstract parsePdf(pages: string[], full: string): Raw[] | Promise<Raw[]>;

  async fetch(_ctx: FetchContext): Promise<Raw[]> {
    const url = await this.pdfUrl();
    const buf = await this.http.buffer(url);
    const extracted = await this.pdf.extract(buf);
    return this.parsePdf(extracted.pages, extracted.text);
  }

  abstract normalize(raw: Raw): NormalizedWine;
}
