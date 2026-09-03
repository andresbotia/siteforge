import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { syncWorkItemsForLead } from "@/data/work-items";
import { mutateTable, readTable } from "@/lib/supabase/server";
import { asNumber, asRecord, asStringArray } from "@/lib/json";
import {
  MANUAL_PUBLIC_PROSPECT_SOURCE,
  validateManualPublicProspect,
  type ManualPublicProspectInput,
} from "@/lib/prospects/manual-public";
import {
  canTransitionLeadStatus,
  isLeadStatus as isLifecycleLeadStatus,
  normalizeArchivedReason,
} from "@/lib/leads/lifecycle";
import {
  isNoStandaloneWebsiteSummary,
  noStandaloneWebsiteSummary,
} from "@/lib/prospects/no-website";
import { normalizeSuggestedDomain } from "@/lib/prospects/suggested-domain";
import {
  buildVerifiedPublicFactsInspectionSummary,
  readVerifiedPublicFacts,
  validateVerifiedPublicFacts,
  type VerifiedPublicFactKey,
  type VerifiedPublicFactsInput,
} from "@/lib/prospects/verified-public-facts";
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
import type { AgentRunRow, AuditRow, Json, LeadRow } from "@/types/database";
import type { ExistingLeadRecord } from "@/lib/scout/types";

function isLeadStatus(value: string): value is LeadStatus {
  return isLifecycleLeadStatus(value);
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
  const noStandaloneWebsite = isNoStandaloneWebsiteSummary(row.inspection_summary);
  const inspectionSummary = Object.keys(asRecord(row.inspection_summary)).length
    ? asRecord(row.inspection_summary)
    : null;
  const verifiedPublicFacts = readVerifiedPublicFacts(inspectionSummary);
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
    websiteStatus: noStandaloneWebsite
      ? "no_standalone_website"
      : row.website_url
        ? "has_website"
        : "unknown",
    rating: Number(row.google_rating ?? 0),
    reviewCount: row.review_count,
    websiteScore: derivedWebsiteScore,
    leadScore: row.overall_qualification_score ?? row.lead_score ?? 0,
    status: isLeadStatus(row.status) ? row.status : "discovered",
    archivedReason: row.archived_reason,
    archivedAt: row.archived_at,
    suggestedDomain: row.suggested_domain,
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
    inspectionSummary,
    verifiedPublicFacts: verifiedPublicFacts
      ? (verifiedPublicFacts as unknown as Record<string, unknown>)
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
  | { ok: false; error: string; field?: keyof ManualPublicProspectInput };

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

  const { business, duplicateId, sourceNote, noStandaloneWebsite } = validation.draft;
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
        status: noStandaloneWebsite ? "qualified" : "discovered",
        lead_score: noStandaloneWebsite ? 100 : null,
        source: MANUAL_PUBLIC_PROSPECT_SOURCE,
        notes: sourceNote,
        normalized_domain: business.normalizedDomain,
        normalized_phone: business.normalizedPhone,
        qualification_tier: noStandaloneWebsite ? "high_priority" : "review",
        business_strength_score: null,
        website_opportunity_score: noStandaloneWebsite ? 100 : null,
        overall_qualification_score: noStandaloneWebsite ? 100 : null,
        qualification_reasons: noStandaloneWebsite
          ? [
              "Operator manually verified no standalone business website",
              "Explicit new website opportunity; not a crawled redesign audit",
              "No outreach, payment, paid AI, or production deployment executed",
            ]
          : [
              "Manual public prospect imported for M9.5B validation",
              "No outreach, payment, paid AI, or production deployment executed",
            ],
        inspection_summary: noStandaloneWebsite
          ? {
              source: MANUAL_PUBLIC_PROSPECT_SOURCE,
              ...noStandaloneWebsiteSummary(),
            }
          : {
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
      noStandaloneWebsite
        ? "M9.5D public-data-only no-website prospect created. No outreach, payment, paid AI, or production deployment ran."
        : "M9.5B public-data-only prospect created. No outreach, payment, paid AI, or production deployment ran.",
    actorType: "admin",
    leadId: row.id,
    metadata: {
      source: MANUAL_PUBLIC_PROSPECT_SOURCE,
      normalized_domain: business.normalizedDomain ?? "",
      public_data_only: true,
      no_standalone_website: noStandaloneWebsite,
    },
  });

  return { ok: true, leadId: row.id, duplicate: false };
}

export type VerifiedPublicFactsUpdateResult =
  | { ok: true }
  | { ok: false; error: string; field?: VerifiedPublicFactKey };

