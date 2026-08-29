import type { PageSignals } from "./types";

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
  return match ? decode(match[2] ?? match[3] ?? "") : null;
}

export function extractPageSignals(html: string, url: string, status: number, elapsedMs: number): PageSignals {
  const lower = html.toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((item) => item[0]);
  const viewport = metas.some((tag) => (attr(tag, "name") ?? "").toLowerCase() === "viewport");
  const descriptionMeta = metas.find((tag) => {
    const name = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    return name === "description" || name === "og:description";
  });
  const canonicalTag = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  const headings = html.match(/<h[1-3]\b/gi)?.length ?? 0;
  const hasNav = /<nav\b/i.test(html) || /id=["']nav/i.test(html);
  const hasForm = /<form\b/i.test(html);
  const hasPhoneLink = /href=["']tel:/i.test(html);
  const hasContactCta =
    /contact|get a quote|request (a )?quote|book now|call now|schedule/i.test(html);
  const yearMatch = html.match(/©\s*(20\d{2})|(copyright\s+20\d{2})/i);
  const yearRaw = yearMatch?.[1] ?? yearMatch?.[2]?.match(/20\d{2}/)?.[0];
  const copyrightYear = yearRaw ? Number(yearRaw) : null;

  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const sameSiteHrefs: string[] = [];
  let menuLink: string | null = null;
  let menuLooksLikePdf = false;
  let reservationLink: string | null = null;
  let orderLink: string | null = null;

  for (const [, href, label] of anchors) {
    const text = `${decode(label)} ${href}`.toLowerCase();
    if (!href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      sameSiteHrefs.push(href);
    }
    if (!menuLink && /menu|our food|dinner|lunch/.test(text)) {
      menuLink = href;
      menuLooksLikePdf = /\.pdf(\?|$)/i.test(href) || text.includes("pdf");
    }
    if (!reservationLink && /reserv|opentable|resy|book a table/.test(text)) {
      reservationLink = href;
    }
    if (!orderLink && /order online|online order|toasttab|doordash|ubereats|grubhub/.test(text)) {
      orderLink = href;
    }
  }

  return {
    url,
    status,
    https: url.startsWith("https://"),
    elapsedMs,
    title: titleMatch ? decode(titleMatch[1]).slice(0, 200) || null : null,
    metaDescription: descriptionMeta ? attr(descriptionMeta, "content") : null,
    hasViewport: viewport,
    hasCanonical: Boolean(canonicalTag),
    headingCount: headings,
    hasNav,
    hasPhoneLink,
    hasForm,
    hasContactCta,
    copyrightYear: Number.isFinite(copyrightYear) ? copyrightYear : null,
    menuLink,
    menuLooksLikePdf,
    reservationLink,
    orderLink,
    mentionsMenu: /menu/.test(lower),
    mentionsReservations: /reserv|book a table/.test(lower),
    mentionsOrdering: /order online|online ordering|delivery/.test(lower),
    sameSiteHrefs: [...new Set(sameSiteHrefs)].slice(0, 20),
  };
}

export function resolveHref(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
