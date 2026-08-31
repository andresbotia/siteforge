import { mapAuditFixes } from "./audit-fixes";
import { extractFacts, mailtoHref, telHref, type BuilderFacts } from "./facts";
import { BUILDER_VERSION, type PageId, type TemplateKey } from "./limits";
import { derivedServices } from "./services";
import { TEMPLATE_CATALOG } from "./templates";
import type {
  BuilderAuditInput,
  BuilderLeadInput,
  NavItem,
  ProvenanceRecord,
  Section,
  SiteCta,
  SpecPage,
  WebsiteSpec,
} from "./types";

export function composeWebsiteSpec(
  lead: BuilderLeadInput,
  audit: BuilderAuditInput,
  template: TemplateKey,
): WebsiteSpec {
  const facts = extractFacts(lead, audit);
  const palette = TEMPLATE_CATALOG[template].palette;
  const ctas = buildCtas(facts, template);
  const pages = buildPages(facts, template, ctas);
  const navigation: NavItem[] = pages.map((page) => ({
    id: page.id,
    label: navLabel(page.id),
  }));
  const seo = buildSeo(facts);
  const auditFixes = mapAuditFixes(audit, facts, template);
  const provenance: ProvenanceRecord[] = [
    ...facts.provenance,
    { field: "hero.headline", provenance: "derived", source: "template.copy" },
    {
      field: "services",
      provenance: template === "restaurant-modern" ? "omitted" : "derived",
      source: "industry.defaults",
    },
    { field: "seo.title", provenance: "derived", source: "business+industry+city" },
  ];

  return {
    version: BUILDER_VERSION,
    template,
    palette,
    business: {
      name: facts.name,
      industry: facts.industry,
      city: facts.city,
      region: facts.region,
      address: facts.address,
      phone: facts.phone,
      email: facts.email,
      websiteUrl: facts.websiteUrl,
      rating: facts.rating,
      reviewCount: facts.reviewCount,
      description: facts.description,
      cuisine: facts.cuisine,
      hours: facts.hours,
      dailyHours: facts.dailyHours,
      socialUrl: facts.socialUrl,
      socialProfiles: facts.socialProfiles,
      menuUrl: facts.menuLink,
      orderUrl: facts.orderUrl,
      reservationUrl: facts.reservationUrl,
      ratingSource: facts.ratingSource,
      shortName: facts.shortName,
      highlights: facts.highlights,
    },
    assets: { images: facts.images },
    navigation,
    pages,
    seo,
    auditFixes,
    provenance,
  };
}

function navLabel(id: PageId): string {
  if (id === "home") return "Home";
  if (id === "services") return "Services";
  if (id === "about") return "About";
  if (id === "contact") return "Contact";
  return "Menu";
}

function buildCtas(facts: BuilderFacts, template: TemplateKey): SiteCta[] {
  const ctas: SiteCta[] = [];
  if (facts.phone) {
    ctas.push({ kind: "phone", label: `Call ${facts.phone}`, href: telHref(facts.phone) });
  }
  if (facts.emergencyOffered && facts.phone) {
    ctas.push({ kind: "emergency", label: "Emergency service", href: telHref(facts.phone) });
  }
  if (template !== "restaurant-modern") {
    ctas.push({
      kind: "quote",
      label: "Request a quote",
      href: "/contact",
    });
  } else {
    ctas.push({ kind: "contact", label: "Contact", href: "/contact" });
  }
  if (facts.reservationsOffered) {
    ctas.push({
      kind: "reservation",
      label: "Reserve a table",
      href: facts.reservationUrl ?? (facts.phone ? telHref(facts.phone) : "/contact"),
    });
  }
  if (facts.orderingOffered) {
    ctas.push({
      kind: "order",
      label: "Order",
      href: facts.orderUrl ?? (facts.phone ? telHref(facts.phone) : "/contact"),
    });
  }
  if (facts.menuLink) {
    ctas.push({ kind: "menu", label: "View menu", href: facts.menuLink });
  }
  if (facts.socialUrl) {
    ctas.push({ kind: "social", label: "Social", href: facts.socialUrl });
  }
  return ctas;
}

