/**
 * M10 Task 3. Work-item taxonomy for the /today operator queue.
 *
 * The array order IS the queue order: nearest to revenue first. /today renders
 * items sorted by this priority, then by age.
 */
export const WORK_ITEM_TYPES = [
  "handle_reply",
  "confirm_intent",
  "approve_follow_up",
  "fulfill_site",
  "review_visuals",
  "review_site",
  "approve_outreach",
  "qualify_lead",
] as const;

export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];

export function isWorkItemType(value: string): value is WorkItemType {
  return (WORK_ITEM_TYPES as readonly string[]).includes(value);
}

/** Lower = closer to revenue = shown first. */
export const WORK_ITEM_PRIORITY: Record<WorkItemType, number> = WORK_ITEM_TYPES.reduce(
  (acc, type, index) => {
    acc[type] = index;
    return acc;
  },
  {} as Record<WorkItemType, number>,
);

export const WORK_ITEM_LABEL: Record<WorkItemType, string> = {
  handle_reply: "Handle a reply",
  confirm_intent: "Confirm buying intent",
  approve_follow_up: "Approve payment follow-up",
  fulfill_site: "Fulfil the paid site",
  review_visuals: "Approve site visuals",
  review_site: "Review the site",
  approve_outreach: "Approve cold outreach",
  qualify_lead: "Qualify the lead",
};

/** One line of "what is needed" for the queue row. */
export const WORK_ITEM_NEED: Record<WorkItemType, string> = {
  handle_reply: "A prospect replied. Classify it and move the lead forward.",
  confirm_intent: "The lead is interested but has no offer yet. Create one.",
  approve_follow_up: "A payment follow-up email is waiting for send approval.",
  fulfill_site: "Payment cleared. The customer's site needs to be delivered.",
  review_visuals:
    "A generated site is built and waiting on your visual sign-off.",
  review_site: "The audit is done. Decide on and produce a website.",
  approve_outreach: "A cold outreach email is waiting for send approval.",
  qualify_lead: "A newly discovered lead needs a qualification decision.",
};
