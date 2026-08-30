import "server-only";

import { recordActivityEvent } from "@/data/activity";
import { asRecord } from "@/lib/json";
import { centsToUsd, isPaymentCurrency } from "@/lib/payments/money";
import {
  buildCommercialOfferDraft,
  canCreateCheckoutForOffer,
  validateCommercialOfferInput,
  type CommercialOfferInput,
} from "@/lib/payments/offers";
import { getPaymentProvider } from "@/lib/payments/provider";
import { normalizeStripeWebhookEvent, type NormalizedCheckoutCompleted } from "@/lib/payments/webhook";
import { resolveCustomerPlan, shouldCreateManagedSubscription } from "@/lib/payments/conversion";
import { resolveMonotonicLeadStatus } from "@/lib/scout/status";
import { createServerSupabaseClient, mutateTable, readTable } from "@/lib/supabase/server";
import type { CommercialOffer, CommercialOfferStatus, StripeCheckoutSession } from "@/types";
import type {
  ApprovalRow,
  CommercialOfferRow,
  CustomerRow,
  Json,
  LeadRow,
  StripeCheckoutSessionRow,
  StripeWebhookEventRow,
} from "@/types/database";

const offerStatuses = new Set<CommercialOfferStatus>([
  "draft",
  "awaiting_approval",
  "approved",
  "checkout_created",
  "paid",
  "expired",
  "cancelled",
]);

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

export async function createCheckoutForApprovedOffer(
  offerId: string,
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

  const provider = getPaymentProvider();
  const result = await provider.createCheckoutSession({
    offerId: offer.id,
    leadId: offer.lead_id,
    currency: offer.currency,
    setupAmountCents: offer.setup_amount_cents,
    managedMonthlyAmountCents: offer.managed_monthly_amount_cents,
    managedPlanSelected: offer.managed_plan_selected,
    description: offer.description,
  });
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

export async function processStripeWebhookPayload(input: {
  payload: unknown;
}): Promise<{ ok: boolean; duplicate?: boolean; ignored?: boolean; error?: string }> {
  const event = normalizeStripeWebhookEvent(input.payload);
  if (!event) return { ok: true, ignored: true };
  return processCheckoutCompletedEvent(event);
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
