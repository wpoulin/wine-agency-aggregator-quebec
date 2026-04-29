import { Injectable, Logger } from '@nestjs/common';

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: RequestInit['body'];
  /** Per-request timeout (ms). Default 20s. */
  timeoutMs?: number;
  /** How many times to retry on network/5xx failures. Default 2. */
  retries?: number;
  /** Base backoff in ms; doubles each retry. Default 500. */
  backoffMs?: number;
}

const DEFAULT_UA = 'wine-agency-aggregator-quebec/0.1 (+local; respectful crawl)';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  async request(url: string, opts: HttpRequestOptions = {}): Promise<Response> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeoutMs = 20_000,
      retries = 2,
      backoffMs = 500,
    } = opts;

    const finalHeaders = { 'user-agent': DEFAULT_UA, ...headers };
    let attempt = 0;
    let lastErr: unknown;

    while (attempt <= retries) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers: finalHeaders,
          body: body ?? null,
          signal: ctrl.signal,
        });
        if (res.status >= 500 && attempt < retries) {
          throw new Error(`upstream ${res.status}`);
        }
        return res;
      } catch (err) {
        lastErr = err;
        this.logger.warn(
          `HTTP ${method} ${url} failed (attempt ${attempt + 1}/${retries + 1}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        if (attempt === retries) break;
        await sleep(backoffMs * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
      attempt++;
    }
    throw lastErr instanceof Error ? lastErr : new Error('http request failed');
  }

  async json<T = unknown>(url: string, opts?: HttpRequestOptions): Promise<T> {
    const res = await this.request(url, opts);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return (await res.json()) as T;
  }

  async text(url: string, opts?: HttpRequestOptions): Promise<string> {
    const res = await this.request(url, opts);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return await res.text();
  }

  async buffer(url: string, opts?: HttpRequestOptions): Promise<Buffer> {
    const res = await this.request(url, opts);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
