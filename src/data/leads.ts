import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { mutateTable, readTable } from "@/lib/supabase/server";
import { asNumber, asRecord, asStringArray } from "@/lib/json";
import {
  MANUAL_PUBLIC_PROSPECT_SOURCE,
  validateManualPublicProspect,
  type ManualPublicProspectInput,
} from "@/lib/prospects/manual-public";
import { getSupabaseServerConfigIssue } from "@/lib/supabase/config";
import type {
  AuditFinding,
  AuditCategory,
  AuditSeverity,
  Industry,
  InspectedUrlSummary,
  Lead,
  LeadStatus,
  QualificationTier,
  WebsiteAudit,
} from "@/types";
import type { AgentRunRow, AuditRow, LeadRow } from "@/types/database";
import type { ExistingLeadRecord } from "@/lib/scout/types";

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

function asExistingLead(row: LeadRow): ExistingLeadRecord {
  return {
    id: row.id,
    businessName: row.business_name,
    websiteUrl: row.website_url,
    phone: row.phone,
    city: row.city,
    status: row.status,
    notes: row.notes,
    normalizedDomain: row.normalized_domain,
    normalizedPhone: row.normalized_phone,
  };
}

const auditCategories = new Set<AuditCategory>(["technical", "seo", "ux", "content"]);
const auditSeverities = new Set<AuditSeverity>(["info", "low", "medium", "high", "critical"]);

function mapFinding(value: unknown): AuditFinding | null {
  const row = asRecord(value);
  const category = String(row.category ?? "");
  const severity = String(row.severity ?? "");
  if (!auditCategories.has(category as AuditCategory)) return null;
  if (!auditSeverities.has(severity as AuditSeverity)) return null;
  return {
    category: category as AuditCategory,
    code: String(row.code ?? "unknown"),
    title: String(row.title ?? "Finding"),
    severity: severity as AuditSeverity,
    evidence: String(row.evidence ?? ""),
    affectedUrl: typeof row.affected_url === "string" ? row.affected_url : null,
    recommendation: String(row.recommendation ?? ""),
    confidence: asNumber(row.confidence) ?? 0.5,
  };
}

function mapInspectedUrl(value: unknown): InspectedUrlSummary | null {
  const row = asRecord(value);
  if (typeof row.url !== "string") return null;
  return {
    url: row.url,
    kind: String(row.kind ?? "other"),
    status: asNumber(row.status),
    ok: row.ok === true,
  };
}

function mapOpportunityBreakdown(value: unknown): WebsiteAudit["redesignOpportunityBreakdown"] {
  const row = asRecord(value);
  const score = asNumber(row.score);
  const components = Array.isArray(row.components)
    ? row.components.flatMap((component) => {
        const item = asRecord(component);
        const componentScore = asNumber(item.score);
        if (typeof item.id !== "string" || typeof item.label !== "string" || componentScore === null) {
          return [];
        }
        return [{
          id: item.id,
          label: item.label,
          score: componentScore,
          positiveEvidence: asStringArray(item.positiveEvidence),
          negativeEvidence: asStringArray(item.negativeEvidence),
          unknownEvidence: asStringArray(item.unknownEvidence),
        }];
      })
    : [];
  if (score === null || components.length === 0) return null;
  return { score, components };
}

export function mapAudit(
  row: AuditRow,
  runOutput?: AgentRunRow["output"] | null,
): WebsiteAudit {
  const findings = Array.isArray(row.findings)
    ? row.findings.flatMap((item) => {
        const mapped = mapFinding(item);
        return mapped ? [mapped] : [];
      })
    : [];
  const inspectedUrls = Array.isArray(row.inspected_urls)
    ? row.inspected_urls.flatMap((item) => {
        const mapped = mapInspectedUrl(item);
        return mapped ? [mapped] : [];
      })
    : [];
  return {
    id: row.id,
    leadId: row.lead_id,
    overallScore: row.overall_score ?? 0,
    designScore: row.design_score ?? 0,
    mobileScore: row.mobile_score ?? 0,
    seoScore: row.seo_score ?? 0,
    performanceScore: row.performance_score ?? 0,
    conversionScore: row.conversion_score,
    technicalScore: row.technical_score,
    uxScore: row.ux_score,
    contentScore: row.content_score,
    redesignOpportunityScore: row.redesign_opportunity_score,
    redesignOpportunityBreakdown: mapOpportunityBreakdown(
      asRecord(runOutput).redesign_opportunity_breakdown,
    ),
    issues: asStringArray(row.issues),
    recommendations: asStringArray(row.recommendations),
    summary: row.summary,
    findings,
    inspectedUrls,
    auditVersion: row.audit_version,
    sourceRunId: row.source_run_id,
    pagesInspected: row.pages_inspected ?? 0,
    websiteUrl: row.website_url,
    createdAt: row.created_at,
  };
}

