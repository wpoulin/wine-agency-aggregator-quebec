import { Injectable } from '@nestjs/common';
import pdfParse from 'pdf-parse';

export interface ExtractedPdf {
  /** Plain text concatenated across pages. */
  text: string;
  /** Per-page text (best-effort split on form-feed). */
  pages: string[];
  /** Document-level metadata exposed by pdf-parse. */
  meta: {
    pageCount: number;
    info: unknown;
  };
}

@Injectable()
export class PdfService {
  async extract(buf: Buffer): Promise<ExtractedPdf> {
    const result = await pdfParse(buf);
    const pages = result.text.split('\f').map((p) => p.trim());
    return {
      text: result.text,
      pages,
      meta: {
        pageCount: result.numpages,
        info: result.info,
      },
    };
  }
}
