import type { SafeHttpClient } from "@/lib/http/fetch";
import type { DnsLookup } from "@/lib/http/ssrf";
import { resolveMonotonicLeadStatus } from "@/lib/scout/status";
import { isNoStandaloneWebsiteLead } from "@/lib/prospects/no-website";
import { crawlWebsite } from "./crawl";
import { collectFindings } from "./findings";
import { AUDITOR_VERSION } from "./limits";
import { assertNoAuditorSideEffects, auditorPaidAiPath } from "./policy";
import { scoreAudit, summarizeAudit } from "./scoring";
import type { AuditorLeadInput, AuditorPipelineResult } from "./types";

export async function runAuditorPipeline(
  lead: AuditorLeadInput,
  deps: { http: SafeHttpClient; lookup?: DnsLookup },
): Promise<AuditorPipelineResult> {
  assertNoAuditorSideEffects();
  if (auditorPaidAiPath() !== "not_required") {
    throw new Error("auditor_paid_ai_not_required");
  }
  if (isNoStandaloneWebsiteLead(lead)) {
    throw new Error("no_standalone_website_not_auditable");
  }

  const crawl = await crawlWebsite(lead.websiteUrl, deps.http, deps.lookup);
  const findings = collectFindings(crawl, lead);
  const scores = scoreAudit(findings, crawl);
  const narrative = summarizeAudit(findings, scores);
  const nextStatus = resolveMonotonicLeadStatus(lead.status, "audited");

  return {
    version: AUDITOR_VERSION,
    paidAi: "not_required",
    costUsd: 0,
    leadId: lead.id,
    nextStatus,
    crawl,
    findings,
    scores,
    summary: narrative.summary,
    issues: narrative.issues,
    recommendations: narrative.recommendations,
  };
}
