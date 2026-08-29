import type { PageSignals } from "@/lib/scout/types";
import { isHomeServiceIndustry, isRestaurantIndustry } from "./industry";
import { AUDIT_SCORING } from "./scoring";
import type {
  AuditFinding,
  AuditLinkCheck,
  AuditorLeadInput,
  CrawlResult,
  InspectedPage,
} from "./types";

function finding(
  input: Omit<AuditFinding, "confidence"> & { confidence?: number },
): AuditFinding {
  return {
    ...input,
    confidence: input.confidence ?? AUDIT_SCORING.confidence.structural,
  };
}

export function collectFindings(
  crawl: CrawlResult,
  lead: AuditorLeadInput,
): AuditFinding[] {
  if (!lead.websiteUrl) {
    return [
      finding({
        category: "technical",
        code: "no_website",
        title: "No website URL on the lead",
        severity: "critical",
        evidence: `${lead.businessName} has no website URL stored, so Auditor could not inspect a live site.`,
        affectedUrl: null,
        recommendation: "A SiteForge site would fill a complete website gap.",
      }),
    ];
  }

  if (crawl.pages.length === 0) {
    const reason = crawl.blockedReason
      ? `Fetch blocked (${crawl.blockedReason})`
      : crawl.error ?? "network";
    return [
      finding({
        category: "technical",
        code: "homepage_unreachable",
        title: "Homepage is unreachable",
        severity: "critical",
        evidence: `Could not retrieve ${lead.websiteUrl}: ${reason}.`,
        affectedUrl: lead.websiteUrl,
        recommendation: "Confirm the public URL is correct. An unreachable site is a strong redesign candidate.",
      }),
    ];
  }

  const homepage = crawl.pages.find((page) => page.kind === "home") ?? crawl.pages[0];
  const findings: AuditFinding[] = [];
  findings.push(...inspectTechnical(crawl, homepage));
  findings.push(...inspectSeo(crawl, homepage, lead));
  findings.push(...inspectUx(crawl, homepage, lead));
  findings.push(...inspectContent(crawl, homepage));
  if (isRestaurantIndustry(lead.industry)) {
    findings.push(...inspectRestaurant(crawl, homepage));
  }
  if (isHomeServiceIndustry(lead.industry)) {
    findings.push(...inspectHomeService(crawl, homepage, lead));
  }
  return dedupeFindings(findings);
}

