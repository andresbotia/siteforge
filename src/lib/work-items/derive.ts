import { WORK_ITEM_PRIORITY, type WorkItemType } from "./types";

/**
 * M10 Task 3. The ONE derivation of "which work items should be open for this
 * lead right now", computed purely from live state. `syncWorkItemsForLead`
 * (src/data/work-items.ts) diffs this against the DB: anything desired-but-
 * absent is inserted, anything open-but-not-desired is resolved. Because the
 * desired set is recomputed from scratch every reconcile pass, a stale item
 * can never outlive its cause.
 */
export type DesiredWorkItem = {
  type: WorkItemType;
  /** Stable per triggering cause, e.g. "audit:<id>" or "approval:<id>". */
  dedupeKey: string;
  priority: number;
  metadata: Record<string, unknown>;
};

export type LeadWorkItemInputs = {
  lead: { id: string; status: string };
  latestAuditId: string | null;
  hasWebsite: boolean;
  offers: Array<{ id: string; status: string }>;
  outreach: Array<{ id: string; kind: string; status: string }>;
  /** Pending external_email approvals for this lead, with their payload action. */
  pendingEmailApprovals: Array<{ id: string; payloadAction: string | null }>;
  customer: { id: string; status: string } | null;
};

const TERMINAL_FOR_SITE = new Set(["archived", "rejected", "customer"]);
const REPLY_RESOLVED_STATUSES = new Set([
  "interested",
  "declined",
  "archived",
  "customer",
]);
const LIVE_OFFER_STATUSES_EXCLUDED = new Set(["rejected", "expired"]);

function item(
  type: WorkItemType,
  dedupeKey: string,
  metadata: Record<string, unknown> = {},
): DesiredWorkItem {
  return { type, dedupeKey, priority: WORK_ITEM_PRIORITY[type], metadata };
}

export function deriveDesiredWorkItems(
  input: LeadWorkItemInputs,
): DesiredWorkItem[] {
  const { lead, offers, outreach, pendingEmailApprovals, customer } = input;
  const desired: DesiredWorkItem[] = [];

  // qualify_lead -- a brand-new discovered lead awaiting a decision.
  if (lead.status === "discovered") {
    desired.push(item("qualify_lead", `lead:${lead.id}`));
  }

  // review_site -- an audit exists but no website has been produced yet.
  if (
    input.latestAuditId &&
    !input.hasWebsite &&
    !TERMINAL_FOR_SITE.has(lead.status)
  ) {
    desired.push(item("review_site", `audit:${input.latestAuditId}`));
  }

  // approve_outreach / approve_follow_up -- one per pending send approval.
  for (const approval of pendingEmailApprovals) {
    if (approval.payloadAction === "send_follow_up_email") {
      desired.push(item("approve_follow_up", `approval:${approval.id}`));
    } else {
      // send_outreach_email, or a legacy approval with no explicit action.
      desired.push(item("approve_outreach", `approval:${approval.id}`));
    }
  }

  // handle_reply -- a replied outreach the lead status has not caught up with.
  if (!REPLY_RESOLVED_STATUSES.has(lead.status)) {
    for (const row of outreach) {
      if (row.status === "replied") {
        desired.push(item("handle_reply", `outreach:${row.id}`));
      }
    }
  }

  // confirm_intent -- interested lead with no live offer.
  const hasLiveOffer = offers.some(
    (offer) => !LIVE_OFFER_STATUSES_EXCLUDED.has(offer.status),
  );
  if (lead.status === "interested" && !hasLiveOffer) {
    desired.push(item("confirm_intent", `lead:${lead.id}:intent`));
  }

  // fulfill_site -- a converted customer still awaiting setup.
  if (customer && customer.status === "pending_setup") {
    desired.push(item("fulfill_site", `customer:${customer.id}`));
  }

  return desired;
}
