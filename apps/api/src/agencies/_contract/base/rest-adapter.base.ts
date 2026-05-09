import { Inject } from '@nestjs/common';
import type { NormalizedWine } from '@wine/types';

import { HttpService } from '../../../infrastructure/http/http.service';
import type { AgencyAdapter, AgencySourceType, FetchContext } from '../agency-adapter.interface';

/**
 * Convenience base class for REST-backed adapters. `HttpService` is property-
 * injected here so subclasses don't need to declare a constructor at all —
 * just extend, set `id`/`displayName`, and implement `fetch` + `normalize`.
 */
export abstract class RestAdapterBase<Raw> implements AgencyAdapter<Raw> {
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly sourceType: AgencySourceType = 'rest';

  @Inject(HttpService) protected readonly http!: HttpService;

  abstract fetch(ctx: FetchContext): Promise<Raw[]>;
  abstract normalize(raw: Raw): NormalizedWine;
}
