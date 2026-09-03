import { leadStatuses } from "@/lib/constants";
import type { LeadStatus } from "@/types";

/**
 * M9.9 lead lifecycle. This module is the ONE place lead status transitions
 * are decided -- Scout (`src/lib/scout/status.ts`), the outreach send path,
 * the Stripe webhook, and the operator UI all resolve through this table
 * rather than carrying their own scattered guards.
 *
 * Lead status was monotonic before M9.9 (a lead could only ever move forward
 * through the pipeline). That is broken here deliberately and in exactly three
 * places, all requested by the operator:
 *
 *   1. `archived` is reachable from EVERY state, including `customer` and
 *      `rejected`. It is the general-purpose "retire this lead" exit and
 *      always requires a non-null reason (see `canTransitionLeadStatus`).
 *   2. `interested -> contacted` is allowed, so a prospect who expressed
 *      interest and then went quiet can be walked back to plain "contacted"
 *      without inventing a new status or faking a rejection.
 *   3. `archived -> contacted` is allowed (M10 Task 0), so an accidental
 *      archive is reversible from the console. This is an OPERATOR-only edge:
 *      `resolveLeadStatusTransition` (the automated-writer resolver) still
 *      refuses to move a lead out of `archived`, so Scout/Auditor/the send
 *      path/the webhook can never silently resurrect a retired lead.
 *
 * Everything else stays monotonic: a state may only advance to a LATER
 * pipeline state (skipping intermediate states is allowed and always was --
 * e.g. the outreach send path moves an `audited` lead straight to
 * `contacted`, and the Stripe webhook moves a `contacted` lead straight to
 * `customer`).
 *
 * `rejected` is deliberately NOT widened by this milestone: it remains
 * reachable only from `discovered`, exactly as Scout has always treated it
 * (an early-stage disqualification, not a general exit). `archived` is the
 * new general exit and covers the later-stage cases.
 *
 * `archived` has exactly one exit, `archived -> contacted`, for the operator
 * to undo an accidental archive (M10 Task 0). Automated writers cannot use it.
 */
export const LEAD_LIFECYCLE_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  discovered: [
    "qualified",
    "audited",
    "website_built",
    "approved",
    "contacted",
    "interested",
    "customer",
    "rejected",
    "archived",
  ],
  qualified: ["audited", "website_built", "approved", "contacted", "interested", "customer", "archived"],
  audited: ["website_built", "approved", "contacted", "interested", "customer", "archived"],
  website_built: ["approved", "contacted", "interested", "customer", "archived"],
  approved: ["contacted", "interested", "customer", "archived"],
  contacted: ["interested", "customer", "archived"],
  // "contacted" here is the deliberate, minimal backward edge (prospect went quiet).
  interested: ["contacted", "customer", "archived"],
  customer: ["archived"],
  rejected: ["archived"],
  // Single exit: lets an operator undo an accidental archive. Automated
  // writers are blocked from this edge in `resolveLeadStatusTransition`.
  archived: ["contacted"],
};

const KNOWN_STATUSES = new Set<string>(leadStatuses);

export function isLeadStatus(value: string): value is LeadStatus {
  return KNOWN_STATUSES.has(value);
}

export type LeadStatusTransitionResult = { ok: true } | { ok: false; error: string };

/**
 * `archivedReason` is required (non-empty) for, and only meaningful on, a
 * transition into `archived`. The database enforces the same rule
 * independently via a CHECK constraint -- this is the friendly-error layer,
 * not the only guard.
 */
export function canTransitionLeadStatus(
  current: string,
  next: string,
  options: { archivedReason?: string | null } = {},
): LeadStatusTransitionResult {
  if (!isLeadStatus(current)) {
    return { ok: false, error: `Unknown current lead status: ${current}` };
  }
  if (!isLeadStatus(next)) {
    return { ok: false, error: `Unknown target lead status: ${next}` };
  }
  if (next === "archived" && !options.archivedReason?.trim()) {
    return { ok: false, error: "Archiving a lead requires a reason." };
  }
  // A no-op transition is always allowed so idempotent callers (webhook
  // retries, repeated Scout runs) never have to special-case it.
  if (current === next) return { ok: true };
  if (!LEAD_LIFECYCLE_TRANSITIONS[current].includes(next)) {
    return { ok: false, error: `Lead cannot move from ${current} to ${next}.` };
  }
  return { ok: true };
}

/**
 * Non-throwing resolver for automated writers (Scout, Auditor, outreach
 * send, Stripe webhook): returns the status the lead should end up with,
 * which is the proposal only when the table allows it and the current status
 * otherwise. An unknown/absent current status yields the proposal, matching
 * the pre-M9.9 behavior for brand-new leads.
 */
export function resolveLeadStatusTransition(
  current: string | null | undefined,
  proposed: string,
): string {
  if (!current) return proposed;
  if (!isLeadStatus(current)) return current;
  // Automated writers never archive; archive is an explicit operator action.
  if (proposed === "archived") return current;
  // ...and they never un-archive: the `archived -> contacted` edge is
  // operator-only, so a stale automated proposal can't resurrect a lead
  // the operator deliberately retired.
  if (current === "archived") return current;
  return canTransitionLeadStatus(current, proposed).ok ? proposed : current;
}

export const LEAD_ARCHIVE_REASON_MAX_LENGTH = 500;

export function normalizeArchivedReason(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, LEAD_ARCHIVE_REASON_MAX_LENGTH);
}

/** Statuses an operator may set by hand from the lead detail page. */
export function operatorSelectableStatuses(current: string): LeadStatus[] {
  if (!isLeadStatus(current)) return [];
  return [...LEAD_LIFECYCLE_TRANSITIONS[current]];
}
