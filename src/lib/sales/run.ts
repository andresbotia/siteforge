import { composeSalesDraft } from "./draft";
import { isLeadEligibleForSales } from "./eligibility";
import { SALES_COST_USD, SALES_VERSION } from "./limits";
import { assertNoSalesSideEffects, salesPaidAiPath } from "./policy";
import type {
  SalesAuditInput,
  SalesLeadInput,
  SalesPipelineResult,
  SalesPreviewInput,
  SalesWebsiteInput,
} from "./types";

export function runSalesPipeline(
  lead: SalesLeadInput,
  audit: SalesAuditInput,
  website: SalesWebsiteInput,
  preview: SalesPreviewInput,
  options?: { senderName?: string; senderEmail?: string; recipientEmailOverride?: string },
): SalesPipelineResult {
  assertNoSalesSideEffects();
  if (salesPaidAiPath() !== "not_required") {
    throw new Error("sales_paid_ai_not_required");
  }
  if (!lead.businessName.trim()) {
    throw new Error("missing_business_name");
  }
  if (!isLeadEligibleForSales(lead, website, preview)) {
    throw new Error("ineligible_for_sales_outreach");
  }

  const draft = composeSalesDraft(lead, audit, website, preview, options);
  const summary = `Deterministic ${SALES_VERSION} outreach draft prepared for ${lead.businessName}. Sourced from audit (${audit.findings?.length ?? 0} findings) and active preview (${preview.tokenHint}).`;

  return {
    version: SALES_VERSION,
    paidAi: "not_required",
    costUsd: SALES_COST_USD,
    leadId: lead.id,
    generatedWebsiteId: website.id,
    previewDeploymentId: preview.id,
    draft,
    summary,
  };
}
