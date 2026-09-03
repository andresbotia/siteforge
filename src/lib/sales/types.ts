import type { LeadStatus, PreviewDeploymentStatus } from "@/types";

export type SalesLeadInput = {
  id: string;
  businessName: string;
  industry: string;
  city: string;
  state?: string;
  email?: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  websiteStatus?: "has_website" | "no_standalone_website" | "unknown";
  status: LeadStatus;
  /** Operator-supplied example domain; never an availability claim (M9.9). */
  suggestedDomain?: string | null;
};

export type SalesAuditInput = {
  id: string | null;
  overallScore: number | null;
  redesignOpportunityScore: number | null;
  findings: Array<{ code: string; title: string; category?: string }>;
  issues?: string[];
  opportunityType?: "redesign" | "new_website";
};

export type SalesWebsiteInput = {
  id: string;
  template: string;
  templateKey: string | null;
  auditFixes: Array<{ findingCode: string; addressed: boolean; builderAction: string }>;
};

export type SalesPreviewInput = {
  id: string;
  tokenHint: string;
  status: PreviewDeploymentStatus;
  revokedAt: string | null;
  outreachPublicUrl: string;
  attributionTokenHash: string;
  attributionTokenHint: string;
};

export type SalesEvidenceItem = {
  type: "audit_finding" | "builder_fix" | "preview_link" | "business_fact" | "website_status";
  text: string;
  source?: string;
};

export type SalesDraft = {
  subject: string;
  body: string;
  recipientEmail: string;
  senderName: string;
  senderEmail: string;
  contentHash: string;
  attributionTokenHash: string;
  attributionTokenHint: string;
  evidence: SalesEvidenceItem[];
};

export type SalesPipelineResult = {
  version: string;
  paidAi: "not_required";
  costUsd: number;
  leadId: string;
  generatedWebsiteId: string;
  previewDeploymentId: string;
  draft: SalesDraft;
  summary: string;
};
