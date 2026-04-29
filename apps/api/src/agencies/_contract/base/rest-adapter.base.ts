import type { NormalizedWine } from '@wine/types';

import { HttpService } from '../../../infrastructure/http/http.service';
import type { AgencyAdapter, AgencySourceType, FetchContext } from '../agency-adapter.interface';

/**
 * Convenience base class for REST-backed adapters. Subclasses inject HttpService
 * and use `this.http.json(...)` inside `fetch()`.
 */
export abstract class RestAdapterBase<Raw> implements AgencyAdapter<Raw> {
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly sourceType: AgencySourceType = 'rest';

  protected constructor(protected readonly http: HttpService) {}

  abstract fetch(ctx: FetchContext): Promise<Raw[]>;
  abstract normalize(raw: Raw): NormalizedWine;
}