function inspectTechnical(crawl: CrawlResult, homepage: InspectedPage): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;

  if (!homepage.ok) {
    findings.push(
      finding({
        category: "technical",
        code: "homepage_unreachable",
        title: "Homepage is unreachable",
        severity: "critical",
        evidence: `Homepage ${homepage.url} returned ${homepage.status ?? homepage.error ?? "no response"}.`,
        affectedUrl: homepage.url,
        recommendation: "Restore a working public homepage or replace the site.",
      }),
    );
    return findings;
  }

  if (home && !home.https) {
    findings.push(
      finding({
        category: "technical",
        code: "http_not_https",
        title: "Site is not served over HTTPS",
        severity: "high",
        evidence: `Homepage URL is ${homepage.url}.`,
        affectedUrl: homepage.url,
        recommendation: "Serve the site over HTTPS with a valid certificate.",
      }),
    );
  }

  if (home && !home.hasViewport) {
    findings.push(
      finding({
        category: "technical",
        code: "missing_viewport",
        title: "Missing viewport meta tag",
        severity: "high",
        evidence: "Homepage contains no viewport meta tag.",
        affectedUrl: homepage.url,
        recommendation: "Add a mobile viewport meta tag so the layout can adapt to phones.",
      }),
    );
  }

  if (home?.looksMalformed) {
    findings.push(
      finding({
        category: "technical",
        code: "malformed_html",
        title: "Page HTML looks structurally incomplete",
        severity: "low",
        evidence: "Homepage HTML does not include a basic html/body document structure.",
        affectedUrl: homepage.url,
        recommendation: "Serve a complete HTML document.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (homepage.truncated) {
    findings.push(
      finding({
        category: "technical",
        code: "excessive_page_size",
        title: "Homepage exceeded the response-size cap",
        severity: "medium",
        evidence: "The bounded fetch truncated the homepage body before it finished.",
        affectedUrl: homepage.url,
        recommendation: "Reduce homepage payload size (images, scripts, HTML).",
      }),
    );
  }

  if ((homepage.elapsedMs ?? 0) >= AUDIT_SCORING.slowMs) {
    findings.push(
      finding({
        category: "technical",
        code: "slow_response",
        title: "Homepage response is obviously slow",
        severity: "medium",
        evidence: `Homepage took ${homepage.elapsedMs}ms to respond (threshold ${AUDIT_SCORING.slowMs}ms).`,
        affectedUrl: homepage.url,
        recommendation: "Investigate server and asset performance.",
      }),
    );
  }

  const importantBroken = importantFailures(crawl).filter((item) =>
    ["contact", "services", "about", "location"].includes(item.kind),
  );
  for (const item of importantBroken) {
    findings.push(
      finding({
        category: "technical",
        code: "broken_important_link",
        title: "Important navigation target is broken",
        severity: "high",
        evidence: `${item.kind} link ${item.url} returned ${item.status ?? "no response"}.`,
        affectedUrl: item.url,
        recommendation: "Repair the broken link or point it at a working page.",
      }),
    );
  }

  if (crawl.error === "too_many_redirects") {
    findings.push(
      finding({
        category: "technical",
        code: "redirect_limit",
        title: "Redirect limit exceeded",
        severity: "medium",
        evidence: `Fetch stopped after ${AUDITOR_MAX_REDIRECTS_LABEL} redirects.`,
        affectedUrl: homepage.url,
        recommendation: "Shorten the redirect chain.",
      }),
    );
  }

  return findings;
}

const AUDITOR_MAX_REDIRECTS_LABEL = 4;

function inspectSeo(
  crawl: CrawlResult,
  homepage: InspectedPage,
  lead: AuditorLeadInput,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;
  if (!home) return findings;

  if (!home.title) {
    findings.push(
      finding({
        category: "seo",
        code: "missing_title",
        title: "Missing document title",
        severity: "high",
        evidence: "Homepage has no usable <title> text.",
        affectedUrl: homepage.url,
        recommendation: "Add a descriptive title that includes the business name and city.",
      }),
    );
  } else if (home.title.trim().length < AUDIT_SCORING.weakTitleChars) {
    findings.push(
      finding({
        category: "seo",
        code: "weak_title",
        title: "Document title is too short to be useful",
        severity: "low",
        evidence: `Homepage title is "${home.title}".`,
        affectedUrl: homepage.url,
        recommendation: "Write a longer, specific title.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (!home.metaDescription) {
    findings.push(
      finding({
        category: "seo",
        code: "missing_meta_description",
        title: "Missing meta description",
        severity: "medium",
        evidence: "Homepage has no description or og:description meta tag.",
        affectedUrl: homepage.url,
        recommendation: "Add a concise meta description of services and location.",
      }),
    );
  }

  if (home.h1Count === 0) {
    findings.push(
      finding({
        category: "seo",
        code: "missing_h1",
        title: "Missing H1 heading",
        severity: "high",
        evidence: "Homepage contains no H1 heading.",
        affectedUrl: homepage.url,
        recommendation: "Add a single H1 that names the business or primary service.",
      }),
    );
  } else if (home.h1Count > 1) {
    findings.push(
      finding({
        category: "seo",
        code: "multiple_h1",
        title: "Multiple H1 headings on the homepage",
        severity: "low",
        evidence: `Homepage has ${home.h1Count} H1 elements.`,
        affectedUrl: homepage.url,
        recommendation: "Keep a single primary H1.",
      }),
    );
  }

  if (home.visibleTextLength > 400 && home.h2Count === 0) {
    findings.push(
      finding({
        category: "seo",
        code: "weak_heading_hierarchy",
        title: "Weak heading hierarchy",
        severity: "low",
        evidence: "Homepage has substantial text but no H2 headings.",
        affectedUrl: homepage.url,
        recommendation: "Use H2/H3 headings to structure services and location content.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (!home.hasCanonical) {
    findings.push(
      finding({
        category: "seo",
        code: "missing_canonical",
        title: "Missing canonical URL",
        severity: "low",
        evidence: "Homepage has no rel=canonical link.",
        affectedUrl: homepage.url,
        recommendation: "Add a canonical URL to the homepage.",
      }),
    );
  }

  const titles = crawl.pages
    .map((page) => page.signals?.title?.trim().toLowerCase() ?? null)
    .filter((title): title is string => Boolean(title));
  const uniqueTitles = new Set(titles);
  if (titles.length >= 2 && uniqueTitles.size === 1) {
    findings.push(
      finding({
        category: "seo",
        code: "duplicate_title",
        title: "Duplicate titles across inspected pages",
        severity: "medium",
        evidence: `Every inspected HTML page uses the title "${crawl.pages.find((p) => p.signals?.title)?.signals?.title}".`,
        affectedUrl: homepage.url,
        recommendation: "Give each important page a distinct title.",
      }),
    );
  }

  const localHint = lead.city ? new RegExp(escapeRegExp(lead.city), "i") : null;
  const localOnSite = crawl.pages.some((page) => {
    const textUrl = `${page.signals?.title ?? ""} ${page.url}`;
    return (
      Boolean(page.signals?.hasAddressOrLocation) ||
      Boolean(localHint && localHint.test(textUrl))
    );
  });
  if (!localOnSite) {
    findings.push(
      finding({
        category: "seo",
        code: "weak_local_signals",
        title: "Weak local-business signals",
        severity: "medium",
        evidence: lead.city
          ? `Inspected pages do not clearly mention ${lead.city} or an address.`
          : "Inspected pages do not show a business address or location.",
        affectedUrl: homepage.url,
        recommendation: "Add city, address, and service-area copy on the homepage or a location page.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  return findings;
}

function inspectUx(
  crawl: CrawlResult,
  homepage: InspectedPage,
  lead: AuditorLeadInput,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;
  if (!home) return findings;

  const contactPage = crawl.pages.find((page) => page.kind === "contact" && page.ok);
  const hasObviousCta =
    home.hasContactCta ||
    home.hasPhoneLink ||
    home.hasForm ||
    home.hasMailto ||
    Boolean(home.reservationLink) ||
    Boolean(home.orderLink) ||
    Boolean(contactPage);

  if (!hasObviousCta) {
    findings.push(
      finding({
        category: "ux",
        code: "missing_cta",
        title: "No obvious contact or conversion CTA",
        severity: "high",
        evidence: "Homepage has no contact CTA, phone link, form, or reachable contact page.",
        affectedUrl: homepage.url,
        recommendation: "Place a clear call, quote, or contact action above the fold.",
      }),
    );
  }

  const contactTarget = [...crawl.pages, ...asPagesFromChecks(crawl.linkChecks)].find(
    (item) => item.kind === "contact" && !item.ok,
  );
  if (contactTarget) {
    findings.push(
      finding({
        category: "ux",
        code: "broken_cta",
        title: "Contact path is broken",
        severity: "high",
        evidence: `Contact link ${contactTarget.url} is not reachable.`,
        affectedUrl: contactTarget.url,
        recommendation: "Fix the contact navigation target.",
      }),
    );
  }

  if (
    !home.hasPhoneLink &&
    (home.hasPlainPhoneText || Boolean(lead.phone))
  ) {
    findings.push(
      finding({
        category: "ux",
        code: "phone_not_clickable",
        title: "Phone number is not a clickable tel: link",
        severity: "medium",
        evidence: home.hasPlainPhoneText
          ? "A phone number appears as plain text on the homepage, with no tel: link."
          : "Lead has a phone number but the homepage has no tel: link.",
        affectedUrl: homepage.url,
        recommendation: "Wrap the phone number in a tel: link for mobile tap-to-call.",
        confidence: home.hasPlainPhoneText
          ? AUDIT_SCORING.confidence.structural
          : AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (!home.hasNav && home.sameSiteHrefs.length < 2) {
    findings.push(
      finding({
        category: "ux",
        code: "weak_navigation",
        title: "Weak site navigation",
        severity: "medium",
        evidence: "Homepage has no <nav> and very few internal links.",
        affectedUrl: homepage.url,
        recommendation: "Add a clear navigation to contact, services, and about pages.",
      }),
    );
  }

  const importantMissing = ["contact", "services", "menu"].filter((kind) => {
    const linked = crawl.pages.some((page) => page.kind === kind) ||
      Boolean(
        (kind === "contact" && home.contactLink) ||
          (kind === "services" && home.servicesLink) ||
          (kind === "menu" && home.menuLink),
      );
    return !linked;
  });
  if (importantMissing.includes("contact") && !home.hasForm && !home.hasPhoneLink) {
    findings.push(
      finding({
        category: "ux",
        code: "contact_hard_to_find",
        title: "Contact information is difficult to find",
        severity: "high",
        evidence: "No contact page, phone link, or form was detected on the homepage.",
        affectedUrl: homepage.url,
        recommendation: "Surface phone, form, or a dedicated contact page from the homepage.",
      }),
    );
  }

  if (home.copyrightYear && home.copyrightYear <= currentYear() - AUDIT_SCORING.staleCopyrightYears) {
    findings.push(
      finding({
        category: "ux",
        code: "stale_copyright",
        title: "Copyright year looks stale",
        severity: "low",
        evidence: `Homepage copyright year is ${home.copyrightYear}.`,
        affectedUrl: homepage.url,
        recommendation: "Update footer dates and review other stale content.",
      }),
    );
  }

  if (!home.hasViewport) {
    findings.push(
      finding({
        category: "ux",
        code: "poor_mobile_metadata",
        title: "Poor mobile metadata",
        severity: "medium",
        evidence: "Homepage contains no viewport meta tag.",
        affectedUrl: homepage.url,
        recommendation: "Add viewport metadata so the site can be used on phones.",
      }),
    );
  }

  return findings;
}

function inspectContent(
  crawl: CrawlResult,
  homepage: InspectedPage,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;
  if (!home) return findings;

  const combinedText = crawl.pages.reduce(
    (sum, page) => sum + (page.signals?.visibleTextLength ?? 0),
    0,
  );
  if (home.visibleTextLength < AUDIT_SCORING.thinTextChars && combinedText < AUDIT_SCORING.thinTextChars * 2) {
    findings.push(
      finding({
        category: "content",
        code: "thin_service_information",
        title: "Service information is thin",
        severity: "medium",
        evidence: `Homepage visible text is ${home.visibleTextLength} characters.`,
        affectedUrl: homepage.url,
        recommendation: "Describe services, location, and how to get in touch in plain language.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (!home.hasAddressOrLocation && !crawl.pages.some((page) => page.signals?.hasAddressOrLocation)) {
    findings.push(
      finding({
        category: "content",
        code: "missing_location_information",
        title: "Location information is missing",
        severity: "medium",
        evidence: "Inspected pages do not show an address or clear location statement.",
        affectedUrl: homepage.url,
        recommendation: "Publish the business address or city service area.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  if (home.hasPlaceholderText) {
    findings.push(
      finding({
        category: "content",
        code: "placeholder_text",
        title: "Placeholder or default text detected",
        severity: "medium",
        evidence: "Homepage contains placeholder copy such as lorem ipsum or coming soon.",
        affectedUrl: homepage.url,
        recommendation: "Replace template placeholder copy with real business content.",
      }),
    );
  }

  return findings;
}

function inspectRestaurant(
  crawl: CrawlResult,
  homepage: InspectedPage,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;
  if (!home) return findings;

  const menuPage = crawl.pages.find((page) => page.kind === "menu");
  const menuCheck = crawl.linkChecks.find((item) => item.kind === "menu");
  const menuOk = Boolean(menuPage?.ok || menuCheck?.ok);
  const menuPdf = home.menuLooksLikePdf || Boolean(menuPage?.isPdf);

  if (!home.menuLink && !home.mentionsMenu && !menuPage) {
    findings.push(
      finding({
        category: "content",
        code: "restaurant_menu_missing",
        title: "Menu is not discoverable",
        severity: "high",
        evidence: "Homepage has no menu link or menu mention in the inspected navigation.",
        affectedUrl: homepage.url,
        recommendation: "Add an HTML menu page linked from the primary navigation.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  } else if (home.menuLink && !menuOk && (menuPage || menuCheck)) {
    findings.push(
      finding({
        category: "technical",
        code: "restaurant_menu_broken",
        title: "Menu link is broken",
        severity: "high",
        evidence: `Menu navigation target returned HTTP ${menuPage?.status ?? menuCheck?.status ?? "unknown"}.`,
        affectedUrl: menuPage?.url ?? menuCheck?.url ?? home.menuLink,
        recommendation: "Repair the menu URL so guests can see what you serve.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  } else if (menuPdf && menuOk) {
    findings.push(
      finding({
        category: "content",
        code: "restaurant_menu_pdf",
        title: "Menu is presented as a PDF",
        severity: "medium",
        evidence: `Menu target ${menuPage?.url ?? home.menuLink} looks like a PDF rather than an HTML page.`,
        affectedUrl: menuPage?.url ?? home.menuLink,
        recommendation: "Publish an HTML menu for mobile readability, in addition to or instead of a PDF.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (!home.hasHours && !crawl.pages.some((page) => page.signals?.hasHours)) {
    findings.push(
      finding({
        category: "content",
        code: "restaurant_hours_missing",
        title: "Hours are not discoverable",
        severity: "medium",
        evidence: "Inspected pages do not show opening hours.",
        affectedUrl: homepage.url,
        recommendation: "Publish hours on the homepage or contact page.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (!home.hasPhoneLink && !home.hasPlainPhoneText) {
    findings.push(
      finding({
        category: "ux",
        code: "restaurant_phone_missing",
        title: "Phone number is not visible on the homepage",
        severity: "medium",
        evidence: "No tel: link or phone pattern was detected on the restaurant homepage.",
        affectedUrl: homepage.url,
        recommendation: "Show a tap-to-call phone number near the primary CTA.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (home.mentionsReservations || home.reservationLink) {
    const reservation = reservationTarget(crawl, home);
    if (reservation && !reservation.ok) {
      findings.push(
        finding({
          category: "ux",
          code: "restaurant_reservation_broken",
          title: "Reservation path is broken",
          severity: "high",
          evidence: `Reservation link ${reservation.url} returned ${reservation.status ?? "no response"}.`,
          affectedUrl: reservation.url,
          recommendation: "Fix the reservation URL or remove the broken booking CTA.",
          confidence: AUDIT_SCORING.confidence.industry,
        }),
      );
    } else if (home.mentionsReservations && !home.reservationLink) {
      findings.push(
        finding({
          category: "ux",
          code: "restaurant_reservation_unclear",
          title: "Reservations are mentioned without a working path",
          severity: "medium",
          evidence: "Homepage mentions reservations but no reservation link was found.",
          affectedUrl: homepage.url,
          recommendation: "Link the reservation CTA to a working booking page.",
          confidence: AUDIT_SCORING.confidence.industry,
        }),
      );
    }
  }

  if (home.mentionsOrdering || home.orderLink) {
    const order = orderTarget(crawl, home);
    if (order && !order.ok) {
      findings.push(
        finding({
          category: "ux",
          code: "restaurant_order_broken",
          title: "Online ordering path is broken",
          severity: "high",
          evidence: `Ordering link ${order.url} returned ${order.status ?? "no response"}.`,
          affectedUrl: order.url,
          recommendation: "Fix the ordering URL or remove the broken order CTA.",
          confidence: AUDIT_SCORING.confidence.industry,
        }),
      );
    }
  }

  return findings;
}

function inspectHomeService(
  crawl: CrawlResult,
  homepage: InspectedPage,
  lead: AuditorLeadInput,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const home = homepage.signals;
  if (!home) return findings;

  if (!home.hasPhoneLink && !home.hasContactCta && !home.hasForm) {
    findings.push(
      finding({
        category: "ux",
        code: "home_service_phone_cta_missing",
        title: "Home-service contact CTA is missing",
        severity: "high",
        evidence: "Homepage has no tel: link, quote CTA, or form.",
        affectedUrl: homepage.url,
        recommendation: "Add a persistent call or quote CTA.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  const servicesPage = crawl.pages.find((page) => page.kind === "services" && page.ok);
  if (!home.servicesLink && !servicesPage && home.visibleTextLength < 500) {
    findings.push(
      finding({
        category: "content",
        code: "home_service_services_undiscoverable",
        title: "Services are hard to discover",
        severity: "medium",
        evidence: "No services page was found and homepage copy is thin.",
        affectedUrl: homepage.url,
        recommendation: "List core services on the homepage and a dedicated services page.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (!home.hasServiceArea && !crawl.pages.some((page) => page.signals?.hasServiceArea)) {
    findings.push(
      finding({
        category: "content",
        code: "home_service_area_missing",
        title: "Service area is not described",
        severity: "medium",
        evidence: lead.city
          ? `Inspected pages do not describe a service area (expected local signal for ${lead.city}).`
          : "Inspected pages do not describe a service area.",
        affectedUrl: homepage.url,
        recommendation: "State the cities or neighborhoods you serve.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (home.mentionsEmergency && !home.hasPhoneLink && !home.hasContactCta) {
    findings.push(
      finding({
        category: "ux",
        code: "home_service_emergency_cta_missing",
        title: "Emergency service is claimed without a clear CTA",
        severity: "medium",
        evidence: "The site mentions emergency service but has no phone or quote CTA.",
        affectedUrl: homepage.url,
        recommendation: "Add a prominent emergency call button if emergency service is offered.",
        confidence: AUDIT_SCORING.confidence.industry,
      }),
    );
  }

  if (!home.hasForm && !crawl.pages.some((page) => page.signals?.hasForm)) {
    findings.push(
      finding({
        category: "ux",
        code: "home_service_contact_form_missing",
        title: "No contact form was detected",
        severity: "low",
        evidence: "Inspected pages do not include a <form>.",
        affectedUrl: homepage.url,
        recommendation: "Add a simple quote or contact form as a second conversion path.",
        confidence: AUDIT_SCORING.confidence.heuristic,
      }),
    );
  }

  return findings;
}

function importantFailures(crawl: CrawlResult): Array<{ url: string; kind: string; status: number | null }> {
  const fromPages = crawl.pages
    .filter((page) => !page.ok && page.kind !== "home" && page.kind !== "other")
    .map((page) => ({ url: page.url, kind: page.kind, status: page.status }));
  const fromChecks = crawl.linkChecks
    .filter((item) => !item.ok && item.kind !== "other" && item.kind !== "external")
    .map((item) => ({ url: item.url, kind: item.kind, status: item.status }));
  const seen = new Set<string>();
  const out: Array<{ url: string; kind: string; status: number | null }> = [];
  for (const item of [...fromPages, ...fromChecks]) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function asPagesFromChecks(checks: AuditLinkCheck[]): Array<{ kind: string; ok: boolean; url: string }> {
  return checks.map((item) => ({ kind: item.kind, ok: item.ok, url: item.url }));
}

function reservationTarget(crawl: CrawlResult, home: PageSignals) {
  return (
    crawl.pages.find((page) => page.kind === "reservations") ??
    crawl.linkChecks.find((item) => item.kind === "reservations") ??
    (home.reservationLink ? { url: home.reservationLink, ok: true, status: null } : null)
  );
}

function orderTarget(crawl: CrawlResult, home: PageSignals) {
  return (
    crawl.pages.find((page) => page.kind === "order") ??
    crawl.linkChecks.find((item) => item.kind === "order") ??
    (home.orderLink ? { url: home.orderLink, ok: true, status: null } : null)
  );
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dedupeFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  const out: AuditFinding[] = [];
  for (const item of findings) {
    const key = `${item.code}:${item.affectedUrl ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
