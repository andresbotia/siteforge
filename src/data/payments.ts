import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { recordActivityEvent } from "@/data/activity";
import { asRecord } from "@/lib/json";
import { buildCheckoutCancelUrl, buildCheckoutSuccessUrl, resolveAppOrigin } from "@/lib/payments/checkout-urls";
import { centsToUsd, isPaymentCurrency } from "@/lib/payments/money";
import {
  buildCommercialOfferDraft,
  canCreateCheckoutForOffer,
  validateCommercialOfferInput,
  type CommercialOfferInput,
} from "@/lib/payments/offers";
import { getPaymentProvider } from "@/lib/payments/provider";
import { createPurchaseToken, hashPurchaseToken, isPurchaseToken } from "@/lib/payments/purchase-tokens";
import {
  normalizeStripeWebhookEvent,
  type NormalizedCheckoutCompleted,
  type NormalizedStripeWebhookEvent,
} from "@/lib/payments/webhook";
import { mapStripeSubscriptionStatus, resolveCustomerPlan, shouldCreateManagedSubscription } from "@/lib/payments/conversion";
import { resolveMonotonicLeadStatus } from "@/lib/scout/status";
import { createServerSupabaseClient, mutateTable, readTable } from "@/lib/supabase/server";
import type { CommercialOffer, CommercialOfferStatus, PurchaseLinkStatus, StripeCheckoutSession } from "@/types";
import type {
  ApprovalRow,
  CommercialOfferRow,
  CustomerRow,
  Database,
  Json,
  LeadRow,
  StripeCheckoutSessionRow,
  StripeWebhookEventRow,
} from "@/types/database";

type Client = SupabaseClient<Database>;

const offerStatuses = new Set<CommercialOfferStatus>([
  "draft",
  "awaiting_approval",
  "approved",
  "checkout_created",
  "paid",
  "expired",
  "cancelled",
]);

function purchaseLinkStatusFromRow(row: Pick<CommercialOfferRow, "purchase_token_hash" | "purchase_link_revoked_at">): PurchaseLinkStatus {
  if (!row.purchase_token_hash) return "not_published";
  if (row.purchase_link_revoked_at) return "revoked";
  return "active";
}

function mapOffer(row: CommercialOfferRow, businessName: string): CommercialOffer {
  return {
    id: row.id,
    leadId: row.lead_id,
    generatedWebsiteId: row.generated_website_id,
    outreachId: row.outreach_id,
    customerId: row.customer_id,
    approvalId: row.approval_id,
    businessName,
    status: offerStatuses.has(row.status as CommercialOfferStatus)
      ? (row.status as CommercialOfferStatus)
      : "draft",
    currency: isPaymentCurrency(row.currency) ? row.currency : "usd",
    setupAmountCents: row.setup_amount_cents,
    managedMonthlyAmountCents: row.managed_monthly_amount_cents,
    managedPlanSelected: row.managed_plan_selected,
    description: row.description,
    contentHash: row.content_hash,
    contentVersion: row.content_version,
    approvedAt: row.approved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    purchaseLinkStatus: purchaseLinkStatusFromRow(row),
    purchaseTokenHint: row.purchase_token_hint,
  };
}

function mapSession(row: StripeCheckoutSessionRow): StripeCheckoutSession {
  return {
    id: row.id,
    commercialOfferId: row.commercial_offer_id,
    leadId: row.lead_id,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripeCustomerId: row.stripe_customer_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    mode: row.mode === "subscription" ? "subscription" : "payment",
    status: row.status as StripeCheckoutSession["status"],
    checkoutUrl: row.checkout_url,
    amountTotalCents: row.amount_total_cents,
    currency: row.currency,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function listCommercialOffers(): Promise<CommercialOffer[]> {
  const [offers, leads] = await Promise.all([
    readTable<CommercialOfferRow[]>((client) =>
      client.from("commercial_offers").select("*").order("created_at", { ascending: false }),
    ),
    readTable<Pick<LeadRow, "id" | "business_name">[]>((client) =>
      client.from("leads").select("id, business_name"),
    ),
  ]);
  const names = new Map((leads ?? []).map((lead) => [lead.id, lead.business_name]));
  return (offers ?? []).map((row) => mapOffer(row, names.get(row.lead_id) ?? "Unknown business"));
}

export async function listCommercialOffersForLead(
  leadId: string,
): Promise<CommercialOffer[]> {
  const [offers, lead] = await Promise.all([
    readTable<CommercialOfferRow[]>((client) =>
      client
        .from("commercial_offers")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }),
    ),
    readTable<Pick<LeadRow, "business_name"> | null>((client) =>
      client.from("leads").select("business_name").eq("id", leadId).maybeSingle(),
    ),
  ]);
  return (offers ?? []).map((row) => mapOffer(row, lead?.business_name ?? "Unknown business"));
}

export async function getCommercialOfferById(
  id: string,
): Promise<(CommercialOffer & { sessions: StripeCheckoutSession[] }) | null> {
  const offer = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", id).maybeSingle(),
  );
  if (!offer) return null;
  const [lead, sessions] = await Promise.all([
    readTable<Pick<LeadRow, "business_name"> | null>((client) =>
      client.from("leads").select("business_name").eq("id", offer.lead_id).maybeSingle(),
    ),
    readTable<StripeCheckoutSessionRow[]>((client) =>
      client
        .from("stripe_checkout_sessions")
        .select("*")
        .eq("commercial_offer_id", offer.id)
        .order("created_at", { ascending: false }),
    ),
  ]);
  return {
    ...mapOffer(offer, lead?.business_name ?? "Unknown business"),
    sessions: (sessions ?? []).map(mapSession),
  };
}

