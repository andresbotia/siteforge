import "server-only";

import { readTable } from "@/lib/supabase/server";
import { asRecord, asStringArray } from "@/lib/json";
import type { Industry, Lead, LeadStatus, QualificationTier, WebsiteAudit } from "@/types";
import type { AuditRow, LeadRow } from "@/types/database";

const leadStatuses = new Set<LeadStatus>([
  "discovered",
  "qualified",
  "audited",
  "website_built",
  "approved",
  "contacted",
  "interested",
  "customer",
  "rejected",
]);

function isLeadStatus(value: string): value is LeadStatus {
  return leadStatuses.has(value as LeadStatus);
}

const qualificationTiers = new Set<QualificationTier>([
  "reject",
  "review",
  "qualified",
  "high_priority",
]);

function mapLead(row: LeadRow, websiteScore = 0): Lead {
  const city = row.city ?? "";
  const state = row.state ?? "";
  const opportunity = row.website_opportunity_score;
  const derivedWebsiteScore =
    opportunity === null || opportunity === undefined
      ? websiteScore
      : Math.max(0, 100 - opportunity);
  const tier = row.qualification_tier;
  return {
    id: row.id,
    businessName: row.business_name,
    industry: (row.industry as Industry) ?? "Plumbing",
    location: [city, state].filter(Boolean).join(", "),
    city,
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website_url ?? "",
    rating: Number(row.google_rating ?? 0),
    reviewCount: row.review_count,
    websiteScore: derivedWebsiteScore,
    leadScore: row.overall_qualification_score ?? row.lead_score ?? 0,
    status: isLeadStatus(row.status) ? row.status : "discovered",
    createdAt: row.created_at,
    qualificationTier:
      tier && qualificationTiers.has(tier as QualificationTier)
        ? (tier as QualificationTier)
        : null,
    businessStrengthScore: row.business_strength_score,
    websiteOpportunityScore: row.website_opportunity_score,
    overallQualificationScore: row.overall_qualification_score,
    qualificationReasons: asStringArray(row.qualification_reasons),
    discoverySource: row.source,
    lastScoutRunId: row.last_scout_run_id,
    inspectionSummary: Object.keys(asRecord(row.inspection_summary)).length
      ? asRecord(row.inspection_summary)
      : null,
  };
}

function mapAudit(row: AuditRow): WebsiteAudit {
  return {
    id: row.id,
    leadId: row.lead_id,
    overallScore: row.overall_score ?? 0,
    designScore: row.design_score ?? 0,
    mobileScore: row.mobile_score ?? 0,
    seoScore: row.seo_score ?? 0,
    performanceScore: row.performance_score ?? 0,
    conversionScore: row.conversion_score,
    issues: asStringArray(row.issues),
    recommendations: asStringArray(row.recommendations),
    summary: row.summary,
  };
}

export async function listLeads(): Promise<Lead[]> {
  const [leads, audits] = await Promise.all([
    readTable<LeadRow[]>((client) =>
      client.from("leads").select("*").order("created_at", { ascending: false }),
    ),
    readTable<Pick<AuditRow, "lead_id" | "overall_score" | "created_at">[]>(
      (client) =>
        client
          .from("website_audits")
          .select("lead_id, overall_score, created_at")
          .order("created_at", { ascending: false }),
    ),
  ]);

  const scoreByLead = new Map<string, number>();
  for (const audit of audits ?? []) {
    if (!scoreByLead.has(audit.lead_id)) {
      scoreByLead.set(audit.lead_id, audit.overall_score ?? 0);
    }
  }

  return (leads ?? []).map((lead) =>
    mapLead(lead, scoreByLead.get(lead.id) ?? 0),
  );
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", id).maybeSingle(),
  );
  if (!lead) return null;

  const audit = await getLatestAuditForLead(id);
  return mapLead(lead, audit?.overallScore ?? 0);
}

export async function getLatestAuditForLead(
  leadId: string,
): Promise<WebsiteAudit | null> {
  const row = await readTable<AuditRow | null>((client) =>
    client
      .from("website_audits")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  return row ? mapAudit(row) : null;
}
