import { WineColor } from '@wine/types';
import { SaqAdapter } from './saq.adapter';
import { saqFixtures } from './saq.fixtures';

describe('SaqAdapter.normalize', () => {
  const adapter = new SaqAdapter(
    // biome-ignore lint/suspicious/noExplicitAny: stubbed deps for unit test
    {} as any,
    // biome-ignore lint/suspicious/noExplicitAny: stubbed deps for unit test
    {} as any,
  );

  it('normalizes the canonical fixture', () => {
    const wine = adapter.normalize(saqFixtures[0]!);
    expect(wine).toMatchObject({
      agencyId: 'saq',
      agencySku: '12345678',
      name: 'Château Example 2018',
      producer: 'Château Example',
      vintage: 2018,
      color: WineColor.Red,
      country: 'France',
      region: 'Bordeaux',
      volumeMl: 750,
      alcoholPct: 13.5,
      price: { amount: 24.99, currency: 'CAD' },
      sourceUrl: 'https://www.saq.com/en/12345678',
    });
  });
});
