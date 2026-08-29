import { extractPageSignals, resolveHref } from "./html";
import {
  SCOUT_FETCH_TIMEOUT_MS,
  SCOUT_MAX_LINKS_TO_CHECK,
  SCOUT_MAX_PAGES,
  SCOUT_MAX_REDIRECTS,
  SCOUT_MAX_RESPONSE_BYTES,
  SCOUT_USER_AGENT,
} from "./limits";
import { assertSafeHttpUrl, type DnsLookup } from "./ssrf";
import type { InspectionResult, LinkCheck, PageSignals } from "./types";

export type FetchResult = {
  url: string;
  status: number;
  location: string | null;
  body: string;
  elapsedMs: number;
  truncated: boolean;
};

export type ScoutHttpClient = {
  fetch(
    url: string,
    options: { timeoutMs: number; maxBytes: number },
  ): Promise<FetchResult>;
};

export class ScoutFetchError extends Error {
  constructor(
    message: string,
    readonly code: "timeout" | "size" | "network" | "blocked",
  ) {
    super(message);
  }
}

function classifyLink(href: string, kindHint?: LinkCheck["kind"]): LinkCheck["kind"] {
  if (kindHint) return kindHint;
  const text = href.toLowerCase();
  if (/menu|\.pdf/.test(text)) return "menu";
  if (/reserv|opentable|resy/.test(text)) return "reservation";
  if (/order|toasttab|doordash|ubereats/.test(text)) return "order";
  if (/contact/.test(text)) return "contact";
  return "other";
}

export async function inspectWebsite(
  websiteUrl: string | null | undefined,
  http: ScoutHttpClient,
  lookup?: DnsLookup,
): Promise<InspectionResult> {
  if (!websiteUrl) {
    return {
      reachable: false,
      finalUrl: null,
      blockedReason: null,
      error: "no_website",
      homepage: null,
      linkChecks: [],
      pagesFetched: 0,
    };
  }

  try {
    const homepage = await fetchSafePage(websiteUrl, http, lookup);
    const signals = extractPageSignals(
      homepage.body,
      homepage.url,
      homepage.status,
      homepage.elapsedMs,
    );
    const important = collectImportantHrefs(signals, homepage.url);
    const linkChecks: LinkCheck[] = [];
    let pagesFetched = 1;

    for (const item of important.slice(0, SCOUT_MAX_LINKS_TO_CHECK)) {
      if (pagesFetched >= SCOUT_MAX_PAGES && item.kind === "other") continue;
      try {
        const page = await fetchSafePage(item.url, http, lookup);
        pagesFetched += 1;
        linkChecks.push({
          url: item.url,
          kind: item.kind,
          status: page.status,
          ok: page.status >= 200 && page.status < 400,
        });
      } catch (error) {
        linkChecks.push({
          url: item.url,
          kind: item.kind,
          status: null,
          ok: false,
        });
        if (error instanceof ScoutFetchError && error.code === "blocked") {
          // Already recorded as failed; do not follow further.
        }
      }
    }

    return {
      reachable: homepage.status >= 200 && homepage.status < 400,
      finalUrl: homepage.url,
      blockedReason: null,
      error: homepage.truncated ? "truncated" : null,
      homepage: signals,
      linkChecks,
      pagesFetched,
    };
  } catch (error) {
    const code =
      error instanceof ScoutFetchError
        ? error.code
        : error instanceof Error
          ? error.message
          : "network";
    const blocked =
      typeof code === "string" &&
      (code.startsWith("blocked") ||
        code === "non_http_scheme" ||
        code === "blocked_private_ip" ||
        code === "blocked_hostname" ||
        code === "blocked_metadata" ||
        code === "blocked_resolved_private_ip" ||
        code === "userinfo_blocked" ||
        code === "invalid_url");
    return {
      reachable: false,
      finalUrl: null,
      blockedReason: blocked ? String(code) : null,
      error: String(code),
      homepage: null,
      linkChecks: [],
      pagesFetched: 0,
    };
  }
}

function collectImportantHrefs(
  signals: PageSignals,
  baseUrl: string,
): Array<{ url: string; kind: LinkCheck["kind"] }> {
  const wanted: Array<{ href: string | null; kind: LinkCheck["kind"] }> = [
    { href: signals.menuLink, kind: "menu" },
    { href: signals.reservationLink, kind: "reservation" },
    { href: signals.orderLink, kind: "order" },
  ];
  const extra = signals.sameSiteHrefs
    .filter((href) => /contact|about|menu/i.test(href))
    .slice(0, 2)
    .map((href) => ({ href, kind: "contact" as const }));

  const resolved: Array<{ url: string; kind: LinkCheck["kind"] }> = [];
  for (const item of [...wanted, ...extra]) {
    if (!item.href) continue;
    const url = resolveHref(baseUrl, item.href);
    if (!url) continue;
    resolved.push({ url, kind: classifyLink(url, item.kind) });
  }
  return resolved;
}

async function fetchSafePage(
  rawUrl: string,
  http: ScoutHttpClient,
  lookup?: DnsLookup,
): Promise<FetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= SCOUT_MAX_REDIRECTS; hop += 1) {
    await assertSafeHttpUrl(current, lookup);
    let result: FetchResult;
    try {
      result = await http.fetch(current, {
        timeoutMs: SCOUT_FETCH_TIMEOUT_MS,
        maxBytes: SCOUT_MAX_RESPONSE_BYTES,
      });
    } catch (error) {
      if (error instanceof ScoutFetchError) throw error;
      const message = error instanceof Error ? error.message : "network";
      if (message === "timeout") throw new ScoutFetchError("timeout", "timeout");
      if (message === "size") throw new ScoutFetchError("size", "size");
      throw new ScoutFetchError(message, "network");
    }
    if (result.status >= 300 && result.status < 400 && result.location) {
      const next = resolveHref(result.url || current, result.location);
      if (!next) throw new ScoutFetchError("invalid_redirect", "network");
      current = next;
      continue;
    }
    return result;
  }
  throw new ScoutFetchError("too_many_redirects", "network");
}

export function createMockHttpClient(
  pages: Record<
    string,
    Partial<FetchResult> & { throwCode?: ScoutFetchError["code"] }
  >,
): ScoutHttpClient {
  return {
    async fetch(url) {
      const page = pages[url] ?? pages["*"];
      if (!page) {
        throw new ScoutFetchError("not_found", "network");
      }
      if (page.throwCode) {
        throw new ScoutFetchError(page.throwCode, page.throwCode);
      }
      return {
        url: page.url ?? url,
        status: page.status ?? 200,
        location: page.location ?? null,
        body: page.body ?? "",
        elapsedMs: page.elapsedMs ?? 40,
        truncated: page.truncated ?? false,
      };
    },
  };
}

export function createLiveHttpClient(): ScoutHttpClient {
  return {
    async fetch(url, options) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const response = await fetch(url, {
          method: "GET",
          redirect: "manual",
          headers: { "User-Agent": SCOUT_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
          signal: controller.signal,
        });
        const location = response.headers.get("location");
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
              throw new ScoutFetchError("size", "size");
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
          elapsedMs: 0,
          truncated: false,
        };
      } catch (error) {
        if (error instanceof ScoutFetchError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new ScoutFetchError("timeout", "timeout");
        }
        throw new ScoutFetchError("network", "network");
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
