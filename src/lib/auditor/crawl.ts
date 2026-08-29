import {
  fetchFollowingRedirects,
  SafeFetchError,
  type SafeHttpClient,
} from "@/lib/http/fetch";
import type { DnsLookup } from "@/lib/http/ssrf";
import { extractPageSignals, resolveHref } from "@/lib/scout/html";
import {
  AUDITOR_FETCH_TIMEOUT_MS,
  AUDITOR_MAX_LINK_CHECKS,
  AUDITOR_MAX_PAGES,
  AUDITOR_MAX_REDIRECTS,
  AUDITOR_MAX_RESPONSE_BYTES,
} from "./limits";
import type {
  AuditLinkCheck,
  AuditPageKind,
  CrawlResult,
  InspectedPage,
} from "./types";

const PAGE_HINTS: Array<{ kind: AuditPageKind; re: RegExp; weight: number }> = [
  { kind: "contact", re: /contact|get-in-touch|reach-us/i, weight: 100 },
  { kind: "menu", re: /menu|our-food|dinner|lunch/i, weight: 95 },
  { kind: "services", re: /services?|what-we-do/i, weight: 90 },
  { kind: "reservations", re: /reserv|book-a-table|opentable|resy/i, weight: 88 },
  { kind: "order", re: /order|toasttab|doordash|ubereats|grubhub/i, weight: 88 },
  { kind: "location", re: /location|directions|find-us|hours/i, weight: 80 },
  { kind: "about", re: /about|our-story|our-team/i, weight: 70 },
];

function bounds() {
  return {
    timeoutMs: AUDITOR_FETCH_TIMEOUT_MS,
    maxBytes: AUDITOR_MAX_RESPONSE_BYTES,
    maxRedirects: AUDITOR_MAX_REDIRECTS,
  };
}

export function classifyPageKind(url: string, label = ""): { kind: AuditPageKind; weight: number } {
  const hay = `${url} ${label}`;
  for (const hint of PAGE_HINTS) {
    if (hint.re.test(hay)) return { kind: hint.kind, weight: hint.weight };
  }
  return { kind: "other", weight: 10 };
}

