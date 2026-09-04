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
  /**
   * The lead's most recently created generated_websites row, if any -- null
   * when nothing has been produced. M10.6 follow-up: rebuilds create history instead
   * of overwriting (by design), so a lead can carry several historical rows
   * all still sitting in `review_required` because nothing ever moves an
   * old draft out of that status when it's superseded. Only the CURRENT
   * (latest) version can generate `review_visuals`; passing every historical
   * row here was producing one duplicate item per rebuild.
   */
  latestWebsite?: { id: string; status: string } | null;
  /**
   * The lead's most recently created Designer Job, if any. Same idea as
   * `latestWebsite` -- only the current job's status matters.
   */
  latestDesignerJob?: { id: string; status: string } | null;
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

  // M10.6 follow-up: an archived lead is retired and must produce NO work item of any
  // type, full stop -- not "most types, gated by TERMINAL_FOR_SITE", which
  // is what every type but fulfill_site already did. fulfill_site had no
  // status guard at all, which is why an archived lead with a still-
  // pending_setup customer row (Tidewash, Atlantic Drain Plumbing) kept
  // showing "Fulfil the paid site" indefinitely: every reconcile pass
  // recomputed the desired set from customer.status alone, so the item was
  // never in the "no longer desired" bucket reconcile resolves. A single
  // early return here is the fix for fulfill_site and a guarantee for every
  // future type, rather than one more per-type guard to remember.
  if (lead.status === "archived") return [];

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

  // review_visuals -- a produced site (deterministic Builder or a Designer
  // Job) exists and is waiting on human visual sign-off. Distinct from
  // review_site, which means "no website has been produced yet". Approving
  // site visuals is the most common operator action during a live campaign,
  // so it gets its own type between fulfill_site and review_site by priority.
  if (!TERMINAL_FOR_SITE.has(lead.status)) {
    if (input.latestWebsite && input.latestWebsite.status === "review_required") {
      desired.push(item("review_visuals", `website:${input.latestWebsite.id}`));
    }
    if (input.latestDesignerJob && input.latestDesignerJob.status === "visual_review_required") {
      desired.push(item("review_visuals", `designer_job:${input.latestDesignerJob.id}`));
    }
  }

  // approve_outreach / approve_follow_up -- one per pending send approval.
  //
  // M10.6 Task 2: a follow-up approval asks the operator to send a "please
  // complete your payment" nudge. If a `customers` row already exists, the
  // checkout that approval is nudging toward has already completed (the
  // Stripe webhook is what creates that row) -- sending it now would be
  // contradictory. This is a genuine race, not just a fixture artifact: the
  // approval can be requested while the lead is `interested` and still be
  // sitting unapproved when the prospect pays via the purchase link before
  // an operator acts on it. Suppressing it here (rather than relying on the
  // request-time eligibility check alone) closes that window. approve_outreach
  // (cold, pre-contact) is unaffected -- a customer existing does not make a
  // cold-outreach approval contradictory in the same way.
  const alreadyConverted = customer !== null;
  for (const approval of pendingEmailApprovals) {
    if (approval.payloadAction === "send_follow_up_email") {
      if (!alreadyConverted) {
        desired.push(item("approve_follow_up", `approval:${approval.id}`));
      }
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

  // confirm_intent -- interested lead with no live offer and no customer yet.
  //
  // M10.6 Task 2: "confirm buying intent" asks whether this prospect wants to
  // buy. A `customers` row is proof they already did -- intent confirmed by
  // definition, whatever `lead.status` says (lead status is a separate,
  // operator-set field that can lag the payment webhook). Without the
  // `!alreadyConverted` guard this and `fulfill_site` fired simultaneously
  // for the same lead ("confirm they want to buy" next to "deliver what they
  // already paid for") -- the exact overlap this task reported.
  const hasLiveOffer = offers.some(
    (offer) => !LIVE_OFFER_STATUSES_EXCLUDED.has(offer.status),
  );
  if (lead.status === "interested" && !hasLiveOffer && !alreadyConverted) {
    desired.push(item("confirm_intent", `lead:${lead.id}:intent`));
  }

  // fulfill_site -- a converted customer still awaiting setup.
  if (customer && customer.status === "pending_setup") {
    desired.push(item("fulfill_site", `customer:${customer.id}`));
  }

  return desired;
}