export async function createCommercialOffer(
  input: CommercialOfferInput,
): Promise<{ ok: true; offerId: string } | { ok: false; error: string }> {
  const validation = validateCommercialOfferInput(input);
  if (!validation.ok) return validation;
  const draft = buildCommercialOfferDraft(input);
  const lead = await readTable<Pick<LeadRow, "id" | "business_name"> | null>((client) =>
    client.from("leads").select("id, business_name").eq("id", draft.leadId).maybeSingle(),
  );
  if (!lead) return { ok: false, error: "Lead was not found." };
  const row = await mutateTable<CommercialOfferRow | null>((client) =>
    client
      .from("commercial_offers")
      .insert({
        lead_id: draft.leadId,
        generated_website_id: draft.generatedWebsiteId,
        outreach_id: draft.outreachId,
        currency: draft.currency,
        setup_amount_cents: draft.setupAmountCents,
        managed_monthly_amount_cents: draft.managedMonthlyAmountCents,
        managed_plan_selected: draft.managedPlanSelected,
        description: draft.description,
        content_hash: draft.contentHash,
        content_version: draft.contentVersion,
        metadata: { source: "manual_m9" },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!row) return { ok: false, error: "Could not create offer." };
  await recordActivityEvent({
    eventType: "commercial_offer_created",
    title: "Commercial offer created",
    description: `${lead.business_name}: $${centsToUsd(draft.setupAmountCents).toFixed(2)} setup`,
    leadId: draft.leadId,
    metadata: { commercial_offer_id: row.id },
  });
  return { ok: true, offerId: row.id };
}

export async function updateCommercialOfferDraft(
  input: CommercialOfferInput & { offerId: string },
): Promise<{ ok: boolean; error?: string }> {
  const current = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", input.offerId).maybeSingle(),
  );
  if (!current) return { ok: false, error: "Offer was not found." };
  if (current.status === "paid") return { ok: false, error: "Paid offers cannot be edited." };
  if (current.status === "checkout_created") {
    return { ok: false, error: "Offer already has a checkout session." };
  }
  const validation = validateCommercialOfferInput(input);
  if (!validation.ok) return validation;
  const draft = buildCommercialOfferDraft(input);
  const approvalReset =
    current.status === "awaiting_approval" || current.status === "approved";
  const now = new Date().toISOString();

  const row = await mutateTable<CommercialOfferRow | null>((client) =>
    client
      .from("commercial_offers")
      .update({
        generated_website_id: draft.generatedWebsiteId,
        outreach_id: draft.outreachId,
        currency: draft.currency,
        setup_amount_cents: draft.setupAmountCents,
        managed_monthly_amount_cents: draft.managedMonthlyAmountCents,
        managed_plan_selected: draft.managedPlanSelected,
        description: draft.description,
        content_hash: draft.contentHash,
        status: approvalReset ? "draft" : current.status,
        approval_id: approvalReset ? null : current.approval_id,
        approved_at: approvalReset ? null : current.approved_at,
        updated_at: now,
      })
      .eq("id", input.offerId)
      .select("*")
      .maybeSingle(),
  );
  if (!row) return { ok: false, error: "Could not update offer." };
  if (approvalReset && current.approval_id) {
    await mutateTable((client) =>
      client
        .from("approvals")
        .update({ status: "expired", resolved_at: now, resolved_by: "system_content_modified" })
        .eq("id", current.approval_id!)
        .eq("status", "pending")
        .select("id"),
    );
  }
  return { ok: true };
}

export async function requestCommercialOfferApproval(
  offerId: string,
): Promise<{ ok: boolean; error?: string; approvalId?: string }> {
  const offer = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", offerId).maybeSingle(),
  );
  if (!offer) return { ok: false, error: "Offer was not found." };
  if (offer.status === "paid" || offer.status === "checkout_created") {
    return { ok: false, error: "Offer cannot request approval in its current state." };
  }
  const lead = await readTable<Pick<LeadRow, "business_name"> | null>((client) =>
    client.from("leads").select("business_name").eq("id", offer.lead_id).maybeSingle(),
  );
  const currentHash = buildCommercialOfferDraft({
    leadId: offer.lead_id,
    generatedWebsiteId: offer.generated_website_id,
    outreachId: offer.outreach_id,
    currency: offer.currency,
    setupAmountCents: offer.setup_amount_cents,
    managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
    managedPlanSelected: offer.managed_plan_selected,
    description: offer.description,
  }).contentHash;
  if (currentHash !== offer.content_hash) {
    return { ok: false, error: "Offer content hash is stale." };
  }

  const approval = await mutateTable<ApprovalRow | null>((client) =>
    client
      .from("approvals")
      .insert({
        lead_id: offer.lead_id,
        approval_type: "payment_action",
        status: "pending",
        title: `Approve checkout offer for ${lead?.business_name ?? "prospect"}`,
        description: `Create a mock Stripe checkout session for $${centsToUsd(offer.setup_amount_cents).toFixed(2)} setup${offer.managed_plan_selected ? ` plus $${centsToUsd(offer.managed_monthly_amount_cents ?? 0).toFixed(2)}/month` : ""}.`,
        payload: {
          action: "create_stripe_checkout_session",
          commercial_offer_id: offer.id,
          lead_id: offer.lead_id,
          generated_website_id: offer.generated_website_id,
          outreach_id: offer.outreach_id,
          currency: offer.currency,
          setup_amount_cents: offer.setup_amount_cents,
          managed_monthly_amount_cents: offer.managed_monthly_amount_cents,
          managed_plan_selected: offer.managed_plan_selected,
          content_hash: offer.content_hash,
          content_version: offer.content_version,
          agent_slug: "sales",
          risk_level: "high",
        },
        requested_cost_ticks: "0",
        approved_cost_limit_ticks: "0",
      })
      .select("*")
      .maybeSingle(),
  );
  if (!approval) return { ok: false, error: "Could not create approval." };
  await mutateTable((client) =>
    client
      .from("commercial_offers")
      .update({ status: "awaiting_approval", approval_id: approval.id })
      .eq("id", offer.id)
      .select("id"),
  );
  return { ok: true, approvalId: approval.id };
}

