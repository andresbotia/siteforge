"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  cancelDesignerJob,
  createDesignerJobRequest,
  promoteDesignerJobToMaster,
  recordVisualReview,
} from "@/data/designer";
import { getLeadById } from "@/data/leads";
import { businessFactsFromLead, fixtureBusinessFacts } from "@/lib/designer/facts";
import { requireAdminSession } from "@/lib/auth/guard";
import type { Json } from "@/types/database";

export type DesignerActionState = { ok: boolean; error?: string } | null;

export async function requestDesignerJobAction(
  _prev: DesignerActionState,
  formData: FormData,
): Promise<DesignerActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "new_master").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!leadId) return { ok: false, error: "Choose a lead." };
  if (mode !== "new_master" && mode !== "adaptation") return { ok: false, error: "Choose a valid mode." };
  if (!reason) return { ok: false, error: "Explain why this lead needs design work." };

  const lead = await getLeadById(leadId);
  if (!lead) return { ok: false, error: "Lead was not found." };

  const result = await createDesignerJobRequest({
    leadId: lead.id,
    isFixture: false,
    mode,
    reason,
    facts: businessFactsFromLead({
      business_name: lead.businessName,
      industry: lead.industry,
      city: lead.city || null,
      state: lead.location.split(",")[1]?.trim() ?? null,
      address: null,
      phone: lead.phone || null,
      website_url: lead.website || null,
      google_rating: lead.rating || null,
      review_count: lead.reviewCount,
      inspection_summary: lead.inspectionSummary as unknown as Json,
    }),
  });
  if (!result.ok) return result;
  revalidatePath("/agents/designer");
  revalidatePath(`/leads/${leadId}`);
  redirect(`/designer-jobs/${result.job.id}`);
}

export async function createFixtureDesignerJobAction(): Promise<void> {
  const facts = fixtureBusinessFacts({
    businessName: "Coral Ridge Cooling Co.",
    industry: "HVAC repair and installation",
    city: "Fort Lauderdale",
    region: "FL",
    phone: "(954) 555-0142",
    address: "410 NE 20th St, Fort Lauderdale, FL",
  });
  const result = await createDesignerJobRequest({
    leadId: null,
    isFixture: true,
    mode: "new_master",
    reason: "Operator-triggered fixture/QA job. This business is synthetic and must never be promoted to a commercial master.",
    facts,
  });
  revalidatePath("/agents/designer");
  if (result.ok) redirect(`/designer-jobs/${result.job.id}`);
}

export async function recordVisualReviewAction(
  _prev: DesignerActionState,
  formData: FormData,
): Promise<DesignerActionState> {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!jobId) return { ok: false, error: "Missing job id." };
  if (status !== "approved" && status !== "needs_revision" && status !== "rejected") {
    return { ok: false, error: "Choose a valid review outcome." };
  }
  const session = await requireAdminSession();
  const result = await recordVisualReview({ jobId, status, notes, reviewedBy: session.email });
  if (!result.ok) return result;
  revalidatePath(`/designer-jobs/${jobId}`);
  revalidatePath("/agents/designer");
  return { ok: true };
}

export async function cancelDesignerJobAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "").trim();
  if (!jobId) return;
  await cancelDesignerJob(jobId);
  revalidatePath(`/designer-jobs/${jobId}`);
  revalidatePath("/agents/designer");
}

export async function promoteDesignerJobToMasterAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get("jobId") ?? "").trim();
  const masterTemplateKey = String(formData.get("masterTemplateKey") ?? "").trim();
  if (!jobId || !masterTemplateKey) return;
  await promoteDesignerJobToMaster(jobId, masterTemplateKey);
  revalidatePath(`/designer-jobs/${jobId}`);
  revalidatePath("/agents/designer");
}
