"use client";

import { useActionState } from "react";
import {
  createCheckoutAction,
  requestCommercialOfferApprovalAction,
  updateCommercialOfferAction,
  type OfferActionState,
} from "@/app/actions/offers";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, TextArea } from "@/components/shared/field";
import { CommercialOfferStatusBadge } from "@/components/shared/status-badge";
import { PurchaseLinkPanel } from "@/components/offers/purchase-link-panel";
import { formatCurrency } from "@/lib/format";
import type { StripeMode } from "@/lib/payments/config";
import { centsToUsd } from "@/lib/payments/money";
import { OFFER_PLANS, offerPlanKeyFromAmounts } from "@/lib/payments/plans";
import type { CommercialOffer } from "@/types";

const MODE_LABEL: Record<StripeMode, string> = { mock: "Mock", test: "Stripe TEST mode", live: "Stripe LIVE mode -- real charge" };

export function OfferEditor({ offer, stripeMode }: { offer: CommercialOffer; stripeMode: StripeMode }) {
  const [saveState, saveAction, saving] = useActionState<OfferActionState, FormData>(
    updateCommercialOfferAction,
    null,
  );
  const [approvalState, approvalAction, requesting] = useActionState<OfferActionState, FormData>(
    requestCommercialOfferApprovalAction,
    null,
  );
  const [checkoutState, checkoutAction, creating] = useActionState<OfferActionState, FormData>(
    createCheckoutAction,
    null,
  );
  const currentPlanKey = offerPlanKeyFromAmounts(offer);
  const locked = offer.status === "paid" || offer.status === "checkout_created";
  const canRequest = offer.status === "draft" || offer.status === "expired";
  const canCheckout = offer.status === "approved";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <Card>
        <CardHeader
          title="Offer terms"
          description="Exact offer content is hashed and bound to checkout approval."
        />
        <CardBody>
          <form action={saveAction} className="grid gap-4">
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="leadId" value={offer.leadId} />
            <input type="hidden" name="generatedWebsiteId" value={offer.generatedWebsiteId ?? ""} />
            <input type="hidden" name="outreachId" value={offer.outreachId ?? ""} />
            <input type="hidden" name="currency" value={offer.currency} />
            <fieldset className="grid gap-2" disabled={locked}>
              <legend className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Plan
              </legend>
              {OFFER_PLANS.map((plan) => (
                <label
                  key={plan.key}
                  className="flex items-start gap-2 rounded border border-border-subtle p-3 text-sm"
                >
                  <input
                    type="radio"
                    name="planKey"
                    value={plan.key}
                    defaultChecked={plan.key === (currentPlanKey ?? "website_only")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-foreground">{plan.label}</span>
                    <span className="block text-xs text-muted">
                      {formatCurrency(centsToUsd(plan.setupAmountCents))} setup
                      {plan.managedPlanSelected && plan.managedMonthlyAmountCents !== null
                        ? ` + ${formatCurrency(centsToUsd(plan.managedMonthlyAmountCents))}/month`
                        : ""}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Amounts are fixed server-side to the configured Stripe Prices. Stripe refuses
                any checkout whose offer amounts do not match them.
              </p>
              {currentPlanKey === null ? (
                <p className="text-xs text-danger">
                  This offer&apos;s recorded amounts (
                  {formatCurrency(centsToUsd(offer.setupAmountCents))}
                  {offer.managedMonthlyAmountCents !== null
                    ? ` + ${formatCurrency(centsToUsd(offer.managedMonthlyAmountCents))}/month`
                    : ""}
                  ) do not match either configured plan and would be refused at checkout. Saving
                  will reset them to the plan selected above.
                </p>
              ) : null}
            </fieldset>
            <Field label="Description" htmlFor="offer-description">
              <TextArea
                id="offer-description"
                name="description"
                rows={6}
                defaultValue={offer.description}
                disabled={locked}
                required
              />
            </Field>
            {!locked ? (
              <Button type="submit" variant="secondary" disabled={saving}>
                {saving ? "Saving..." : "Save Offer"}
              </Button>
            ) : null}
            {saveState?.error ? <p className="text-xs text-danger">{saveState.error}</p> : null}
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Checkout gate" />
        <CardBody className="space-y-4">
          <CommercialOfferStatusBadge status={offer.status} />
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${stripeMode === "live" ? "text-danger" : stripeMode === "test" ? "text-accent" : "text-muted"}`}
          >
            {MODE_LABEL[stripeMode]}
          </p>
          <p className="break-all font-mono text-[11px] text-muted">
            {offer.contentHash}
          </p>
          {canRequest ? (
            <form action={approvalAction}>
              <input type="hidden" name="offerId" value={offer.id} />
              <Button type="submit" variant="primary" disabled={requesting}>
                {requesting ? "Requesting..." : "Request Approval"}
              </Button>
              {approvalState?.error ? (
                <p className="mt-2 text-xs text-danger">{approvalState.error}</p>
              ) : null}
            </form>
          ) : null}
          {offer.status === "awaiting_approval" ? (
            <p className="text-xs text-muted">Review this checkout action in Approvals.</p>
          ) : null}
          {canCheckout ? (
            <form action={checkoutAction}>
              <input type="hidden" name="offerId" value={offer.id} />
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? "Creating..." : `Create Checkout (${MODE_LABEL[stripeMode]})`}
              </Button>
              <p className="mt-1 text-[11px] text-muted-foreground">
                For internal testing. Customers should use the purchase link below.
              </p>
              {checkoutState?.checkoutUrl ? (
                <p className="mt-2 text-xs">
                  <a href={checkoutState.checkoutUrl} className="text-accent underline">
                    Checkout session created — open for internal testing
                  </a>
                </p>
              ) : null}
              {checkoutState?.error ? (
                <p className="mt-2 text-xs text-danger">{checkoutState.error}</p>
              ) : null}
            </form>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Customer purchase link" />
        <CardBody>
          <PurchaseLinkPanel offer={offer} />
        </CardBody>
      </Card>
    </div>
  );
}
