import { isLeadEligibleForAudit } from "@/lib/auditor/eligibility";
import { isLeadEligibleForBuild } from "@/lib/builder/eligibility";
import { needsNewMasterTemplate } from "@/lib/builder/registry";
import { canTransitionLeadStatus } from "@/lib/leads/lifecycle";
import { isLeadEligibleForSales } from "@/lib/sales/eligibility";
import { evaluateFollowUpEligibility } from "@/lib/sales/follow-up";
import type { Lead, PreviewDeployment } from "@/types";

/**
 * M10 Task 2. The ONE derivation of "what can the operator legally do to this
 * business right now". It composes the existing rule sources -- the lifecycle
 * transition table (`canTransitionLeadStatus`) and the per-agent eligibility
 * helpers (`isLeadEligibleForAudit`, `isLeadEligibleForBuild`,
 * `isLeadEligibleForSales`, `evaluateFollowUpEligibility`) -- rather than
 * re-encoding a second copy of those rules. `/leads/[id]` renders only the
 * actions this returns.
 */
export type OperatorActionId =
  | "run_audit"
  | "create_website"
  | "request_preview_approval"
  | "draft_cold_outreach"
  | "mark_interested"
  | "create_offer"
  | "publish_purchase_link"
  | "draft_follow_up"
  | "archive"
  | "unarchive";

/**
 * Which of the three unchanged website producers the "Create website" entry
 * point should route to, decided by template-registry coverage so the operator
 * doesn't have to know the difference.
 */
export type WebsiteProducer = "builder" | "designer_job" | "external_import";

export type OperatorActionGroup = "close" | "advance" | "prepare" | "housekeeping";

export type OperatorAction = {
  id: OperatorActionId;
  label: string;
  description: string;
  /** An in-page anchor ("#offers") or an absolute route ("/agents/sales"). */
  target: string;
  group: OperatorActionGroup;
  /** Only set for `create_website`. */
  websiteProducer?: WebsiteProducer;
};

export type OperatorActionOfferContext = {
  status: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanSelected: boolean;
  purchaseTokenHash: string | null;
  purchaseLinkRevokedAt: string | null;
};

export type OperatorActionContext = {
  lead: {
    status: string;
    industry: string;
    websiteUrl?: string | null;
    inspectionSummary?: unknown;
  };
  website: { id: string; hasSpec: boolean } | null;
  preview: { status: string; revokedAt: string | null } | null;
  hasPendingPreviewApproval: boolean;
  outreach: Array<{ kind: "cold_outreach" | "follow_up"; status: string }>;
  offers: OperatorActionOfferContext[];
  isCustomer: boolean;
};

/** Template-coverage-driven routing for the single "Create website" button. */
export function recommendWebsiteProducer(industry: string): WebsiteProducer {
  return needsNewMasterTemplate(industry) ? "designer_job" : "builder";
}

const GROUP_ORDER: Record<OperatorActionGroup, number> = {
  close: 0,
  advance: 1,
  prepare: 2,
  housekeeping: 3,
};

