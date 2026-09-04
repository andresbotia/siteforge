import "server-only";

import { asRecord } from "@/lib/json";
import { mutateTable, readTable } from "@/lib/supabase/server";
import { deriveDesiredWorkItems, type LeadWorkItemInputs } from "@/lib/work-items/derive";
import {
  WORK_ITEM_NEED,
  WORK_ITEM_PRIORITY,
  isWorkItemType,
  type WorkItemType,
} from "@/lib/work-items/types";
import type {
  ApprovalRow,
  CommercialOfferRow,
  CustomerRow,
  Json,
  LeadRow,
  OutreachEventRow,
  OutreachRow,
  WorkItemRow,
} from "@/types/database";
import { recordActivityEvent } from "./activity";

export type TodayQueueItem = {
  id: string;
  leadId: string;
  businessName: string;
  type: WorkItemType;
  priority: number;
  need: string;
  createdAt: string;
  snoozedUntil: string | null;
};

/** One business and every outstanding (non-snoozed) work item it has open, most-urgent item first. */
export type TodayQueueBusiness = {
  leadId: string;
  businessName: string;
  items: TodayQueueItem[];
};

/**
 * M10.6 Task 2: the cap is seven BUSINESSES, not seven items. A business with
 * three open items used to occupy three of the seven slots by itself; now it
 * occupies one, listing all of its items.
 */
export type TodayQueue = {
  visible: TodayQueueBusiness[];
  hiddenBusinessCount: number;
  hiddenItemCount: number;
  snoozedCount: number;
};

/**
 * Result of a reconcile pass. `changed` is true when the pass inserted or
 * resolved at least one row (the caller can then refresh). `ok` is false when
 * a write did not persist -- `mutateTable` logs and returns null on failure,
 * which would otherwise be invisible; the /today mount action turns `error`
 * into an operator-visible banner.
 */
export type ReconcileResult = {
  ok: boolean;
  changed: boolean;
  error?: string;
};

const VISIBLE_LIMIT = 7;

type LeadBundle = {
  lead: Pick<LeadRow, "id" | "status">;
  latestAuditId: string | null;
  hasWebsite: boolean;
  offers: Array<Pick<CommercialOfferRow, "id" | "status">>;
  outreach: Array<{ id: string; kind: string; status: string }>;
  pendingEmailApprovals: Array<{ id: string; payloadAction: string | null }>;
  customer: Pick<CustomerRow, "id" | "status"> | null;
  websitesAwaitingVisualReview: Array<{ id: string }>;
  designerJobsAwaitingVisualReview: Array<{ id: string }>;
};

async function loadReconcileState() {
  const [
    leads,
    audits,
    websites,
    offers,
    outreach,
    outreachEvents,
    customers,
    approvals,
    workItems,
    designerJobs,
  ] = await Promise.all([
      readTable<Pick<LeadRow, "id" | "status" | "business_name">[]>((client) =>
        client.from("leads").select("id, status, business_name"),
      ),
      readTable<Array<{ id: string; lead_id: string }>>((client) =>
        client
          .from("website_audits")
          .select("id, lead_id")
          .order("created_at", { ascending: false }),
      ),
      readTable<Array<{ id: string; lead_id: string; status: string }>>((client) =>
        client.from("generated_websites").select("id, lead_id, status"),
      ),
      readTable<Pick<CommercialOfferRow, "id" | "lead_id" | "status">[]>((client) =>
        client.from("commercial_offers").select("id, lead_id, status"),
      ),
      readTable<Pick<OutreachRow, "id" | "lead_id" | "kind" | "status">[]>((client) =>
        client.from("outreach").select("id, lead_id, kind, status"),
      ),
      readTable<Pick<OutreachEventRow, "outreach_id" | "event_type">[]>((client) =>
        client.from("outreach_events").select("outreach_id, event_type"),
      ),
      readTable<Pick<CustomerRow, "id" | "lead_id" | "status">[]>((client) =>
        client.from("customers").select("id, lead_id, status"),
      ),
      readTable<Pick<ApprovalRow, "id" | "lead_id" | "payload">[]>((client) =>
        client
          .from("approvals")
          .select("id, lead_id, payload")
          .eq("approval_type", "external_email")
          .eq("status", "pending"),
      ),
      readTable<WorkItemRow[]>((client) => client.from("work_items").select("*")),
      readTable<Array<{ id: string; lead_id: string | null; status: string }>>(
        (client) =>
          client.from("designer_jobs").select("id, lead_id, status"),
      ),
    ]);

  return {
    leads: leads ?? [],
    audits: audits ?? [],
    websites: websites ?? [],
    offers: offers ?? [],
    outreach: outreach ?? [],
    outreachEvents: outreachEvents ?? [],
    customers: customers ?? [],
    approvals: approvals ?? [],
    workItems: workItems ?? [],
    designerJobs: designerJobs ?? [],
  };
}

