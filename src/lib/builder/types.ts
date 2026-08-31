import type { PageId, PaletteKey, SectionType, TemplateKey } from "./limits";

export type ContentProvenance = "sourced" | "derived" | "placeholder" | "omitted";

export type ProvenanceRecord = {
  field: string;
  provenance: ContentProvenance;
  source: string | null;
};

export type AuditFix = {
  findingCode: string;
  addressed: boolean;
  builderAction: string;
};

export type NavItem = {
  id: PageId;
  label: string;
};

export type CtaKind =
  | "phone"
  | "quote"
  | "contact"
  | "emergency"
  | "reservation"
  | "order"
  | "menu"
  | "social";

export type SiteCta = {
  kind: CtaKind;
  label: string;
  href: string;
};

export type ServiceItem = {
  name: string;
  summary: string;
};

export type Section =
  | {
      type: "announcement";
      text: string;
    }
  | {
      type: "header";
      businessName: string;
      phone: string | null;
      ctas: SiteCta[];
    }
  | {
      type: "hero";
      eyebrow: string | null;
      headline: string;
      lede: string;
      ctas: SiteCta[];
    }
  | {
      type: "trust";
      rating: number | null;
      reviewCount: number | null;
      note: string | null;
    }
  | {
      type: "services";
      heading: string;
      items: ServiceItem[];
    }
  | {
      type: "about";
      heading: string;
      body: string;
    }
  | {
      type: "serviceArea";
      heading: string;
      body: string;
    }
  | {
      type: "menuPreview";
      heading: string;
      body: string;
      href: string | null;
      label: string | null;
    }
  | {
      type: "hoursLocation";
      heading: string;
      location: string | null;
      hours: string | null;
    }
  | {
      type: "cta";
      heading: string;
      body: string;
      ctas: SiteCta[];
    }
  | {
      type: "contact";
      heading: string;
      phone: string | null;
      email: string | null;
      location: string | null;
    }
  | {
      type: "footer";
      businessName: string;
      note: string;
    };

export type SpecPage = {
  id: PageId;
  path: string;
  title: string;
  description: string;
  sections: Section[];
};

export type WebsiteSpec = {
  version: "builder.v1";
  template: TemplateKey;
  palette: PaletteKey;
  business: {
    name: string;
    industry: string;
    city: string | null;
    region: string | null;
    phone: string | null;
    email: string | null;
    websiteUrl: string | null;
    rating: number | null;
    reviewCount: number | null;
    description: string | null;
    cuisine: string | null;
    hours: string | null;
    socialUrl: string | null;
    menuUrl: string | null;
    orderUrl: string | null;
    reservationUrl: string | null;
  };
  navigation: NavItem[];
  pages: SpecPage[];
  seo: {
    title: string;
    description: string;
  };
  auditFixes: AuditFix[];
  provenance: ProvenanceRecord[];
};

export type BuilderLeadInput = {
  id: string;
  businessName: string;
  industry: string;
  city: string | null;
  state: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  rating: number | null;
  reviewCount: number;
  status: string;
  inspectionSummary: Record<string, unknown> | null;
};

export type BuilderAuditInput = {
  id: string | null;
  overallScore: number | null;
  redesignOpportunityScore: number | null;
  findings: Array<{ code: string; title: string }>;
  opportunityType?: "redesign" | "new_website";
};

export type BuilderPipelineResult = {
  version: string;
  paidAi: "not_required";
  costUsd: 0;
  leadId: string;
  nextStatus: string;
  spec: WebsiteSpec;
  template: TemplateKey;
  templateLabel: string;
  summary: string;
};

export function isSectionType(value: string): value is SectionType {
  return (["announcement", "header", "hero", "trust", "services", "about", "serviceArea", "menuPreview", "hoursLocation", "cta", "contact", "footer"] as const).includes(
    value as SectionType,
  );
}
