import type { SaqRaw } from './saq.adapter';

/** Hand-written fixtures used by saq.adapter.spec.ts to validate normalize(). */
export const saqFixtures: SaqRaw[] = [
  {
    sku: '12345678',
    url: 'https://www.saq.com/en/12345678',
    name: 'Château Example 2018',
    producer: 'Château Example',
    vintage: '2018',
    colorRaw: 'Rouge',
    countryRaw: 'France',
    regionRaw: 'Bordeaux',
    volumeRaw: '750 ml',
    alcoholRaw: '13,5 %',
    priceRaw: '24,99 $',
    imageUrl: 'https://www.saq.com/img/12345678.jpg',
  },
];