export async function updateLeadVerifiedPublicFacts(
  input: { leadId: string; facts: VerifiedPublicFactsInput },
): Promise<VerifiedPublicFactsUpdateResult> {
  const configIssue = getSupabaseServerConfigIssue();
  if (configIssue) {
    console.error("Verified public facts update blocked", configIssue.code);
    return { ok: false, error: configIssue.message };
  }

  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", input.leadId).maybeSingle(),
  );
  if (!lead) return { ok: false, error: "Lead was not found." };

  const validation = await validateVerifiedPublicFacts(input.facts);
  if (!validation.ok) return validation;

  const facts = validation.summary.facts;
  const nextSummary = buildVerifiedPublicFactsInspectionSummary(
    lead.inspection_summary,
    validation.summary,
  );

  await mutateTable((client) =>
    client
      .from("leads")
      .update({
        inspection_summary: nextSummary as Json,
        google_rating: facts.rating,
        review_count: facts.reviewCount ?? 0,
      })
      .eq("id", lead.id)
      .select("id")
      .maybeSingle(),
  );

  await recordActivityEvent({
    eventType: "verified_public_facts_updated",
    title: "Verified public facts updated",
    description:
      "Operator attached bounded manually verified public facts for Builder enrichment.",
    actorType: "admin",
    leadId: lead.id,
    metadata: {
      source_type: validation.summary.source_type,
      fields: Object.entries(facts)
        .filter(([, value]) => value !== null)
        .map(([field]) => field),
    },
  });

  return { ok: true };
}

/**
 * The only operator-driven lead status write. Every rule lives in
 * `src/lib/leads/lifecycle.ts`; this function adds persistence plus the
 * archived-reason bookkeeping the table demands (the database enforces the
 * same rule independently via leads_archived_reason_check).
 */
export async function updateLeadLifecycleStatus(input: {
  leadId: string;
  nextStatus: string;
  archivedReason?: string | null;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const lead = await readTable<LeadRow | null>((client) =>
    client.from("leads").select("*").eq("id", input.leadId).maybeSingle(),
  );
  if (!lead) return { ok: false, error: "Lead was not found." };

  const archivedReason = normalizeArchivedReason(input.archivedReason);
  const transition = canTransitionLeadStatus(lead.status, input.nextStatus, { archivedReason });
  if (!transition.ok) return transition;
  if (lead.status === input.nextStatus) return { ok: true, status: lead.status };

  const now = new Date().toISOString();
  const archiving = input.nextStatus === "archived";
  // The only edge out of `archived` is `archived -> contacted` (M10 Task 0):
  // clear the archive bookkeeping so an un-archived lead carries no stale reason.
  const unarchiving = lead.status === "archived" && input.nextStatus !== "archived";
  const updated = await mutateTable<Pick<LeadRow, "id"> | null>((client) =>
    client
      .from("leads")
      .update({
        status: input.nextStatus,
        archived_reason: archiving ? archivedReason : unarchiving ? null : lead.archived_reason,
        archived_at: archiving ? now : unarchiving ? null : lead.archived_at,
      })
      .eq("id", lead.id)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not update the lead status." };

  await recordActivityEvent({
    eventType: archiving ? "lead_archived" : "lead_status_changed",
    title: archiving ? "Lead archived" : "Lead status changed",
    description: archiving
      ? `${lead.business_name}: archived (${archivedReason ?? "no reason"})`
      : `${lead.business_name}: ${lead.status} -> ${input.nextStatus}`,
    actorType: "admin",
    leadId: lead.id,
    metadata: {
      from_status: lead.status,
      to_status: input.nextStatus,
      archived_reason: archivedReason ?? "",
    },
  });

  // M10: a lifecycle change can open (interested -> confirm_intent) or resolve
  // (archived/customer) work items.
  await syncWorkItemsForLead(lead.id).catch(() => {});

  return { ok: true, status: input.nextStatus };
}

/**
 * Operator-supplied example domain. SiteForge never checks or claims
 * availability -- see src/lib/prospects/suggested-domain.ts.
 */
export async function updateLeadSuggestedDomain(input: {
  leadId: string;
  suggestedDomain: string;
}): Promise<{ ok: true; suggestedDomain: string | null } | { ok: false; error: string }> {
  const parsed = normalizeSuggestedDomain(input.suggestedDomain);
  if (!parsed.ok) return parsed;

  const updated = await mutateTable<Pick<LeadRow, "id"> | null>((client) =>
    client
      .from("leads")
      .update({ suggested_domain: parsed.domain })
      .eq("id", input.leadId)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Lead was not found." };

  await recordActivityEvent({
    eventType: "lead_suggested_domain_updated",
    title: parsed.domain ? "Suggested domain saved" : "Suggested domain cleared",
    description: parsed.domain
      ? `Operator-supplied example domain: ${parsed.domain} (availability not checked by SiteForge)`
      : "Operator cleared the suggested domain.",
    actorType: "admin",
    leadId: input.leadId,
    metadata: { suggested_domain: parsed.domain ?? "" },
  });

  return { ok: true, suggestedDomain: parsed.domain };
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