export function isPdfResource(url: string, contentType: string | null, body: string): boolean {
  if (/\.pdf(\?|#|$)/i.test(url)) return true;
  if (contentType && /pdf/i.test(contentType)) return true;
  return body.startsWith("%PDF");
}

export function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

function isFetchableHref(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return (
    Boolean(lower) &&
    !lower.startsWith("mailto:") &&
    !lower.startsWith("tel:") &&
    !lower.startsWith("javascript:") &&
    !lower.startsWith("#")
  );
}

export async function crawlWebsite(
  websiteUrl: string | null | undefined,
  http: SafeHttpClient,
  lookup?: DnsLookup,
): Promise<CrawlResult> {
  if (!websiteUrl) {
    return {
      targetUrl: null,
      finalHomepageUrl: null,
      homepageOk: false,
      blockedReason: null,
      error: "no_website",
      pages: [],
      linkChecks: [],
      pagesFetched: 0,
      linkChecksPerformed: 0,
    };
  }

  let homepage: InspectedPage;
  try {
    homepage = await fetchInspectedPage(websiteUrl, "home", http, lookup);
  } catch (error) {
    const code = errorMessage(error);
    const blocked = isBlockedCode(code);
    return {
      targetUrl: websiteUrl,
      finalHomepageUrl: null,
      homepageOk: false,
      blockedReason: blocked ? code : null,
      error: code,
      pages: [],
      linkChecks: [],
      pagesFetched: 0,
      linkChecksPerformed: 0,
    };
  }

  const pages: InspectedPage[] = [homepage];
  const fetched = new Set([normalizePageUrl(homepage.url)]);
  const candidates = collectCandidates(homepage);

  for (const candidate of candidates) {
    if (pages.length >= AUDITOR_MAX_PAGES) break;
    const key = normalizePageUrl(candidate.url);
    if (fetched.has(key)) continue;
    if (!sameOrigin(homepage.url, candidate.url)) continue;
    fetched.add(key);
    try {
      const page = await fetchInspectedPage(candidate.url, candidate.kind, http, lookup);
      pages.push(page);
    } catch (error) {
      pages.push({
        url: candidate.url,
        kind: candidate.kind,
        status: null,
        ok: false,
        elapsedMs: null,
        truncated: false,
        https: candidate.url.startsWith("https://"),
        isPdf: isPdfResource(candidate.url, null, ""),
        error: errorMessage(error),
        signals: null,
      });
    }
  }

  const linkChecks: AuditLinkCheck[] = [];
  const extra = collectLinkChecks(homepage, pages, fetched);
  for (const item of extra.slice(0, AUDITOR_MAX_LINK_CHECKS)) {
    try {
      const result = await fetchFollowingRedirects(item.url, http, bounds(), lookup);
      linkChecks.push({
        url: item.url,
        kind: item.kind,
        status: result.status,
        ok: result.status >= 200 && result.status < 400,
        external: item.external,
      });
    } catch (error) {
      linkChecks.push({
        url: item.url,
        kind: item.kind,
        status: null,
        ok: false,
        external: item.external,
      });
      if (isBlockedCode(errorMessage(error))) {
        // Recorded; do not continue into the blocked destination.
      }
    }
  }

  return {
    targetUrl: websiteUrl,
    finalHomepageUrl: homepage.url,
    homepageOk: homepage.ok,
    blockedReason: null,
    error: homepage.error,
    pages,
    linkChecks,
    pagesFetched: pages.length,
    linkChecksPerformed: linkChecks.length,
  };
}

async function fetchInspectedPage(
  url: string,
  kind: AuditPageKind,
  http: SafeHttpClient,
  lookup?: DnsLookup,
): Promise<InspectedPage> {
  const result = await fetchFollowingRedirects(url, http, bounds(), lookup);
  const pdf = isPdfResource(result.url, result.contentType, result.body);
  const ok = result.status >= 200 && result.status < 400;
  return {
    url: result.url,
    kind,
    status: result.status,
    ok,
    elapsedMs: result.elapsedMs,
    truncated: result.truncated,
    https: result.url.startsWith("https://"),
    isPdf: pdf,
    error: result.truncated ? "truncated" : ok ? null : `http_${result.status}`,
    signals: pdf
      ? null
      : extractPageSignals(result.body, result.url, result.status, result.elapsedMs),
  };
}

function collectCandidates(
  homepage: InspectedPage,
): Array<{ url: string; kind: AuditPageKind; weight: number }> {
  const signals = homepage.signals;
  if (!signals) return [];
  const raw: Array<{ href: string | null; kind?: AuditPageKind }> = [
    { href: signals.contactLink, kind: "contact" },
    { href: signals.menuLink, kind: "menu" },
    { href: signals.servicesLink, kind: "services" },
    { href: signals.reservationLink, kind: "reservations" },
    { href: signals.orderLink, kind: "order" },
    { href: signals.aboutLink, kind: "about" },
    ...signals.sameOriginHrefs.map((href) => ({ href })),
    ...signals.sameSiteHrefs.map((href) => ({ href })),
  ];

  const ranked: Array<{ url: string; kind: AuditPageKind; weight: number }> = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item.href || !isFetchableHref(item.href)) continue;
    const resolved = resolveHref(homepage.url, item.href);
    if (!resolved) continue;
    const key = normalizePageUrl(resolved);
    if (seen.has(key) || key === normalizePageUrl(homepage.url)) continue;
    seen.add(key);
    const classified = classifyPageKind(resolved);
    ranked.push({
      url: resolved,
      kind: item.kind ?? classified.kind,
      weight: item.kind ? classified.weight + 20 : classified.weight,
    });
  }
  return ranked.sort((a, b) => b.weight - a.weight);
}

function collectLinkChecks(
  homepage: InspectedPage,
  pages: InspectedPage[],
  fetched: Set<string>,
): Array<{ url: string; kind: AuditPageKind | "external"; external: boolean }> {
  const signals = homepage.signals;
  if (!signals) return [];
  const wanted: Array<{ href: string | null; kind: AuditPageKind }> = [
    { href: signals.menuLink, kind: "menu" },
    { href: signals.reservationLink, kind: "reservations" },
    { href: signals.orderLink, kind: "order" },
    { href: signals.contactLink, kind: "contact" },
  ];
  const checks: Array<{ url: string; kind: AuditPageKind | "external"; external: boolean }> = [];
  for (const item of wanted) {
    if (!item.href || !isFetchableHref(item.href)) continue;
    const resolved = resolveHref(homepage.url, item.href);
    if (!resolved) continue;
    if (fetched.has(normalizePageUrl(resolved))) continue;
    if (pages.some((page) => normalizePageUrl(page.url) === normalizePageUrl(resolved))) continue;
    checks.push({
      url: resolved,
      kind: sameOrigin(homepage.url, resolved) ? item.kind : "external",
      external: !sameOrigin(homepage.url, resolved),
    });
  }
  return checks;
}

function errorMessage(error: unknown): string {
  if (error instanceof SafeFetchError) {
    if (error.code === "blocked") return error.message;
    if (error.message && error.message !== error.code) return error.message;
    return error.code;
  }
  if (error instanceof Error) return error.message;
  return "network";
}

export function isBlockedCode(code: string): boolean {
  return (
    code.startsWith("blocked") ||
    code === "non_http_scheme" ||
    code === "userinfo_blocked" ||
    code === "invalid_url" ||
    code === "missing_hostname"
  );
}
