import { WineColor } from '@wine/types';
import {
  normalizeColor,
  parseAlcoholPct,
  parsePriceAmount,
  parseVintage,
  parseVolumeMl,
  stripHtml,
} from './index';

describe('normalization helpers', () => {
  it('maps french color labels', () => {
    expect(normalizeColor('Rouge')).toBe(WineColor.Red);
    expect(normalizeColor('blanc')).toBe(WineColor.White);
    expect(normalizeColor('mousseux')).toBe(WineColor.Sparkling);
    expect(normalizeColor('unknown')).toBe(WineColor.Other);
    expect(normalizeColor(null)).toBe(WineColor.Other);
  });

  it('extracts vintage', () => {
    expect(parseVintage('Château X 2018')).toBe(2018);
    expect(parseVintage('NV champagne')).toBe(null);
  });

  it('parses prices', () => {
    expect(parsePriceAmount('$24.99')).toBe(24.99);
    expect(parsePriceAmount('24,99 $')).toBe(24.99);
    expect(parsePriceAmount('CAD 24.99')).toBe(24.99);
  });

  it('parses volumes', () => {
    expect(parseVolumeMl('750 ml')).toBe(750);
    expect(parseVolumeMl('1.5 L')).toBe(1500);
    expect(parseVolumeMl('75 cl')).toBe(750);
  });

  it('parses alcohol pct', () => {
    expect(parseAlcoholPct('13.5%')).toBe(13.5);
    expect(parseAlcoholPct('13,5 %')).toBe(13.5);
    expect(parseAlcoholPct('no abv')).toBe(null);
  });

  describe('stripHtml', () => {
    it('returns empty string for null/undefined/empty input', () => {
      expect(stripHtml(null)).toBe('');
      expect(stripHtml(undefined)).toBe('');
      expect(stripHtml('')).toBe('');
    });

    it('drops tags and keeps text', () => {
      expect(stripHtml('<h3>Cépage : Riesling</h3>')).toBe('Cépage : Riesling');
    });

    it('turns block-level closures and <br> into newlines so labelled lines stay separated', () => {
      expect(stripHtml('<p>Italie, Toscane</p><p>AOC Chianti</p>')).toBe(
        'Italie, Toscane\nAOC Chianti',
      );
      expect(stripHtml('A<br/>B<br>C')).toBe('A\nB\nC');
      expect(stripHtml('<li>one</li><li>two</li>')).toBe('one\ntwo');
      expect(stripHtml('<tr><td>a</td></tr><tr><td>b</td></tr>')).toBe('a\nb');
      expect(stripHtml('<h1>X</h1><h6>Y</h6>')).toBe('X\nY');
    });

    it('decodes the entities WordPress/Shopify commonly emit', () => {
      expect(stripHtml('Tom &amp; Jerry')).toBe('Tom & Jerry');
      expect(stripHtml('Pineau d&#39;Aunis')).toBe("Pineau d'Aunis");
      expect(stripHtml('a&nbsp;b')).toBe('a b');
      expect(stripHtml('&lt;tag&gt;')).toBe('<tag>');
      expect(stripHtml('&quot;x&quot;')).toBe('"x"');
      expect(stripHtml('caf&#233;')).toBe('café');
    });

    it('collapses runs of spaces/tabs and trims around newlines', () => {
      expect(stripHtml('  a   \t  b  ')).toBe('a b');
      expect(stripHtml('<p>  a  </p>\n\n   <p>  b  </p>')).toBe('a\nb');
    });
  });
});
