/**
 * M10.6 Task 1. Operator-run, reversible hygiene pass over the hosted
 * `leads` table: archives seed/fixture rows, Scout experiment rows that never
 * advanced, and leads whose customer conversion used mock Stripe identifiers,
 * so Today and Pipeline show only real work before the first campaign.
 *
 * This is NOT a migration. It never runs automatically, it is not wired into
 * any request path, and it does not touch anything but `leads.status` /
 * `leads.archived_reason` / `leads.archived_at` and `approvals.status` /
 * `approvals.resolved_at` for approvals tied to a lead it archives.
 *
 * Classification is narrow and additive-only in effect: a lead not matching
 * one of the three rules in src/lib/leads/archive-classification.ts is never
 * touched, regardless of how synthetic it looks. Archiving goes through the
 * same `archived -> contacted` lifecycle edge the console UI uses, so it is
 * reversible from `/leads/[id]` with one click.
 *
 * Usage:
 *   npm run leads:archive-stale            (dry run -- reports only, writes nothing)
 *   npm run leads:archive-stale -- --execute   (applies the archive + approval expiry)
 *
 * Connects directly to Supabase with SUPABASE_SECRET_KEY, the same pattern
 * scripts/designer-worker.ts and src/lib/designer/worker-db.ts use: this is a
 * standalone Node process with no HTTP request, so it cannot go through
 * src/lib/supabase/server.ts (that calls requireAdminSession(), which reads a
 * cookie via next/headers) or any module marked "server-only" (which throws
 * unconditionally outside Next's webpack bundling). It is run locally by the
 * operator, who already holds SUPABASE_SECRET_KEY in .env.local like any
 * other server-side SiteForge code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  ARCHIVE_CATEGORY_LABEL,
  classifyLeadForArchival,
  type ArchivableLeadCustomer,
  type ArchiveCategory,
  type ArchiveClassification,
} from "@/lib/leads/archive-classification";
import { canTransitionLeadStatus, normalizeArchivedReason } from "@/lib/leads/lifecycle";
import { inferPaymentEnvironment } from "@/lib/payments/conversion";
import { getSupabaseServerConfigFromEnv } from "@/lib/supabase/config-core";
import type { Database } from "@/types/database";

type LeadRow = {
  id: string;
  business_name: string;
  source: string | null;
  status: string;
  archived_at: string | null;
};

type CustomerRow = {
  id: string;
  lead_id: string | null;
  stripe_customer_id: string | null;
  conversion_metadata: unknown;
};

type ApprovalRow = {
  id: string;
  lead_id: string | null;
  approval_type: string;
  title: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toCustomerInput(row: CustomerRow): ArchivableLeadCustomer {
  const metadata = asRecord(row.conversion_metadata);
  return {
    stripeCustomerId: row.stripe_customer_id,
    checkoutSessionId:
      typeof metadata.checkout_session_id === "string" ? metadata.checkout_session_id : null,
  };
}

async function main(): Promise<void> {
  const execute = process.argv.includes("--execute");

  const config = getSupabaseServerConfigFromEnv(process.env);
  if (!config) {
    console.error(
      "Supabase server config missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must both be set (see .env.local).",
    );
    process.exitCode = 1;
    return;
  }
  const client = createClient<Database>(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: leadsRaw, error: leadsError } = await client
    .from("leads")
    .select("id, business_name, source, status, archived_at")
    .is("archived_at", null);
  if (leadsError) {
    console.error("Failed to read leads:", leadsError.message);
    process.exitCode = 1;
    return;
  }
  const leads = (leadsRaw ?? []) as LeadRow[];

  const { data: customersRaw, error: customersError } = await client
    .from("customers")
    .select("id, lead_id, stripe_customer_id, conversion_metadata");
  if (customersError) {
    console.error("Failed to read customers:", customersError.message);
    process.exitCode = 1;
    return;
  }
  const customerByLeadId = new Map<string, CustomerRow>();
  for (const row of (customersRaw ?? []) as CustomerRow[]) {
    if (row.lead_id) customerByLeadId.set(row.lead_id, row);
  }

  const classifications: ArchiveClassification[] = [];
  const anomalies: Array<{ leadId: string; businessName: string; note: string }> = [];
  let realProvenanceCount = 0;

  for (const lead of leads) {
    const customerRow = customerByLeadId.get(lead.id) ?? null;
    const customerInput = customerRow ? toCustomerInput(customerRow) : null;
    const result = classifyLeadForArchival(
      { id: lead.id, businessName: lead.business_name, source: lead.source, status: lead.status },
      customerInput,
    );
    if (result) {
      classifications.push(result);
      continue;
    }
    realProvenanceCount += 1;

    // Not auto-archived, but flag anything with a customer row that isn't a
    // clean "live"/"unknown" payment for the operator's own eyes -- reported,
    // never acted on. This is deliberately NOT a fourth silent archive rule.
    if (customerInput) {
      const environment = inferPaymentEnvironment({
        stripeCustomerId: customerInput.stripeCustomerId,
        stripeCheckoutSessionId: customerInput.checkoutSessionId?.startsWith("cs_")
          ? customerInput.checkoutSessionId
          : null,
      });
      if (environment === "test") {
        anomalies.push({
          leadId: lead.id,
          businessName: lead.business_name,
          note: `Customer conversion is Stripe TEST-mode (not mock, not live) -- does not match the mock-identifier rule this script was scoped to. Review manually: ${JSON.stringify(customerRow?.conversion_metadata ?? {})}`,
        });
      }
    }
  }

  // --- Report ---
  const byCategory = new Map<ArchiveCategory, ArchiveClassification[]>();
  for (const c of classifications) {
    const list = byCategory.get(c.category) ?? [];
    list.push(c);
    byCategory.set(c.category, list);
  }

  console.log(`\nSiteForge archive-stale-leads -- ${execute ? "EXECUTING" : "DRY RUN"}`);
  console.log(`${leads.length} non-archived leads inspected.\n`);

  for (const [category, list] of byCategory) {
    console.log(`${ARCHIVE_CATEGORY_LABEL[category]} (${list.length}):`);
    for (const item of list) {
      console.log(`  - ${item.businessName}  [${item.leadId}]`);
    }
    console.log("");
  }

  console.log(`Total to archive: ${classifications.length}`);
  console.log(`Real-provenance leads excluded (untouched): ${realProvenanceCount}\n`);

  if (anomalies.length > 0) {
    console.log(`Flagged for manual review (NOT auto-archived, does not match the stated rules):`);
    for (const a of anomalies) {
      console.log(`  - ${a.businessName}  [${a.leadId}]: ${a.note}`);
    }
    console.log("");
  }

  if (classifications.length === 0) {
    console.log("Nothing to archive.");
    return;
  }

  const archivedLeadIds = new Set(classifications.map((c) => c.leadId));
  const { data: pendingApprovalsRaw, error: approvalsError } = await client
    .from("approvals")
    .select("id, lead_id, approval_type, title")
    .eq("status", "pending")
    .not("lead_id", "is", null);
  if (approvalsError) {
    console.error("Failed to read approvals:", approvalsError.message);
    process.exitCode = 1;
    return;
  }
  const approvalsToExpire = ((pendingApprovalsRaw ?? []) as ApprovalRow[]).filter(
    (a) => a.lead_id && archivedLeadIds.has(a.lead_id),
  );

  console.log(`Pending approvals tied to an archived lead, to expire: ${approvalsToExpire.length}`);
  for (const approval of approvalsToExpire) {
    console.log(`  - [${approval.approval_type}] ${approval.title}`);
  }

  if (!execute) {
    console.log("\nDry run only -- nothing was written. Re-run with --execute to apply.");
    return;
  }

  console.log("\nApplying...");
  await archiveLeads(client, leads, classifications);
  await expireApprovals(client, approvalsToExpire);
  console.log(
    `\nDone. ${classifications.length} lead(s) archived, ${approvalsToExpire.length} approval(s) expired.`,
  );
  console.log(
    "Reversible from the console: /leads/[id] -> Lifecycle -> Move lead to \"Contacted\" (the archived -> contacted edge).",
  );
}

async function archiveLeads(
  client: SupabaseClient<Database>,
  leads: LeadRow[],
  classifications: ArchiveClassification[],
): Promise<void> {
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const now = new Date().toISOString();

  for (const c of classifications) {
    const lead = leadById.get(c.leadId);
    if (!lead) continue;
    const reason = normalizeArchivedReason(c.reason);
    const transition = canTransitionLeadStatus(lead.status, "archived", { archivedReason: reason });
    if (!transition.ok) {
      console.error(`  SKIPPED ${lead.business_name}: ${transition.error}`);
      continue;
    }

    const { error } = await client
      .from("leads")
      .update({ status: "archived", archived_reason: reason, archived_at: now })
      .eq("id", lead.id);
    if (error) {
      console.error(`  FAILED to archive ${lead.business_name}: ${error.message}`);
      continue;
    }

    const { error: activityError } = await client.from("activity_events").insert({
      event_type: "lead_archived",
      actor_type: "system",
      actor_id: "scripts/archive-stale-leads.ts",
      lead_id: lead.id,
      title: "Lead archived (data hygiene)",
      description: `${lead.business_name}: archived (${reason ?? "no reason"})`,
      metadata: {
        from_status: lead.status,
        to_status: "archived",
        archived_reason: reason ?? "",
        archive_category: c.category,
      },
    });
    if (activityError) {
      console.error(`  Archived ${lead.business_name} but activity log failed: ${activityError.message}`);
      continue;
    }

    console.log(`  Archived: ${lead.business_name}`);
  }
}

async function expireApprovals(
  client: SupabaseClient<Database>,
  approvals: ApprovalRow[],
): Promise<void> {
  if (approvals.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await client
    .from("approvals")
    .update({ status: "expired", resolved_at: now })
    .in(
      "id",
      approvals.map((a) => a.id),
    )
    .eq("status", "pending");
  if (error) {
    console.error(`  Failed to expire approvals: ${error.message}`);
    return;
  }
  console.log(`  Expired ${approvals.length} pending approval(s) tied to archived leads.`);
}

main().catch((error) => {
  console.error("archive-stale-leads failed:", error);
  process.exitCode = 1;
});