function buildSeo(facts: BuilderFacts): { title: string; description: string } {
  const where = facts.city ? ` in ${facts.city}` : "";
  const category = facts.cuisine ?? facts.industry;
  const title = `${facts.name} | ${category}${where}`;
  const description = facts.description
    ? facts.description
    : facts.city
      ? `${category} from ${facts.name} in ${facts.city}. Contact the business to request service.`
      : `${category} from ${facts.name}. Contact the business to request service.`;
  return { title: title.slice(0, 70), description: description.slice(0, 160) };
}

function fitSpecText(value: string): string {
  return value.slice(0, 400);
}

function buildPages(facts: BuilderFacts, template: TemplateKey, ctas: SiteCta[]): SpecPage[] {
  const header: Section = {
    type: "header",
    businessName: facts.name,
    phone: facts.phone,
    ctas: pickCtas(ctas, template, "hero"),
  };
  const footer: Section = {
    type: "footer",
    businessName: facts.name,
    note: facts.region ?? facts.industry,
  };

  const homeSections: Section[] = [header];
  if (facts.emergencyOffered && facts.phone) {
    homeSections.push({
      type: "announcement",
      text: "Emergency service is available. Call now.",
    });
  }
  homeSections.push({
    type: "hero",
    eyebrow: facts.city
      ? `${facts.cuisine ?? facts.industry} - ${facts.city}`
      : facts.cuisine ?? facts.industry,
    headline: facts.name,
    lede: heroLede(facts, template),
    ctas: pickCtas(ctas, template, "hero"),
  });
  if (facts.rating || facts.reviewCount) {
    homeSections.push({
      type: "trust",
      rating: facts.rating,
      reviewCount: facts.reviewCount,
      note: null,
    });
  }
  if (template !== "restaurant-modern") {
    homeSections.push({
      type: "services",
      heading: "Services",
      items: derivedServices(facts.industry),
    });
  }
  homeSections.push({
    type: "about",
    heading: `About ${facts.name}`,
    body: aboutCopy(facts, template),
  });
  if (facts.city || facts.address) {
    homeSections.push({
      type: "serviceArea",
      heading: template === "restaurant-modern" ? "Find us" : "Service area",
      body: locationCopy(facts, template),
    });
  }
  if (template === "restaurant-modern" && facts.menuLink) {
    homeSections.push({
      type: "menuPreview",
      heading: "Menu",
      body: "See the current menu from the restaurant's published source.",
      href: facts.menuLink,
      label: "View menu",
    });
  }
  if (facts.city || facts.address || facts.hours) {
    homeSections.push({
      type: "hoursLocation",
      heading: "Location",
      location: facts.address ?? facts.region,
      hours: facts.hours,
    });
  }
  homeSections.push({
    type: "cta",
    heading: template === "restaurant-modern" ? "Visit or get in touch" : "Ready to get started?",
    body: facts.phone
      ? `Call ${facts.phone} or use the contact page.`
      : facts.email
        ? "Use the contact page or email the business."
        : "Contact the business for details.",
    ctas: pickCtas(ctas, template, "footerCta"),
  });
  homeSections.push(footer);

  const seo = buildSeo(facts);
  const pages: SpecPage[] = [
    {
      id: "home",
      path: "/",
      title: seo.title,
      description: seo.description,
      sections: homeSections,
    },
  ];

  if (template !== "restaurant-modern") {
    pages.push({
      id: "services",
      path: "/services",
      title: `Services | ${facts.name}`,
      description: `${facts.industry} services from ${facts.name}.`,
      sections: [
        header,
        {
          type: "services",
          heading: "What we can help with",
          items: derivedServices(facts.industry),
        },
        {
          type: "cta",
          heading: "Request a quote",
          body: facts.phone ? `Call ${facts.phone} to talk through the job.` : "Reach out on the contact page.",
          ctas: pickCtas(ctas, template, "footerCta"),
        },
        footer,
      ],
    });
  } else if (facts.menuLink) {
    pages.push({
      id: "menu",
      path: "/menu",
      title: `Menu | ${facts.name}`,
      description: `Menu information for ${facts.name}.`,
      sections: [
        header,
        {
          type: "menuPreview",
          heading: "Menu",
          body: "Open the restaurant's published menu.",
          href: facts.menuLink,
          label: "Open menu source",
        },
        footer,
      ],
    });
  }

  pages.push({
    id: "about",
    path: "/about",
    title: `About | ${facts.name}`,
    description: `About ${facts.name}.`,
    sections: [
      header,
      { type: "about", heading: `About ${facts.name}`, body: aboutCopy(facts, template) },
      footer,
    ],
  });
  pages.push({
    id: "contact",
    path: "/contact",
    title: `Contact | ${facts.name}`,
    description: `Contact ${facts.name}.`,
    sections: [
      header,
      {
        type: "contact",
        heading: "Contact",
        phone: facts.phone,
        email: facts.email,
        location: facts.address ?? facts.region,
      },
      {
        type: "cta",
        heading: facts.phone ? "Call today" : "Get in touch",
        body: facts.phone
          ? `Call ${facts.phone} to get in touch.`
          : facts.email
            ? "Email the business to get in touch."
            : "Contact the business for details.",
        ctas: facts.phone
          ? [{ kind: "phone", label: `Call ${facts.phone}`, href: telHref(facts.phone) }]
          : facts.email
            ? [{ kind: "contact", label: "Email", href: mailtoHref(facts.email) }]
            : [],
      },
      footer,
    ],
  });

  return pages;
}

