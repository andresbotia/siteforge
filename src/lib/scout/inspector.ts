import {
  createLiveHttpClient as createSharedLiveHttpClient,
  createMockHttpClient,
  fetchFollowingRedirects,
  SafeFetchError,
  type FetchResult,
  type SafeHttpClient,
} from "@/lib/http/fetch";
import { extractPageSignals, resolveHref } from "./html";
import {
  SCOUT_FETCH_TIMEOUT_MS,
  SCOUT_MAX_LINKS_TO_CHECK,
  SCOUT_MAX_PAGES,
  SCOUT_MAX_REDIRECTS,
  SCOUT_MAX_RESPONSE_BYTES,
  SCOUT_USER_AGENT,
} from "./limits";
import type { DnsLookup } from "./ssrf";
import type { InspectionResult, LinkCheck, PageSignals } from "./types";

export type { FetchResult };
export type ScoutHttpClient = SafeHttpClient;
export { createMockHttpClient };
export const ScoutFetchError = SafeFetchError;
export type ScoutFetchError = SafeFetchError;

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
        if (error instanceof SafeFetchError && error.code === "blocked") {
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
      error instanceof SafeFetchError
        ? error.code === "blocked"
          ? error.message
          : error.code
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

function classifyLink(href: string, kindHint?: LinkCheck["kind"]): LinkCheck["kind"] {
  if (kindHint) return kindHint;
  const text = href.toLowerCase();
  if (/menu|\.pdf/.test(text)) return "menu";
  if (/reserv|opentable|resy/.test(text)) return "reservation";
  if (/order|toasttab|doordash|ubereats/.test(text)) return "order";
  if (/contact/.test(text)) return "contact";
  return "other";
}

async function fetchSafePage(
  rawUrl: string,
  http: ScoutHttpClient,
  lookup?: DnsLookup,
): Promise<FetchResult> {
  return fetchFollowingRedirects(
    rawUrl,
    http,
    {
      timeoutMs: SCOUT_FETCH_TIMEOUT_MS,
      maxBytes: SCOUT_MAX_RESPONSE_BYTES,
      maxRedirects: SCOUT_MAX_REDIRECTS,
    },
    lookup,
  );
}

export function createLiveHttpClient(): ScoutHttpClient {
  return createSharedLiveHttpClient(SCOUT_USER_AGENT);
}