export async function approveCommercialOfferApproval(
  approvalId: string,
): Promise<{ ok: boolean; error?: string }> {
  const approval = await readTable<ApprovalRow | null>((client) =>
    client.from("approvals").select("*").eq("id", approvalId).maybeSingle(),
  );
  if (!approval || approval.status !== "pending") {
    return { ok: false, error: "Approval is no longer pending." };
  }
  if (approval.approval_type !== "payment_action") {
    return { ok: false, error: "This approval is not a payment action." };
  }
  const payload = asRecord(approval.payload);
  if (payload.action !== "create_stripe_checkout_session") {
    return { ok: false, error: "Approval payload action does not match checkout." };
  }
  const offerId = typeof payload.commercial_offer_id === "string" ? payload.commercial_offer_id : "";
  const offer = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", offerId).maybeSingle(),
  );
  if (!offer) return { ok: false, error: "Offer was not found." };
  const currentHash = buildCommercialOfferDraft({
    leadId: offer.lead_id,
    generatedWebsiteId: offer.generated_website_id,
    outreachId: offer.outreach_id,
    currency: offer.currency,
    setupAmountCents: offer.setup_amount_cents,
    managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
    managedPlanSelected: offer.managed_plan_selected,
    description: offer.description,
  }).contentHash;
  if (
    payload.content_hash !== currentHash ||
    payload.content_version !== offer.content_version
  ) {
    return { ok: false, error: "Approved offer content no longer matches." };
  }
  const now = new Date().toISOString();
  await mutateTable((client) =>
    client
      .from("approvals")
      .update({ status: "executed", resolved_at: now, resolved_by: "admin" })
      .eq("id", approval.id)
      .eq("status", "pending")
      .select("id"),
  );
  await mutateTable((client) =>
    client
      .from("commercial_offers")
      .update({ status: "approved", approved_at: now })
      .eq("id", offer.id)
      .select("id"),
  );
  return { ok: true };
}

/**
 * The one place a Stripe checkout-session request is assembled. Shared by
 * the admin-triggered path (createCheckoutForApprovedOffer, below) and the
 * public customer-triggered path (createPublicCheckoutFromToken) so the two
 * auth contexts can never drift into two different Stripe request shapes --
 * only the amounts/plan already recorded on the offer row and trusted
 * SiteForge-controlled redirect URLs ever reach the provider, never a
 * client-supplied amount or price ID.
 */
function buildCheckoutSessionRequest(
  offer: Pick<CommercialOfferRow, "id" | "lead_id" | "currency" | "setup_amount_cents" | "managed_monthly_amount_cents" | "description">,
  managedPlanSelected: boolean,
  origin: string,
) {
  return {
    offerId: offer.id,
    leadId: offer.lead_id,
    currency: offer.currency,
    setupAmountCents: offer.setup_amount_cents,
    managedMonthlyAmountCents: managedPlanSelected ? offer.managed_monthly_amount_cents : null,
    managedPlanSelected,
    description: offer.description,
    successUrl: buildCheckoutSuccessUrl(origin, offer.id),
    cancelUrl: buildCheckoutCancelUrl(origin, offer.id),
  };
}

/**
 * `managedPlanOverride`, when provided, replaces the offer's own
 * `managed_plan_selected` default for this one checkout call -- this is
 * how the public /buy/[token] purchase page lets a customer choose
 * website-only even when the offer's default is managed, or vice versa,
 * without touching the offer row itself. Omitting it (the internal admin
 * "Create Checkout" button's call site) preserves the exact pre-M9.7
 * behavior unchanged: the offer's own managed_plan_selected decides.
 */
