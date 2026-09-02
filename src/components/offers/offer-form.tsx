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
import { Field, TextArea, TextInput } from "@/components/shared/field";
import { CommercialOfferStatusBadge } from "@/components/shared/status-badge";
import type { StripeMode } from "@/lib/payments/config";
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
            <Field label="Setup amount, cents" htmlFor="setup-amount">
              <TextInput
                id="setup-amount"
                name="setupAmountCents"
                inputMode="numeric"
                defaultValue={offer.setupAmountCents}
                disabled={locked}
                required
              />
            </Field>
            <Field label="Managed monthly amount, cents" htmlFor="monthly-amount">
              <TextInput
                id="monthly-amount"
                name="managedMonthlyAmountCents"
                inputMode="numeric"
                defaultValue={offer.managedMonthlyAmountCents ?? ""}
                disabled={locked}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="managedPlanSelected"
                defaultChecked={offer.managedPlanSelected}
                disabled={locked}
              />
              Include managed monthly service
            </label>
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
              {checkoutState?.checkoutUrl ? (
                <p className="mt-2 break-all text-xs text-accent">
                  {checkoutState.checkoutUrl}
                </p>
              ) : null}
              {checkoutState?.error ? (
                <p className="mt-2 text-xs text-danger">{checkoutState.error}</p>
              ) : null}
            </form>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
