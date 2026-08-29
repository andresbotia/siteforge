import { assertSafeHttpUrl, type DnsLookup } from "./ssrf";

function resolveHref(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

export type FetchResult = {
  url: string;
  status: number;
  location: string | null;
  body: string;
  elapsedMs: number;
  truncated: boolean;
  contentType: string | null;
};

export type SafeHttpClient = {
  fetch(
    url: string,
    options: { timeoutMs: number; maxBytes: number; method?: "GET" | "HEAD" },
  ): Promise<FetchResult>;
};

export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "size" | "network" | "blocked",
  ) {
    super(message);
  }
}

export type FetchBounds = {
  timeoutMs: number;
  maxBytes: number;
  maxRedirects: number;
};

/**
 * Fetch a URL with mandatory SSRF checks on the initial URL and every redirect hop.
 * Does not auto-follow redirects at the transport layer.
 */
export async function fetchFollowingRedirects(
  rawUrl: string,
  http: SafeHttpClient,
  bounds: FetchBounds,
  lookup?: DnsLookup,
): Promise<FetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= bounds.maxRedirects; hop += 1) {
    await assertSafeHttpUrl(current, lookup);
    let result: FetchResult;
    try {
      result = await http.fetch(current, {
        timeoutMs: bounds.timeoutMs,
        maxBytes: bounds.maxBytes,
        method: "GET",
      });
    } catch (error) {
      if (error instanceof SafeFetchError) throw error;
      const message = error instanceof Error ? error.message : "network";
      if (message === "timeout") throw new SafeFetchError("timeout", "timeout");
      if (message === "size") throw new SafeFetchError("size", "size");
      throw new SafeFetchError(message, "network");
    }
    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = resolveHref(result.url || current, result.location);
      if (!next) throw new SafeFetchError("invalid_redirect", "network");
      current = next;
      continue;
    }
    return result;
  }
  throw new SafeFetchError("too_many_redirects", "network");
}

export function createMockHttpClient(
  pages: Record<
    string,
    Partial<FetchResult> & { throwCode?: SafeFetchError["code"] }
  >,
): SafeHttpClient {
  return {
    async fetch(url) {
      const page = pages[url] ?? pages["*"];
      if (!page) {
        throw new SafeFetchError("not_found", "network");
      }
      if (page.throwCode) {
        throw new SafeFetchError(page.throwCode, page.throwCode);
      }
      return {
        url: page.url ?? url,
        status: page.status ?? 200,
        location: page.location ?? null,
        body: page.body ?? "",
        elapsedMs: page.elapsedMs ?? 40,
        truncated: page.truncated ?? false,
        contentType: page.contentType ?? null,
      };
    },
  };
}

export function createLiveHttpClient(userAgent: string): SafeHttpClient {
  return {
    async fetch(url, options) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      const started = Date.now();
      try {
        const response = await fetch(url, {
          method: options.method ?? "GET",
          redirect: "manual",
          headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
          },
          signal: controller.signal,
        });
        const location = response.headers.get("location");
        const contentType = response.headers.get("content-type");
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > options.maxBytes) {
              await reader.cancel();
              throw new SafeFetchError("size", "size");
            }
            chunks.push(value);
          }
        }
        const body = new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));
        return {
          url: response.url || url,
          status: response.status,
          location,
          body,
          elapsedMs: Date.now() - started,
          truncated: false,
          contentType,
        };
      } catch (error) {
        if (error instanceof SafeFetchError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new SafeFetchError("timeout", "timeout");
        }
        throw new SafeFetchError("network", "network");
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