export async function createCheckoutForApprovedOffer(
  offerId: string,
  options?: { managedPlanOverride?: boolean },
): Promise<{ ok: true; sessionId: string; checkoutUrl: string } | { ok: false; error: string }> {
  const offer = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", offerId).maybeSingle(),
  );
  if (!offer) return { ok: false, error: "Offer was not found." };
  const completed = await readTable<Pick<StripeCheckoutSessionRow, "id"> | null>((client) =>
    client
      .from("stripe_checkout_sessions")
      .select("id")
      .eq("commercial_offer_id", offer.id)
      .eq("status", "completed")
      .maybeSingle(),
  );
  const approval = offer.approval_id
    ? await readTable<ApprovalRow | null>((client) =>
        client.from("approvals").select("*").eq("id", offer.approval_id!).maybeSingle(),
      )
    : null;
  const policy = canCreateCheckoutForOffer({
    status: offer.status,
    currentContentHash: offer.content_hash,
    approvedContentHash: asRecord(approval?.payload).content_hash as string | null,
    expiresAt: offer.expires_at,
    hasCompletedCheckout: Boolean(completed),
  });
  if (!policy.ok) return policy;

  const managedPlanSelected = options?.managedPlanOverride ?? offer.managed_plan_selected;
  if (managedPlanSelected && offer.managed_monthly_amount_cents === null) {
    return { ok: false, error: "This offer does not include a managed monthly plan." };
  }

  const provider = getPaymentProvider();
  const origin = resolveAppOrigin();
  const result = await provider.createCheckoutSession(buildCheckoutSessionRequest(offer, managedPlanSelected, origin));
  const session = await mutateTable<StripeCheckoutSessionRow | null>((client) =>
    client
      .from("stripe_checkout_sessions")
      .insert({
        commercial_offer_id: offer.id,
        lead_id: offer.lead_id,
        stripe_checkout_session_id: result.checkoutSessionId,
        stripe_customer_id: result.customerId,
        stripe_payment_intent_id: result.paymentIntentId,
        stripe_subscription_id: result.subscriptionId,
        mode: result.mode,
        status: "created",
        checkout_url: result.checkoutUrl,
        amount_total_cents: result.amountTotalCents,
        currency: result.currency,
        expires_at: result.expiresAt,
        metadata: { provider: result.provider },
      })
      .select("*")
      .maybeSingle(),
  );
  if (!session) return { ok: false, error: "Could not persist checkout session." };
  await mutateTable((client) =>
    client
      .from("commercial_offers")
      .update({ status: "checkout_created" })
      .eq("id", offer.id)
      .select("id"),
  );
  await recordActivityEvent({
    eventType: "checkout_session_created",
    title: "Checkout session created",
    description: `${result.provider} checkout session ${result.checkoutSessionId}`,
    leadId: offer.lead_id,
    metadata: { commercial_offer_id: offer.id, checkout_session_id: session.id },
  });
  return { ok: true, sessionId: session.id, checkoutUrl: result.checkoutUrl };
}

/**
 * Admin-gated. Mints a fresh sfb_ purchase token (see purchase-tokens.ts,
 * mirroring the sfp_ preview-token / sfo_ outreach-token hash+hint
 * philosophy) and stores only its hash + short hint -- the raw token is
 * returned once, here, and is not recoverable from the database afterward.
 * Only an approved offer can be published, so an unapproved or since-edited
 * offer can never get a live public link.
 */
export async function publishPurchaseLink(
  offerId: string,
): Promise<{ ok: true; url: string; hint: string } | { ok: false; error: string }> {
  const offer = await readTable<CommercialOfferRow | null>((client) =>
    client.from("commercial_offers").select("*").eq("id", offerId).maybeSingle(),
  );
  if (!offer) return { ok: false, error: "Offer was not found." };
  if (offer.status !== "approved") {
    return { ok: false, error: "Only an approved offer can have a purchase link published." };
  }

  const purchaseToken = createPurchaseToken();
  const updated = await mutateTable<Pick<CommercialOfferRow, "id"> | null>((client) =>
    client
      .from("commercial_offers")
      .update({
        purchase_token_hash: purchaseToken.hash,
        purchase_token_hint: purchaseToken.hint,
        purchase_link_published_at: new Date().toISOString(),
        purchase_link_revoked_at: null,
      })
      .eq("id", offerId)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "Could not publish the purchase link." };

  await recordActivityEvent({
    eventType: "purchase_link_published",
    title: "Customer purchase link published",
    description: `Purchase link ending ${purchaseToken.hint}`,
    leadId: offer.lead_id,
    metadata: { commercial_offer_id: offerId, token_hint: purchaseToken.hint },
  });

  const origin = resolveAppOrigin();
  return { ok: true, url: `${origin}/buy/${purchaseToken.token}`, hint: purchaseToken.hint };
}

/**
 * Admin-gated. Revoking clears no payment history -- it only blocks future
 * lookups by this token (resolvePublicPurchaseOffer / createPublicCheckoutFromToken
 * both check purchase_link_revoked_at first). A material edit to an approved
 * offer already knocks status away from "approved" via updateCommercialOfferDraft,
 * which independently makes the link unusable even without an explicit revoke.
 */
export async function revokePurchaseLink(offerId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const updated = await mutateTable<Pick<CommercialOfferRow, "id"> | null>((client) =>
    client
      .from("commercial_offers")
      .update({ purchase_link_revoked_at: new Date().toISOString() })
      .eq("id", offerId)
      .not("purchase_token_hash", "is", null)
      .select("id")
      .maybeSingle(),
  );
  if (!updated) return { ok: false, error: "No active purchase link to revoke." };

  await recordActivityEvent({
    eventType: "purchase_link_revoked",
    title: "Customer purchase link revoked",
    description: "The customer purchase link was revoked.",
    metadata: { commercial_offer_id: offerId },
  });
  return { ok: true };
}