function heroLede(facts: BuilderFacts, template: TemplateKey): string {
  if (facts.description) return fitSpecText(facts.description);
  if (template === "restaurant-modern") {
    const category = facts.cuisine ?? facts.industry;
    return facts.city ? `${category} in ${facts.city}.` : `${category}.`;
  }
  return facts.city
    ? `Professional ${facts.industry.toLowerCase()} for homes and businesses in ${facts.city}.`
    : `Professional ${facts.industry.toLowerCase()} for local homes and businesses.`;
}

function pickCtas(ctas: SiteCta[], template: TemplateKey, slot: "hero" | "footerCta"): SiteCta[] {
  const order: string[] =
    template === "restaurant-modern"
      ? ["reservation", "order", "menu", "phone", "contact", "social"]
      : ["emergency", "phone", "quote", "contact"];
  const rank = (kind: string) => {
    const index = order.indexOf(kind);
    return index === -1 ? 99 : index;
  };
  return [...ctas]
    .filter((cta) => order.includes(cta.kind))
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .slice(0, slot === "hero" ? 2 : 4);
}

function aboutCopy(facts: BuilderFacts, template: TemplateKey): string {
  if (facts.description) return fitSpecText(facts.description);
  if (template === "restaurant-modern") {
    const category = facts.cuisine ?? facts.industry.toLowerCase();
    return facts.city
      ? `${facts.name} is a ${category} in ${facts.city}.`
      : `${facts.name} is a ${category}.`;
  }
  return facts.city
    ? `${facts.name} provides ${facts.industry.toLowerCase()} in ${facts.city}. Reach out to confirm availability and scheduling.`
    : `${facts.name} provides ${facts.industry.toLowerCase()}. Reach out to confirm availability and scheduling.`;
}

function locationCopy(facts: BuilderFacts, template: TemplateKey): string {
  if (facts.address) {
    const addressIncludesCity =
      Boolean(facts.city) &&
      facts.address.toLowerCase().includes(String(facts.city).toLowerCase());
    return `${facts.name} is listed at ${facts.address}${
      facts.city && !addressIncludesCity ? ` in ${facts.city}` : ""
    }.`;
  }
  const verb = template === "restaurant-modern" ? "is located in" : "serves customers in";
  return `${facts.name} ${verb} ${facts.city}.`;
}