type ReconcileState = Awaited<ReturnType<typeof loadReconcileState>>;

function bundleForLead(
  state: ReconcileState,
  lead: Pick<LeadRow, "id" | "status">,
): LeadBundle {
  const repliedOutreachIds = new Set(
    state.outreachEvents
      .filter((event) => event.event_type === "replied")
      .map((event) => event.outreach_id),
  );
  const websiteLeadIds = new Set(state.websites.map((row) => row.lead_id));
  const latestAudit = state.audits.find((row) => row.lead_id === lead.id) ?? null;

  return {
    lead,
    latestAuditId: latestAudit?.id ?? null,
    hasWebsite: websiteLeadIds.has(lead.id),
    websitesAwaitingVisualReview: state.websites
      .filter(
        (row) => row.lead_id === lead.id && row.status === "review_required",
      )
      .map((row) => ({ id: row.id })),
    designerJobsAwaitingVisualReview: state.designerJobs
      .filter(
        (row) =>
          row.lead_id === lead.id && row.status === "visual_review_required",
      )
      .map((row) => ({ id: row.id })),
    offers: state.offers.filter((offer) => offer.lead_id === lead.id),
    outreach: state.outreach
      .filter((row) => row.lead_id === lead.id)
      .map((row) => ({
        id: row.id,
        kind: row.kind ?? "cold_outreach",
        status: repliedOutreachIds.has(row.id) ? "replied" : row.status,
      })),
    pendingEmailApprovals: state.approvals
      .filter((row) => row.lead_id === lead.id)
      .map((row) => {
        const payload = asRecord(row.payload);
        return {
          id: row.id,
          payloadAction:
            typeof payload.action === "string" ? payload.action : null,
        };
      }),
    customer: state.customers.find((row) => row.lead_id === lead.id) ?? null,
  };
}

function toInputs(bundle: LeadBundle): LeadWorkItemInputs {
  return {
    lead: { id: bundle.lead.id, status: bundle.lead.status },
    latestAuditId: bundle.latestAuditId,
    hasWebsite: bundle.hasWebsite,
    offers: bundle.offers.map((offer) => ({ id: offer.id, status: offer.status })),
    outreach: bundle.outreach,
    pendingEmailApprovals: bundle.pendingEmailApprovals,
    customer: bundle.customer
      ? { id: bundle.customer.id, status: bundle.customer.status }
      : null,
    websitesAwaitingVisualReview: bundle.websitesAwaitingVisualReview,
    designerJobsAwaitingVisualReview: bundle.designerJobsAwaitingVisualReview,
  };
}

const openKey = (row: Pick<WorkItemRow, "lead_id" | "type" | "dedupe_key">) =>
  `${row.lead_id}|${row.type}|${row.dedupe_key}`;

/**
 * Recompute the desired open work items for every lead from live state and
 * reconcile the table: insert desired-but-missing, resolve open-but-not-
 * desired. Idempotent. Called on every /today render and by the mutating code
 * paths (audit completion, approval request, lifecycle change, conversion).
 *
 * Not a background job -- it runs synchronously inside a request. Never call
 * this during a Server Component render (it writes): the /today page triggers
 * it from a client-mounted server action, and the mutating code paths call it
 * after their own writes.
 */
export async function reconcileWorkItems(): Promise<ReconcileResult> {
  const state = await loadReconcileState();
  if (state.leads.length === 0) return { ok: true, changed: false };

  const openRows = state.workItems.filter(
    (row) => !row.resolved_at && !row.dismissed_at,
  );
  const dismissedKeys = new Set(
    state.workItems
      .filter((row) => row.dismissed_at && !row.resolved_at)
      .map(openKey),
  );
  const openByKey = new Map(openRows.map((row) => [openKey(row), row]));

  const desiredKeys = new Set<string>();
  const toInsert: Array<{
    lead_id: string;
    type: WorkItemType;
    dedupe_key: string;
    priority: number;
    metadata: Json;
  }> = [];

  for (const lead of state.leads) {
    const desired = deriveDesiredWorkItems(toInputs(bundleForLead(state, lead)));
    for (const want of desired) {
      const key = `${lead.id}|${want.type}|${want.dedupeKey}`;
      desiredKeys.add(key);
      if (openByKey.has(key) || dismissedKeys.has(key)) continue;
      toInsert.push({
        lead_id: lead.id,
        type: want.type,
        dedupe_key: want.dedupeKey,
        priority: want.priority,
        metadata: want.metadata as Json,
      });
    }
  }

  const toResolve = openRows.filter((row) => !desiredKeys.has(openKey(row)));

  let ok = true;

  if (toInsert.length > 0) {
    const inserted = await mutateTable((client) =>
      client
        .from("work_items")
        .insert(toInsert)
        .select("id"),
    );
    if (inserted === null) ok = false;
  }

  if (toResolve.length > 0) {
    const now = new Date().toISOString();
    const resolved = await mutateTable((client) =>
      client
        .from("work_items")
        .update({ resolved_at: now, resolution: "condition_no_longer_present" })
        .in(
          "id",
          toResolve.map((row) => row.id),
        )
        .select("id"),
    );
    if (resolved === null) ok = false;
  }

  return {
    ok,
    changed: toInsert.length > 0 || toResolve.length > 0,
    error: ok
      ? undefined
      : "The work queue could not be fully updated. Some items below may be stale or missing. Retry, or check the server logs.",
  };
}