export type PublicPurchaseOfferSummary = {
  businessName: string;
  currency: string;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
  managedPlanAvailable: boolean;
};

export type PublicPurchaseResolution =
  | { kind: "available"; offer: PublicPurchaseOfferSummary }
  | { kind: "already_purchased"; businessName: string }
  | { kind: "unavailable" };

/**
 * Shared by resolvePublicPurchaseOffer and createPublicCheckoutFromToken.
 * Deliberately unauthenticated (createServerSupabaseClient directly, not
 * readTable/mutateTable) -- this is the same "public, token-gated instead
 * of admin-session-gated" pattern already used by getPublicCheckoutStatus
 * and the M7 preview-token lookups. A malformed token, an unknown hash, or
 * a revoked link all resolve to null here so the caller cannot distinguish
 * "no such token" from "link revoked" -- exactly the anti-enumeration
 * behavior the public /buy/[token] page requires.
 */
async function loadPublicPurchaseOfferRow(
  token: string,
): Promise<{ client: Client; offer: CommercialOfferRow } | null> {
  if (!isPurchaseToken(token)) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;
  const { data: offer } = await client
    .from("commercial_offers")
    .select("*")
    .eq("purchase_token_hash", hashPurchaseToken(token))
    .maybeSingle();
  if (!offer) return null;
  if (offer.purchase_link_revoked_at) return null;
  return { client, offer };
}

/**
 * Reuses canCreateCheckoutForOffer -- the same approval/content-hash/expiry/
 * no-completed-checkout policy already enforced for the internal admin
 * "Create Checkout" action -- so a material offer edit (which resets status
 * away from "approved") or an expired/already-checked-out offer becomes
 * unavailable here automatically, with no separate invalidation logic to
 * keep in sync.
 */
async function isOfferCurrentlyPurchasable(client: Client, offer: CommercialOfferRow): Promise<boolean> {
  const { data: completed } = await client
    .from("stripe_checkout_sessions")
    .select("id")
    .eq("commercial_offer_id", offer.id)
    .eq("status", "completed")
    .maybeSingle();
  const approval = offer.approval_id
    ? (await client.from("approvals").select("*").eq("id", offer.approval_id).maybeSingle()).data
    : null;
  const policy = canCreateCheckoutForOffer({
    status: offer.status,
    currentContentHash: offer.content_hash,
    approvedContentHash: asRecord(approval?.payload).content_hash as string | null,
    expiresAt: offer.expires_at,
    hasCompletedCheckout: Boolean(completed),
  });
  return policy.ok;
}

export async function resolvePublicPurchaseOffer(token: string): Promise<PublicPurchaseResolution | null> {
  const loaded = await loadPublicPurchaseOfferRow(token);
  if (!loaded) return null;
  const { client, offer } = loaded;

  const { data: lead } = await client.from("leads").select("business_name").eq("id", offer.lead_id).maybeSingle();
  const businessName = lead?.business_name ?? "your business";

  if (offer.status === "paid") {
    return { kind: "already_purchased", businessName };
  }

  const purchasable = await isOfferCurrentlyPurchasable(client, offer);
  if (!purchasable) return { kind: "unavailable" };

  return {
    kind: "available",
    offer: {
      businessName,
      currency: offer.currency,
      setupAmountCents: offer.setup_amount_cents,
      managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
      managedPlanAvailable: offer.managed_monthly_amount_cents !== null,
    },
  };
}

export type PublicPlanChoice = "website_only" | "website_plus_managed";

/**
 * The public /buy/[token] checkout entry point. The browser supplies only
 * the token and a plan choice between the two variants the offer itself
 * allows -- never an amount, never a Stripe price ID. Everything else is
 * re-derived server-side from the offer row via buildCheckoutSessionRequest,
 * the same helper the admin-triggered path uses, so the two paths can never
 * produce different Stripe requests for the same offer.
 */
export async function createPublicCheckoutFromToken(
  token: string,
  planChoice: PublicPlanChoice,
): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const loaded = await loadPublicPurchaseOfferRow(token);
  if (!loaded) return { ok: false, error: "This purchase link is not available." };
  const { client, offer } = loaded;

  const purchasable = await isOfferCurrentlyPurchasable(client, offer);
  if (!purchasable) return { ok: false, error: "This purchase link is not available." };

  const managedPlanSelected = planChoice === "website_plus_managed";
  if (managedPlanSelected && offer.managed_monthly_amount_cents === null) {
    return { ok: false, error: "This offer does not include a managed monthly plan." };
  }

  const provider = getPaymentProvider();
  const origin = resolveAppOrigin();
  const result = await provider.createCheckoutSession(buildCheckoutSessionRequest(offer, managedPlanSelected, origin));

  const { data: session, error: sessionError } = await client
    .from("stripe_checkout_sessions")
    .insert({
      commercial_offer_id: offer.id,
      lead_id: offer.lead_id,
      stripe_checkout_session_id: result.checkoutSessionId,
      stripe_customer_id: result.customerId,
      stripe_payment_intent_id: result.paymentIntentId,
      stripe_subscription_id: result.subscriptionId,
      mode: result.mode,
      status: "created",
      checkout_url: result.checkoutUrl,
      amount_total_cents: result.amountTotalCents,
      currency: result.currency,
      expires_at: result.expiresAt,
      metadata: { provider: result.provider, source: "public_purchase_page" },
    })
    .select("*")
    .maybeSingle();
  if (sessionError || !session) return { ok: false, error: "Could not start checkout." };

  await client.from("commercial_offers").update({ status: "checkout_created" }).eq("id", offer.id);
  await client.from("activity_events").insert({
    event_type: "checkout_session_created",
    actor_type: "public_purchase_page",
    lead_id: offer.lead_id,
    title: "Checkout session created",
    description: `${result.provider} checkout session ${result.checkoutSessionId} (customer purchase page)`,
    metadata: { commercial_offer_id: offer.id, checkout_session_id: session.id },
  });

  return { ok: true, checkoutUrl: result.checkoutUrl };
}

