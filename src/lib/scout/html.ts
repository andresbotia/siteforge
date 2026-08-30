import type { PageSignals } from "./types";

type ModernizationSignal = PageSignals["modernizationSignals"][number];

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
  const modernizationSignals = collectModernizationSignals(html, url, lower);

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
    modernizationSignals,
    sameSiteHrefs: [...new Set(sameSiteHrefs)].slice(0, 20),
    sameOriginHrefs: [...new Set(sameOriginHrefs)].slice(0, 40),
  };
}

function collectModernizationSignals(
  html: string,
  url: string,
  lowerHtml: string,
): ModernizationSignal[] {
  const signals: ModernizationSignal[] = [];

  addLegacyUrlSignal(signals, url);
  const generatorTag = html.match(/<meta\b[^>]*(?:name|property)=["']generator["'][^>]*>/i)?.[0];
  const generator = generatorTag ? attr(generatorTag, "content") : null;
  if (generator && /frontpage|dreamweaver|microsoft visual studio|joomla!?\s*[123]\b|drupal\s*[567]\b|wordpress\s*[1-4]\./i.test(generator)) {
    signals.push({
      code: "legacy_generator_marker",
      title: "Legacy generator marker detected",
      evidence: `Generator metadata includes "${generator.slice(0, 80)}".`,
      strength: "medium",
    });
  }

  const deprecatedCount = countMatches(
    html,
    /<(?:font|center|marquee|frameset|frame)\b|<[^>]+\s(?:bgcolor|align|valign|border|cellpadding|cellspacing)=/gi,
  );
  if (deprecatedCount >= 3) {
    signals.push({
      code: "deprecated_markup",
      title: "Deprecated or presentation-heavy markup detected",
      evidence: `${deprecatedCount} legacy presentation markup patterns were detected.`,
      strength: deprecatedCount >= 8 ? "high" : "medium",
    });
  }

  const tableCount = countMatches(html, /<table\b/gi);
  const semanticCount = countMatches(html, /<(?:main|section|article|header|footer|nav)\b/gi);
  if (tableCount >= 3 && tableCount > semanticCount) {
    signals.push({
      code: "table_layout",
      title: "Table-heavy page structure detected",
      evidence: `${tableCount} table elements and ${semanticCount} semantic layout elements were detected.`,
      strength: tableCount >= 6 ? "high" : "medium",
    });
  }

  const inlineStyleCount = countMatches(html, /\sstyle=["'][^"']{20,}["']/gi);
  if (inlineStyleCount >= 8) {
    signals.push({
      code: "excessive_inline_style",
      title: "Excessive inline styling detected",
      evidence: `${inlineStyleCount} substantial inline style attributes were detected.`,
      strength: inlineStyleCount >= 20 ? "high" : "medium",
    });
  }

  const legacyScriptCount = countMatches(
    lowerHtml,
    /jquery-migrate|jquery-[12]\.|prototype\.js|scriptaculous|mootools|swfobject|\.swf\b|pngfix|ie6|ie7|ie8|document\.write/gi,
  );
  if (legacyScriptCount >= 1) {
    signals.push({
      code: "legacy_script_pattern",
      title: "Legacy script pattern detected",
      evidence: `${legacyScriptCount} legacy script/plugin pattern${legacyScriptCount === 1 ? "" : "s"} detected.`,
      strength: legacyScriptCount >= 3 ? "high" : "medium",
    });
  }

  const legacyHrefCount = countMatches(
    html,
    /href=["'][^"']+\.(?:aspx?|php|cfm)(?:[?#][^"']*)?["']/gi,
  );
  if (legacyHrefCount >= 3) {
    signals.push({
      code: "fragmented_legacy_urls",
      title: "Fragmented legacy URL patterns detected",
      evidence: `${legacyHrefCount} internal links use legacy file-style URL paths.`,
      strength: legacyHrefCount >= 8 ? "high" : "medium",
    });
  }

  return dedupeModernizationSignals(signals);
}

function addLegacyUrlSignal(signals: ModernizationSignal[], url: string): void {
  try {
    const path = new URL(url).pathname;
    if (/\.(?:aspx?|cfm)(?:\/)?$/i.test(path)) {
      signals.push({
        code: "legacy_url_extension",
        title: "Legacy page URL extension detected",
        evidence: `Inspected URL path uses "${path.slice(-16)}".`,
        strength: "medium",
      });
    }
  } catch {
    // Ignore invalid URLs; SSRF-safe parsing happens before inspection.
  }
}

function countMatches(value: string, pattern: RegExp): number {
  return [...value.matchAll(pattern)].length;
}

function dedupeModernizationSignals(signals: ModernizationSignal[]): ModernizationSignal[] {
  const seen = new Set<string>();
  const out: ModernizationSignal[] = [];
  for (const signal of signals) {
    if (seen.has(signal.code)) continue;
    seen.add(signal.code);
    out.push(signal);
  }
  return out;
}

export function resolveHref(baseUrl: string, href: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}
