export const AUDIT_CATEGORIES = ["technical", "seo", "ux", "content"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_PAGE_KINDS = [
  "home",
  "contact",
  "about",
  "services",
  "menu",
  "reservations",
  "order",
  "location",
  "other",
] as const;
export type AuditPageKind = (typeof AUDIT_PAGE_KINDS)[number];

export type AuditFinding = {
  category: AuditCategory;
  code: string;
  title: string;
  severity: AuditSeverity;
  evidence: string;
  affectedUrl: string | null;
  recommendation: string;
  confidence: number;
};

export type InspectedPage = {
  url: string;
  kind: AuditPageKind;
  status: number | null;
  ok: boolean;
  elapsedMs: number | null;
  truncated: boolean;
  https: boolean;
  isPdf: boolean;
  error: string | null;
  signals: import("@/lib/scout/types").PageSignals | null;
};

export type AuditLinkCheck = {
  url: string;
  kind: AuditPageKind | "external";
  status: number | null;
  ok: boolean;
  external: boolean;
};

export type CrawlResult = {
  targetUrl: string | null;
  finalHomepageUrl: string | null;
  homepageOk: boolean;
  blockedReason: string | null;
  error: string | null;
  pages: InspectedPage[];
  linkChecks: AuditLinkCheck[];
  pagesFetched: number;
  linkChecksPerformed: number;
};

export type AuditScores = {
  technicalScore: number;
  seoScore: number;
  uxScore: number;
  contentScore: number;
  overallAuditScore: number;
  redesignOpportunityScore: number;
};

export type AuditorLeadInput = {
  id: string;
  businessName: string;
  industry: string;
  city: string | null;
  phone: string | null;
  websiteUrl: string | null;
  status: string;
};

export type AuditorPipelineResult = {
  version: string;
  paidAi: "not_required";
  costUsd: 0;
  leadId: string;
  nextStatus: string;
  crawl: CrawlResult;
  findings: AuditFinding[];
  scores: AuditScores;
  summary: string;
  issues: string[];
  recommendations: string[];
};

export type InspectedUrlSummary = {
  url: string;
  kind: string;
  status: number | null;
  ok: boolean;
};