export type WebhookProcessingResult = { ok: boolean; duplicate?: boolean; ignored?: boolean; error?: string };

/**
 * Single entry point the webhook route calls after signature verification.
 * Dispatches on the normalized event's `kind`; every branch shares the same
 * idempotency mechanism (recordWebhookEventOnce -- the unique
 * stripe_webhook_events.stripe_event_id constraint is the real guard, this
 * is just the shared insert-and-detect-duplicate helper).
 */
export async function processStripeWebhookPayload(input: { payload: unknown }): Promise<WebhookProcessingResult> {
  const event = normalizeStripeWebhookEvent(input.payload);
  switch (event.kind) {
    case "checkout_completed":
      return processCheckoutCompletedEvent(event);
    case "checkout_async_payment_failed":
      return processCheckoutAsyncPaymentFailedEvent(event);
    case "subscription_updated":
      return processSubscriptionUpdatedEvent(event);
    case "subscription_deleted":
      return processSubscriptionDeletedEvent(event);
    case "invoice_paid":
      return processInvoicePaidEvent(event);
    case "invoice_payment_failed":
      return processInvoicePaymentFailedEvent(event);
    case "ignored":
    default:
      return { ok: true, ignored: true };
  }
}

/**
 * Shared idempotency insert. The unique constraint on stripe_event_id is
 * the actual guard -- a duplicate delivery of the same Stripe event ID
 * fails this insert (Postgres unique-violation), which we treat as
 * "already handled" rather than an error. Never relies on in-memory state.
 */
async function recordWebhookEventOnce(
  client: Client,
  input: { eventId: string; eventType: string; objectId: string | null },
): Promise<{ duplicate: true } | { duplicate: false; row: StripeWebhookEventRow } | { duplicate: false; row: null }> {
  const { data, error } = await client
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: input.eventId,
      event_type: input.eventType,
      object_id: input.objectId,
      processing_status: "pending",
      payload_metadata: {} as Json,
    })
    .select("*")
    .maybeSingle();
  if (error) return { duplicate: true };
  return { duplicate: false, row: data };
}

async function processCheckoutAsyncPaymentFailedEvent(
  event: Extract<NormalizedStripeWebhookEvent, { kind: "checkout_async_payment_failed" }>,
): Promise<WebhookProcessingResult> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const recorded = await recordWebhookEventOnce(client, { eventId: event.eventId, eventType: event.eventType, objectId: event.checkoutSessionId });
  if (recorded.duplicate) return { ok: true, duplicate: true };
  if (!recorded.row) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: session } = await client
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("stripe_checkout_session_id", event.checkoutSessionId)
    .maybeSingle();
  if (!session) {
    await markWebhook(client, recorded.row, "ignored", "checkout_session_not_found");
    return { ok: true, ignored: true };
  }

  await client
    .from("stripe_checkout_sessions")
    .update({ status: "failed", last_event_at: new Date().toISOString() })
    .eq("id", session.id);
  await client.from("activity_events").insert({
    event_type: "checkout_payment_failed",
    actor_type: "stripe_webhook",
    lead_id: session.lead_id,
    title: "Checkout payment failed",
    description: "An asynchronous payment method failed for this Checkout session.",
    metadata: { checkout_session_id: session.id, stripe_event_id: event.eventId },
  });
  await markWebhook(client, recorded.row, "processed", null);
  return { ok: true };
}

async function processSubscriptionUpdatedEvent(
  event: Extract<NormalizedStripeWebhookEvent, { kind: "subscription_updated" }>,
): Promise<WebhookProcessingResult> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const recorded = await recordWebhookEventOnce(client, { eventId: event.eventId, eventType: event.eventType, objectId: event.subscriptionId });
  if (recorded.duplicate) return { ok: true, duplicate: true };
  if (!recorded.row) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: subscription } = await client
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", event.subscriptionId)
    .maybeSingle();
  if (!subscription) {
    await markWebhook(client, recorded.row, "ignored", "subscription_not_found");
    return { ok: true, ignored: true };
  }

  const status = mapStripeSubscriptionStatus(event.status);
  await client
    .from("subscriptions")
    .update({ status, cancelled_at: status === "cancelled" ? new Date().toISOString() : subscription.cancelled_at })
    .eq("id", subscription.id);
  await markWebhook(client, recorded.row, "processed", null);
  return { ok: true };
}