export function deriveOperatorActions(
  ctx: OperatorActionContext,
): OperatorAction[] {
  const { lead, website, preview, offers, outreach } = ctx;
  const actions: OperatorAction[] = [];

  const previewActive =
    preview?.status === "active" && !preview.revokedAt;
  const hasColdOutreach = outreach.some((row) => row.kind === "cold_outreach");
  const liveOffer = offers.find(
    (offer) => offer.status !== "rejected" && offer.status !== "expired",
  );

  // --- close: nearest to revenue -------------------------------------------
  const followUpReadyOffer = offers.find(
    (offer) =>
      evaluateFollowUpEligibility({ leadStatus: lead.status, offer }).ok &&
      !outreach.some((row) => row.kind === "follow_up" && row.status === "sent"),
  );
  if (followUpReadyOffer) {
    actions.push({
      id: "draft_follow_up",
      label: "Draft payment follow-up",
      description:
        "Lead is interested and the offer has an active purchase link. Draft the follow-up email (still needs send approval).",
      target: "#offers",
      group: "close",
    });
  }

  const publishableOffer = offers.find(
    (offer) => offer.status === "approved" && !offer.purchaseTokenHash,
  );
  if (publishableOffer) {
    actions.push({
      id: "publish_purchase_link",
      label: "Publish purchase link",
      description:
        "The approved offer has no purchase link yet. Publishing reveals the link once -- save it immediately.",
      target: "#offers",
      group: "close",
    });
  }

  if (
    !ctx.isCustomer &&
    website &&
    !liveOffer &&
    canTransitionLeadStatus(lead.status, "customer").ok
  ) {
    actions.push({
      id: "create_offer",
      label: "Create offer",
      description:
        "Draft a commercial offer for one of the two configured plans. Amounts are locked to the configured prices.",
      target: "#offers",
      group: "close",
    });
  }

  // --- advance: move the lead down the pipeline ---------------------------
  if (
    lead.status !== "interested" &&
    canTransitionLeadStatus(lead.status, "interested").ok
  ) {
    actions.push({
      id: "mark_interested",
      label: "Mark interested",
      description:
        "Record that the business responded with interest. Enables the offer and payment follow-up path.",
      target: "#lifecycle",
      group: "advance",
    });
  }

  if (
    isLeadEligibleForSales(
      { status: lead.status } as Pick<Lead, "status">,
      website,
      preview
        ? ({ id: "p", status: preview.status, revokedAt: preview.revokedAt } as Pick<
            PreviewDeployment,
            "id" | "status" | "revokedAt"
          >)
        : null,
    ) &&
    !hasColdOutreach
  ) {
    actions.push({
      id: "draft_cold_outreach",
      label: "Draft cold outreach",
      description:
        "An approved preview is live. Draft the first prospect email (deterministic; still needs send approval).",
      target: "/agents/sales",
      group: "advance",
    });
  }

  if (
    website?.hasSpec &&
    !previewActive &&
    !ctx.hasPendingPreviewApproval
  ) {
    actions.push({
      id: "request_preview_approval",
      label: "Request preview approval",
      description:
        "There is a website draft but no live public preview. Request approval to publish a tokenized preview.",
      target: `/websites/${website.id}`,
      group: "advance",
    });
  }

  // --- prepare: earlier-stage groundwork --------------------------------
  if (!website && isLeadEligibleForBuild(lead)) {
    const producer = recommendWebsiteProducer(lead.industry);
    actions.push({
      id: "create_website",
      label: "Create website",
      description:
        producer === "builder"
          ? "A template family covers this industry -- routes to the deterministic $0 Builder."
          : "No template family covers this industry -- routes to a Designer Job (or external import).",
      target: "#website",
      group: "prepare",
      websiteProducer: producer,
    });
  }

  if (isLeadEligibleForAudit(lead)) {
    actions.push({
      id: "run_audit",
      label: "Run website audit",
      description:
        "Deterministic audit of the current live website. $0. Re-running keeps history.",
      target: "#audit",
      group: "prepare",
    });
  }

  // --- housekeeping ----------------------------------------------------
  if (
    lead.status === "archived" &&
    canTransitionLeadStatus("archived", "contacted").ok
  ) {
    actions.push({
      id: "unarchive",
      label: "Un-archive (restore to contacted)",
      description: "Reverse an accidental archive. The lead returns to the contacted state.",
      target: "#lifecycle",
      group: "housekeeping",
    });
  } else if (lead.status !== "archived") {
    actions.push({
      id: "archive",
      label: "Archive",
      description: "Retire this business from the pipeline. Requires a reason. Reversible from the archived state.",
      target: "#lifecycle",
      group: "housekeeping",
    });
  }

  return actions.sort((a, b) => GROUP_ORDER[a.group] - GROUP_ORDER[b.group]);
}
