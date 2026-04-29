import type { NormalizedWine } from '@wine/types';

import { HttpService } from '../../../infrastructure/http/http.service';
import type { AgencyAdapter, AgencySourceType, FetchContext } from '../agency-adapter.interface';

/**
 * Convenience base for GraphQL-backed adapters. Provides a `query()` helper
 * that POSTs to a configured endpoint.
 */
export abstract class GraphqlAdapterBase<Raw> implements AgencyAdapter<Raw> {
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly sourceType: AgencySourceType = 'graphql';

  protected abstract readonly endpoint: string;

  protected constructor(protected readonly http: HttpService) {}

  protected async query<T>(
    query: string,
    variables?: Record<string, unknown>,
    headers: Record<string, string> = {},
  ): Promise<T> {
    const res = await this.http.json<{ data?: T; errors?: Array<{ message: string }> }>(
      this.endpoint,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ query, variables }),
      },
    );
    if (res.errors?.length) {
      throw new Error(`GraphQL error: ${res.errors.map((e) => e.message).join('; ')}`);
    }
    if (!res.data) {
      throw new Error('GraphQL response missing data');
    }
    return res.data;
  }

  abstract fetch(ctx: FetchContext): Promise<Raw[]>;
  abstract normalize(raw: Raw): NormalizedWine;
}
