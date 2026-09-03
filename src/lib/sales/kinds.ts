/**
 * M9.9 outreach kinds.
 *
 * `cold_outreach` is the pre-existing M8 prospect email: bound to a preview
 * deployment and an sfo_ attribution token. `follow_up` is the post-intent
 * payment email: bound to a commercial offer and the sfb_ purchase token
 * hash instead. Both flow through the SAME drafting, approval, suppression,
 * duplicate-send, provider-readiness and live-email-gate machinery -- there
 * is deliberately no second send path.
 */
export const OUTREACH_KINDS = ["cold_outreach", "follow_up"] as const;

export type OutreachKind = (typeof OUTREACH_KINDS)[number];

export const DEFAULT_OUTREACH_KIND: OutreachKind = "cold_outreach";

export function isOutreachKind(value: string): value is OutreachKind {
  return (OUTREACH_KINDS as readonly string[]).includes(value);
}

/** Rows written before M9.9 have no kind column value in hand; they are all cold outreach. */
export function toOutreachKind(value: string | null | undefined): OutreachKind {
  return value && isOutreachKind(value) ? value : DEFAULT_OUTREACH_KIND;
}

export const OUTREACH_KIND_LABEL: Record<OutreachKind, string> = {
  cold_outreach: "Cold outreach",
  follow_up: "Payment follow-up",
};

/** The approval payload action each kind binds. Never interchangeable. */
export const OUTREACH_APPROVAL_ACTION: Record<OutreachKind, string> = {
  cold_outreach: "send_outreach_email",
  follow_up: "send_follow_up_email",
};
