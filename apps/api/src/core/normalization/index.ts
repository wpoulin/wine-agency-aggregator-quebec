import { WineColor as Colors, type WineColor } from '@wine/types';

const colorAliases: Record<string, WineColor> = {
  red: Colors.Red,
  rouge: Colors.Red,
  white: Colors.White,
  blanc: Colors.White,
  rose: Colors.Rose,
  rosé: Colors.Rose,
  sparkling: Colors.Sparkling,
  mousseux: Colors.Sparkling,
  champagne: Colors.Sparkling,
  fortified: Colors.Fortified,
  fortifié: Colors.Fortified,
  port: Colors.Fortified,
  sherry: Colors.Fortified,
  dessert: Colors.Dessert,
  orange: Colors.Orange,
};

/** Best-effort mapping from agency-supplied color/category strings → canonical color. */
export function normalizeColor(input: string | null | undefined): WineColor {
  if (!input) return Colors.Other;
  const key = input.trim().toLowerCase();
  return colorAliases[key] ?? Colors.Other;
}

/** Parse a 4-digit vintage out of a free-text string. Returns null if not found. */
export function parseVintage(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = input.match(/(?:19|20)\d{2}/);
  if (!m) return null;
  const n = Number.parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a price string like "$24.99", "24,99 $", "CAD 24.99" into a number of dollars.
 * Returns null if no number is found.
 */
export function parsePriceAmount(input: string | null | undefined): number | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Parse a volume string like "750 ml", "1.5L", "750ml" into integer milliliters. */
export function parseVolumeMl(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = input.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl)/);
  if (!m) return null;
  const value = Number.parseFloat((m[1] ?? '').replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  switch (m[2]) {
    case 'ml':
      return Math.round(value);
    case 'cl':
      return Math.round(value * 10);
    case 'l':
      return Math.round(value * 1000);
    default:
      return null;
  }
}

/** Parse an alcohol percentage like "13.5%", "13,5 %" into a number. */
export function parseAlcoholPct(input: string | null | undefined): number | null {
  if (!input) return null;
  const m = input.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  const n = Number.parseFloat(m[1] ?? '');
  return Number.isFinite(n) ? n : null;
}

/**
 * Light HTML→text. Block-level closures and `<br>` become newlines so
 * downstream label-line parsers can reason per paragraph (region, cépage,
 * format, etc. live on different lines and must not bleed into each other).
 * Decodes the handful of entities WordPress/Shopify commonly emit. We
 * deliberately avoid pulling in `cheerio` here.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  const noTags = withBreaks.replace(/<[^>]*>/g, '');
  const decoded = noTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number.parseInt(n, 10)));
  return decoded
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
