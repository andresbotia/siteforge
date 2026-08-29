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

function stripTags(value: string): string {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractPageSignals(
  html: string,
  url: string,
  status: number,
  elapsedMs: number,
): PageSignals {
  const lower = html.toLowerCase();
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((item) => item[0]);
  const viewport = metas.some((tag) => (attr(tag, "name") ?? "").toLowerCase() === "viewport");
  const descriptionMeta = metas.find((tag) => {
    const name = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
    return name === "description" || name === "og:description";
  });
  const canonicalTag =
    html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ??
    html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0] ??
    null;
  const canonicalHref = canonicalTag ? attr(canonicalTag, "href") : null;
  const headings = html.match(/<h[1-3]\b/gi)?.length ?? 0;
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
  const h1Texts = h1Matches
    .map((item) => stripTags(decode(item[1] ?? "")).slice(0, 160))
    .filter(Boolean);
  const h2Count = html.match(/<h2\b/gi)?.length ?? 0;
  const hasNav = /<nav\b/i.test(html) || /id=["']nav/i.test(html);
  const hasForm = /<form\b/i.test(html);
  const hasPhoneLink = /href=["']tel:/i.test(html);
  const hasMailto = /href=["']mailto:/i.test(html);
  const hasContactCta =
    /contact|get a quote|request (a )?quote|book now|call now|schedule/i.test(html);
  const yearMatches = [...html.matchAll(/©\s*(20\d{2})|copyright\s+(20\d{2})/gi)];
  const years = yearMatches
    .map((item) => Number(item[1] ?? item[2]))
    .filter((year) => Number.isFinite(year));
  const copyrightYear = years.length > 0 ? Math.min(...years) : null;

  const visibleText = stripTags(html);
  const hasHours = /\b(hours|open daily|mon(?:day)?\b.*\b(?:tue|wed|thu|fri|sat|sun)|am[\s–-]+pm|\d{1,2}:\d{2}\s*(am|pm))\b/i.test(
    visibleText,
  );
  const hasAddressOrLocation =
    /\b(address|located|directions|fort lauderdale|coconut creek|boca raton|pompano|coral springs|\d{3,5}\s+\w+\s+(st|street|ave|avenue|rd|road|blvd|boulevard))\b/i.test(
      visibleText,
    );
  const hasServiceArea = /\b(service area|serving|we serve|areas we (cover|serve)|coverage area)\b/i.test(
    visibleText,
  );
  const mentionsEmergency = /\b(emergency|24\/7|24-hour|after[- ]hours)\b/i.test(visibleText);
  const hasPlaceholderText =
    /lorem ipsum|coming soon|your company name|insert text|placeholder text|sample text/i.test(
      html,
    );
  const hasPlainPhoneText = /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(visibleText);
  const looksMalformed = !/<html\b/i.test(html) && !/<body\b/i.test(html) && html.trim().length > 0;

  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const sameSiteHrefs: string[] = [];
  const sameOriginHrefs: string[] = [];
  let menuLink: string | null = null;
  let menuLooksLikePdf = false;
  let reservationLink: string | null = null;
  let orderLink: string | null = null;
  let contactLink: string | null = null;
  let servicesLink: string | null = null;
  let aboutLink: string | null = null;

  let origin: string | null = null;
  try {
    origin = new URL(url).origin;
  } catch {
    origin = null;
  }

  for (const [, href, label] of anchors) {
    const text = `${decode(label)} ${href}`.toLowerCase();
    if (!href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("tel:")) {
      sameSiteHrefs.push(href);
    }
    const resolved = resolveHref(url, href);
    if (resolved && origin) {
      try {
        if (new URL(resolved).origin === origin) {
          sameOriginHrefs.push(resolved);
        }
      } catch {
        // ignore invalid
      }
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
    if (!contactLink && /\bcontact\b|get in touch|reach us/.test(text)) {
      contactLink = href;
    }
    if (!servicesLink && /\bservices?\b|what we do/.test(text)) {
      servicesLink = href;
    }
    if (!aboutLink && /\babout\b|our story|our team/.test(text)) {
      aboutLink = href;
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
    canonicalHref,
    headingCount: headings,
    h1Count: h1Matches.length,
    h1Texts,
    h2Count,
    hasNav,
    hasPhoneLink,
    hasMailto,
    hasForm,
    hasContactCta,
    copyrightYear: Number.isFinite(copyrightYear) ? copyrightYear : null,
    menuLink,
    menuLooksLikePdf,
    reservationLink,
    orderLink,
    contactLink,
    servicesLink,
    aboutLink,
    mentionsMenu: /menu/.test(lower),
    mentionsReservations: /reserv|book a table/.test(lower),
    mentionsOrdering: /order online|online ordering|delivery/.test(lower),
    visibleTextLength: visibleText.length,
    hasHours,
    hasAddressOrLocation,
    hasServiceArea,
    mentionsEmergency,
    hasPlaceholderText,
    hasPlainPhoneText,
    looksMalformed,
    sameSiteHrefs: [...new Set(sameSiteHrefs)].slice(0, 20),
    sameOriginHrefs: [...new Set(sameOriginHrefs)].slice(0, 40),
  };
}

export function resolveHref(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
