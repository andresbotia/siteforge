import { resolveMonotonicLeadStatus } from "@/lib/scout/status";
import { BUILDER_VERSION } from "./limits";
import { assertNoBuilderSideEffects, builderPaidAiPath } from "./policy";
import { composeWebsiteSpec } from "./spec";
import { selectTemplate, templateLabel } from "./templates";
import { validateWebsiteSpec } from "./validate";
import type { BuilderAuditInput, BuilderLeadInput, BuilderPipelineResult } from "./types";

export function runBuilderPipeline(
  lead: BuilderLeadInput,
  audit: BuilderAuditInput,
): BuilderPipelineResult {
  assertNoBuilderSideEffects();
  if (builderPaidAiPath() !== "not_required") {
    throw new Error("builder_paid_ai_not_required");
  }
  if (!lead.businessName.trim()) throw new Error("missing_business_name");

  const template = selectTemplate(lead.industry);
  const spec = composeWebsiteSpec(lead, audit, template);
  const validated = validateWebsiteSpec(spec);
  if (!validated.ok) throw new Error(validated.error);

  const nextStatus = resolveMonotonicLeadStatus(lead.status, "website_built");
  const summary =
    audit.opportunityType === "new_website"
      ? `Deterministic ${BUILDER_VERSION} standalone website draft using ${templateLabel(template)}. No crawled audit was used.`
      : `Deterministic ${BUILDER_VERSION} draft using ${templateLabel(template)}. ${spec.auditFixes.filter((item) => item.addressed).length} audit fixes addressed.`;

  return {
    version: BUILDER_VERSION,
    paidAi: "not_required",
    costUsd: 0,
    leadId: lead.id,
    nextStatus,
    spec: validated.spec,
    template,
    templateLabel: templateLabel(template),
    summary,
  };
}
