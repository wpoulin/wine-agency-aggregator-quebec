import { WineColor } from '@wine/types';
import {
  normalizeColor,
  parseAlcoholPct,
  parsePriceAmount,
  parseVintage,
  parseVolumeMl,
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
});