async function processSubscriptionDeletedEvent(
  event: Extract<NormalizedStripeWebhookEvent, { kind: "subscription_deleted" }>,
): Promise<WebhookProcessingResult> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const recorded = await recordWebhookEventOnce(client, { eventId: event.eventId, eventType: event.eventType, objectId: event.subscriptionId });
  if (recorded.duplicate) return { ok: true, duplicate: true };
  if (!recorded.row) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: subscription } = await client
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", event.subscriptionId)
    .maybeSingle();
  if (!subscription) {
    await markWebhook(client, recorded.row, "ignored", "subscription_not_found");
    return { ok: true, ignored: true };
  }

  await client
    .from("subscriptions")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", subscription.id);
  await markWebhook(client, recorded.row, "processed", null);
  return { ok: true };
}

async function processInvoicePaidEvent(
  event: Extract<NormalizedStripeWebhookEvent, { kind: "invoice_paid" }>,
): Promise<WebhookProcessingResult> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!event.subscriptionId) return { ok: true, ignored: true };
  const recorded = await recordWebhookEventOnce(client, { eventId: event.eventId, eventType: event.eventType, objectId: event.subscriptionId });
  if (recorded.duplicate) return { ok: true, duplicate: true };
  if (!recorded.row) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: subscription } = await client
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", event.subscriptionId)
    .maybeSingle();
  if (!subscription) {
    await markWebhook(client, recorded.row, "ignored", "subscription_not_found");
    return { ok: true, ignored: true };
  }

  await client
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: event.periodStart ?? subscription.current_period_start,
      current_period_end: event.periodEnd ?? subscription.current_period_end,
    })
    .eq("id", subscription.id);
  await client.from("activity_events").insert({
    event_type: "subscription_invoice_paid",
    actor_type: "stripe_webhook",
    customer_id: subscription.customer_id,
    title: "Managed subscription invoice paid",
    description: event.amountPaidCents !== null ? `$${centsToUsd(event.amountPaidCents).toFixed(2)} ${event.currency ?? ""}`.trim() : "Invoice paid",
    metadata: { subscription_id: subscription.id, stripe_event_id: event.eventId },
  });
  await markWebhook(client, recorded.row, "processed", null);
  return { ok: true };
}

async function processInvoicePaymentFailedEvent(
  event: Extract<NormalizedStripeWebhookEvent, { kind: "invoice_payment_failed" }>,
): Promise<WebhookProcessingResult> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!event.subscriptionId) return { ok: true, ignored: true };
  const recorded = await recordWebhookEventOnce(client, { eventId: event.eventId, eventType: event.eventType, objectId: event.subscriptionId });
  if (recorded.duplicate) return { ok: true, duplicate: true };
  if (!recorded.row) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: subscription } = await client
    .from("subscriptions")
    .select("*")
    .eq("provider_subscription_id", event.subscriptionId)
    .maybeSingle();
  if (!subscription) {
    await markWebhook(client, recorded.row, "ignored", "subscription_not_found");
    return { ok: true, ignored: true };
  }

  // Status itself is not forced here -- Stripe also emits
  // customer.subscription.updated (status: past_due/unpaid), which is the
  // authoritative status transition already handled above. This just
  // records the failure as a visible, auditable event.
  await client.from("activity_events").insert({
    event_type: "subscription_invoice_payment_failed",
    actor_type: "stripe_webhook",
    customer_id: subscription.customer_id,
    title: "Managed subscription invoice payment failed",
    description: "Stripe reported a failed invoice payment for a managed subscription.",
    metadata: { subscription_id: subscription.id, stripe_event_id: event.eventId },
  });
  await markWebhook(client, recorded.row, "processed", null);
  return { ok: true };
}

export type PublicCheckoutStatus = {
  businessName: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  managedPlanSelected: boolean;
  setupAmountCents: number;
  managedMonthlyAmountCents: number | null;
};

/**
 * Public, unauthenticated read for the Checkout success/cancel pages (see
 * src/proxy.ts's isPublicCheckoutStatusPath). Deliberately returns only
 * non-sensitive, already-public-to-the-customer fields -- no Stripe IDs, no
 * lead contact details -- keyed by the unguessable commercial_offers.id
 * UUID. Webhook state (offer.status) is authoritative; this never trusts a
 * query parameter as proof of payment.
 */
