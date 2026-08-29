import type { Json } from "@/types/database";
import { BUILDER_VERSION } from "./limits";
import type { BuilderPipelineResult } from "./types";

export type GeneratedWebsiteInsert = {
  id: string;
  lead_id: string;
  status: "review_required";
  template: string;
  template_key: string;
  preview_url: string;
  production_url: null;
  seo_score: number | null;
  spec: Json;
  build_version: string;
  source_audit_id: string | null;
  source_run_id: string;
  audit_fixes: Json;
  content_provenance: Json;
  metadata: Json;
};

export function buildGeneratedWebsiteInsert(input: {
  result: BuilderPipelineResult;
  websiteId: string;
  auditId: string | null;
  runId: string;
  beforeScore: number | null;
}): GeneratedWebsiteInsert {
  const { result, websiteId, auditId, runId, beforeScore } = input;
  return {
    id: websiteId,
    lead_id: result.leadId,
    status: "review_required",
    template: result.templateLabel,
    template_key: result.template,
    preview_url: `/websites/${websiteId}/preview`,
    production_url: null,
    seo_score: null,
    spec: result.spec as unknown as Json,
    build_version: BUILDER_VERSION,
    source_audit_id: auditId,
    source_run_id: runId,
    audit_fixes: result.spec.auditFixes as unknown as Json,
    content_provenance: result.spec.provenance as unknown as Json,
    metadata: {
      before_score: beforeScore,
      after_score: null,
      paid_ai: "not_required",
      cost_usd: 0,
    },
  };
}

export function buildBuilderToolCalls(result: BuilderPipelineResult): Array<{
  tool: string;
  action: string;
  request: Json;
  response: Json;
}> {
  return [
    {
      tool: "validate",
      action: "lead_and_audit",
      request: { lead_id: result.leadId },
      response: { template: result.template },
    },
    {
      tool: "select_template",
      action: "allowlist",
      request: { family: result.template },
      response: { template: result.template, label: result.templateLabel },
    },
    {
      tool: "compose_spec",
      action: "deterministic_spec",
      request: { version: result.version },
      response: {
        pages: result.spec.pages.map((page) => page.id),
        sections: result.spec.pages[0]?.sections.map((section) => section.type) ?? [],
      },
    },
    {
      tool: "map_audit_fixes",
      action: "audit_to_draft",
      request: { paid_ai: "not_required" },
      response: {
        fixes: result.spec.auditFixes.length,
        addressed: result.spec.auditFixes.filter((item) => item.addressed).length,
      },
    },
    {
      tool: "persist",
      action: "insert_generated_website",
      request: { lead_id: result.leadId, next_status: result.nextStatus },
      response: { immutable_history: true, cost_usd: 0 },
    },
  ];
}