/**
 * Single-lead reconcile for the mutating code paths that want the queue to
 * reflect their change immediately. Delegates to the same full reconcile so
 * there is exactly one derivation of correctness.
 */
export async function syncWorkItemsForLead(leadId: string): Promise<void> {
  if (!leadId) return;
  await reconcileWorkItems();
}

/**
 * Pure read. Does NOT reconcile -- reconciliation is a write and must not run
 * during a Server Component render. `/today` reconciles via a client-mounted
 * server action (see src/app/actions/today.ts); the mutating code paths
 * reconcile after their own writes. This just projects the current table.
 */
export async function getTodayQueue(): Promise<TodayQueue> {
  const [rows, leads] = await Promise.all([
    readTable<WorkItemRow[]>((client) =>
      client
        .from("work_items")
        .select("*")
        .is("resolved_at", null)
        .is("dismissed_at", null)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true }),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
  ]);

  const nameById = new Map((leads ?? []).map((lead) => [lead.id, lead.business_name]));
  const now = Date.now();

  const active: TodayQueueItem[] = [];
  let snoozedCount = 0;

  for (const row of rows ?? []) {
    if (!isWorkItemType(row.type)) continue;
    if (row.snoozed_until && new Date(row.snoozed_until).getTime() > now) {
      snoozedCount += 1;
      continue;
    }
    active.push({
      id: row.id,
      leadId: row.lead_id,
      businessName: nameById.get(row.lead_id) ?? "Unknown business",
      type: row.type,
      priority: row.priority ?? WORK_ITEM_PRIORITY[row.type],
      need: WORK_ITEM_NEED[row.type],
      createdAt: row.created_at,
      snoozedUntil: row.snoozed_until,
    });
  }

  // Group by lead, preserving the priority/created_at order already applied
  // above: a Map's insertion order is the order each lead's first (most
  // urgent) item was seen, which is exactly the right order for the groups.
  const groups = new Map<string, TodayQueueBusiness>();
  for (const item of active) {
    let group = groups.get(item.leadId);
    if (!group) {
      group = { leadId: item.leadId, businessName: item.businessName, items: [] };
      groups.set(item.leadId, group);
    }
    group.items.push(item);
  }
  const orderedGroups = Array.from(groups.values());
  const hiddenGroups = orderedGroups.slice(VISIBLE_LIMIT);

  return {
    visible: orderedGroups.slice(0, VISIBLE_LIMIT),
    hiddenBusinessCount: hiddenGroups.length,
    hiddenItemCount: hiddenGroups.reduce((sum, group) => sum + group.items.length, 0),
    snoozedCount,
  };
}

export async function snoozeWorkItem(
  id: string,
  hours: number,
): Promise<{ ok: boolean; error?: string }> {
  const safeHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 30) : 24;
  const until = new Date(Date.now() + safeHours * 3600 * 1000).toISOString();
  const updated = await mutateTable<Pick<WorkItemRow, "id"> | null>((client) =>
    client
      .from("work_items")
      .update({ snoozed_until: until })
      .eq("id", id)
      .is("resolved_at", null)
      .is("dismissed_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Work item is no longer open." };
  return { ok: true };
}

export async function dismissWorkItem(
  id: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "A dismissal reason is required." };

  const row = await readTable<Pick<WorkItemRow, "id" | "lead_id" | "type"> | null>((client) =>
    client.from("work_items").select("id, lead_id, type").eq("id", id).maybeSingle(),
  );
  if (!row) return { ok: false, error: "Work item was not found." };

  const updated = await mutateTable<Pick<WorkItemRow, "id"> | null>((client) =>
    client
      .from("work_items")
      .update({ dismissed_at: new Date().toISOString(), dismissed_reason: trimmed.slice(0, 500) })
      .eq("id", id)
      .is("resolved_at", null)
      .is("dismissed_at", null)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Work item is no longer open." };

  await recordActivityEvent({
    eventType: "work_item_dismissed",
    title: "Work item dismissed",
    description: `${row.type}: ${trimmed.slice(0, 200)}`,
    actorType: "admin",
    leadId: row.lead_id,
    metadata: { work_item_id: row.id, work_item_type: row.type },
  });
  return { ok: true };
}