export async function getPublicCheckoutStatus(offerId: string): Promise<PublicCheckoutStatus | null> {
  const client = createServerSupabaseClient();
  if (!client) return null;
  const { data: offer } = await client.from("commercial_offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) return null;
  const { data: lead } = await client.from("leads").select("business_name").eq("id", offer.lead_id).maybeSingle();
  const status: PublicCheckoutStatus["status"] =
    offer.status === "paid" ? "paid" : offer.status === "expired" ? "expired" : offer.status === "cancelled" ? "cancelled" : "pending";
  return {
    businessName: lead?.business_name ?? "your business",
    status,
    managedPlanSelected: offer.managed_plan_selected,
    setupAmountCents: offer.setup_amount_cents,
    managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
  };
}

export async function processCheckoutCompletedEvent(
  event: NormalizedCheckoutCompleted,
): Promise<{ ok: boolean; duplicate?: boolean; ignored?: boolean; error?: string }> {
  const client = createServerSupabaseClient();
  if (!client) return { ok: false, error: "Supabase is not configured." };

  const { data: webhookRow, error: webhookError } = await client
    .from("stripe_webhook_events")
    .insert({
      stripe_event_id: event.eventId,
      event_type: event.eventType,
      object_id: event.checkoutSessionId,
      processing_status: "pending",
      payload_metadata: event.metadata as Json,
    })
    .select("*")
    .maybeSingle();
  if (webhookError) return { ok: true, duplicate: true };
  if (!webhookRow) return { ok: false, error: "Webhook event could not be recorded." };

  const { data: session } = await client
    .from("stripe_checkout_sessions")
    .select("*")
    .eq("stripe_checkout_session_id", event.checkoutSessionId)
    .maybeSingle();
  if (!session) {
    await markWebhook(client, webhookRow, "ignored", "checkout_session_not_found");
    return { ok: true, ignored: true };
  }

  const { data: offer } = await client
    .from("commercial_offers")
    .select("*")
    .eq("id", session.commercial_offer_id)
    .maybeSingle();
  const { data: lead } = await client
    .from("leads")
    .select("*")
    .eq("id", session.lead_id)
    .maybeSingle();
  if (!offer || !lead) {
    await markWebhook(client, webhookRow, "failed", "offer_or_lead_not_found");
    return { ok: false, error: "Offer or lead was not found." };
  }

  const now = new Date().toISOString();
  await client
    .from("stripe_checkout_sessions")
    .update({
      status: "completed",
      stripe_customer_id: event.customerId ?? session.stripe_customer_id,
      stripe_payment_intent_id: event.paymentIntentId ?? session.stripe_payment_intent_id,
      stripe_subscription_id: event.subscriptionId ?? session.stripe_subscription_id,
      amount_total_cents: event.amountTotalCents ?? session.amount_total_cents,
      currency: event.currency ?? session.currency,
      completed_at: now,
      last_event_at: now,
    })
    .eq("id", session.id);

  let customer = await findCustomer(client, offer.lead_id, event.customerId);
  const plan = resolveCustomerPlan({ managedPlanSelected: offer.managed_plan_selected });
  if (!customer) {
    const { data } = await client
      .from("customers")
      .insert({
        lead_id: offer.lead_id,
        commercial_offer_id: offer.id,
        stripe_customer_id: event.customerId,
        business_name: lead.business_name,
        contact_email: lead.email,
        plan,
        status: "pending_setup",
        production_url: null,
        converted_at: now,
        conversion_metadata: { checkout_session_id: session.id },
      })
      .select("*")
      .maybeSingle();
    customer = data;
  } else {
    await client
      .from("customers")
      .update({
        commercial_offer_id: offer.id,
        stripe_customer_id: event.customerId ?? customer.stripe_customer_id,
        plan,
        status: "pending_setup",
        converted_at: customer.converted_at ?? now,
      })
      .eq("id", customer.id);
  }
  if (!customer) {
    await markWebhook(client, webhookRow, "failed", "customer_persist_failed");
    return { ok: false, error: "Customer could not be persisted." };
  }

  await client
    .from("commercial_offers")
    .update({ status: "paid", customer_id: customer.id })
    .eq("id", offer.id);
  await client
    .from("leads")
    .update({ status: resolveMonotonicLeadStatus(lead.status, "customer") })
    .eq("id", lead.id);

  if (
    shouldCreateManagedSubscription({
      managedPlanSelected: offer.managed_plan_selected,
      managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
    })
  ) {
    const { data: existingSubscription } = await client
      .from("subscriptions")
      .select("id")
      .eq("commercial_offer_id", offer.id)
      .eq("interval", "month")
      .maybeSingle();
    const subscriptionPatch = {
        customer_id: customer.id,
        commercial_offer_id: offer.id,
        provider: "stripe",
        provider_customer_id: event.customerId,
        provider_subscription_id: event.subscriptionId,
        amount_usd: centsToUsd(offer.managed_monthly_amount_cents ?? 0),
        amount_cents: offer.managed_monthly_amount_cents,
        currency: offer.currency,
        interval: "month",
        status: "active",
        started_at: now,
        conversion_metadata: { checkout_session_id: session.id },
      };
    if (existingSubscription) {
      await client
        .from("subscriptions")
        .update(subscriptionPatch)
        .eq("id", existingSubscription.id);
    } else {
      await client.from("subscriptions").insert(subscriptionPatch);
    }
  }

  await client.from("activity_events").insert({
    event_type: "customer_converted",
    actor_type: "stripe_webhook",
    lead_id: lead.id,
    customer_id: customer.id,
    title: "Lead converted to customer",
    description: `${lead.business_name} completed checkout.`,
    metadata: {
      commercial_offer_id: offer.id,
      checkout_session_id: session.id,
      stripe_event_id: event.eventId,
    },
  });
  await markWebhook(client, webhookRow, "processed", null);
  return { ok: true };
}

async function findCustomer(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  leadId: string,
  stripeCustomerId: string | null,
): Promise<CustomerRow | null> {
  if (stripeCustomerId) {
    const { data } = await client
      .from("customers")
      .select("*")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();
    if (data) return data;
  }
  const { data } = await client
    .from("customers")
    .select("*")
    .eq("lead_id", leadId)
    .maybeSingle();
  return data;
}

async function markWebhook(
  client: NonNullable<ReturnType<typeof createServerSupabaseClient>>,
  row: StripeWebhookEventRow,
  status: "processed" | "ignored" | "failed",
  error: string | null,
) {
  await client
    .from("stripe_webhook_events")
    .update({
      processing_status: status,
      processed_at: new Date().toISOString(),
      error,
    })
    .eq("id", row.id);
}
