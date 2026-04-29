import { z } from 'zod';

export const WineColor = {
  Red: 'red',
  White: 'white',
  Rose: 'rose',
  Sparkling: 'sparkling',
  Fortified: 'fortified',
  Dessert: 'dessert',
  Orange: 'orange',
  Other: 'other',
} as const;
export type WineColor = (typeof WineColor)[keyof typeof WineColor];

export const Currency = {
  CAD: 'CAD',
  USD: 'USD',
  EUR: 'EUR',
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const wineColorSchema = z.enum([
  WineColor.Red,
  WineColor.White,
  WineColor.Rose,
  WineColor.Sparkling,
  WineColor.Fortified,
  WineColor.Dessert,
  WineColor.Orange,
  WineColor.Other,
]);

export const currencySchema = z.enum([Currency.CAD, Currency.USD, Currency.EUR]);

export const priceSchema = z.object({
  amount: z.number().nonnegative(),
  currency: currencySchema.default(Currency.CAD),
});
export type Price = z.infer<typeof priceSchema>;

/**
 * The canonical, normalized wine record. Every agency adapter must produce
 * objects matching this shape. Optional fields are explicitly nullable when
 * the agency commonly omits them.
 */
export const normalizedWineSchema = z.object({
  agencyId: z.string().min(1),
  agencySku: z.string().min(1),
  name: z.string().min(1),
  producer: z.string().nullable(),
  vintage: z.number().int().min(1800).max(2100).nullable(),
  color: wineColorSchema,
  country: z.string().nullable(),
  region: z.string().nullable(),
  appellation: z.string().nullable(),
  grapes: z.array(z.string()).default([]),
  volumeMl: z.number().int().positive().nullable(),
  alcoholPct: z.number().min(0).max(100).nullable(),
  price: priceSchema.nullable(),
  available: z.boolean().default(true),
  sourceUrl: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  raw: z.record(z.unknown()).optional(),
});
export type NormalizedWine = z.infer<typeof normalizedWineSchema>;

export const agencySummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  sourceType: z.enum(['rest', 'graphql', 'pdf', 'scrape', 'mixed']),
});
export type AgencySummary = z.infer<typeof agencySummarySchema>;