async function getRunOutput(runId: string | null): Promise<AgentRunRow["output"] | null> {
  if (!runId) return null;
  const run = await readTable<Pick<AgentRunRow, "output"> | null>((client) =>
    client.from("agent_runs").select("output").eq("id", runId).maybeSingle(),
  );
  return run?.output ?? null;
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

export type ManualPublicProspectImportResult =
  | { ok: true; leadId: string; duplicate: boolean }
  | { ok: false; error: string };

export async function createManualPublicProspect(
  input: ManualPublicProspectInput,
): Promise<ManualPublicProspectImportResult> {
  const configIssue = getSupabaseServerConfigIssue();
  if (configIssue) {
    console.error("Manual public prospect import blocked", configIssue.code);
    return { ok: false, error: configIssue.message };
  }

  const existingRows = await readTable<LeadRow[]>((client) =>
    client.from("leads").select("*"),
  );
  const validation = await validateManualPublicProspect(
    input,
    (existingRows ?? []).map(asExistingLead),
  );
  if (!validation.ok) return validation;

  const { business, duplicateId, sourceNote } = validation.draft;
  if (duplicateId) {
    return { ok: true, leadId: duplicateId, duplicate: true };
  }

  const row = await mutateTable<LeadRow | null>((client) =>
    client
      .from("leads")
      .insert({
        business_name: business.name,
        industry: business.industry,
        address: business.address ?? null,
        city: business.city,
        state: business.state,
        phone: business.phone ?? null,
        website_url: business.websiteUrl ?? null,
        google_rating: null,
        review_count: 0,
        status: "discovered",
        lead_score: null,
        source: MANUAL_PUBLIC_PROSPECT_SOURCE,
        notes: sourceNote,
        normalized_domain: business.normalizedDomain,
        normalized_phone: business.normalizedPhone,
        qualification_tier: "review",
        business_strength_score: null,
        website_opportunity_score: null,
        overall_qualification_score: null,
        qualification_reasons: [
          "Manual public prospect imported for M9.5B validation",
          "No outreach, payment, paid AI, or production deployment executed",
        ],
        inspection_summary: {
          source: MANUAL_PUBLIC_PROSPECT_SOURCE,
          public_data_only: true,
          website_inspection: "pending_auditor",
        },
        discovered_at: new Date().toISOString(),
        last_scout_run_id: null,
      })
      .select("*")
      .maybeSingle(),
  );

  if (!row) {
    console.error("Manual public prospect import insert returned no row");
    return { ok: false, error: "Could not import public prospect." };
  }

  await recordActivityEvent({
    eventType: "manual_public_prospect_imported",
    title: "Manual public prospect imported",
    description:
      "M9.5B public-data-only prospect created. No outreach, payment, paid AI, or production deployment ran.",
    actorType: "admin",
    leadId: row.id,
    metadata: {
      source: MANUAL_PUBLIC_PROSPECT_SOURCE,
      normalized_domain: business.normalizedDomain ?? "",
      public_data_only: true,
    },
  });

  return { ok: true, leadId: row.id, duplicate: false };
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
  if (!row) return null;
  return mapAudit(row, await getRunOutput(row.source_run_id));
}

export async function getAuditById(id: string): Promise<WebsiteAudit | null> {
  const row = await readTable<AuditRow | null>((client) =>
    client.from("website_audits").select("*").eq("id", id).maybeSingle(),
  );
  if (!row) return null;
  return mapAudit(row, await getRunOutput(row.source_run_id));
}

export async function listAuditsForLead(leadId: string): Promise<WebsiteAudit[]> {
  const rows = await readTable<AuditRow[]>((client) =>
    client
      .from("website_audits")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false }),
  );
  return (rows ?? []).map(mapAudit);
}
