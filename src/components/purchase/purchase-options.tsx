"use client";

import { useActionState, useEffect } from "react";
import {
  createPublicCheckoutAction,
  type PublicPurchaseActionState,
} from "@/app/actions/purchase";
import { Button } from "@/components/shared/button";
import { Card } from "@/components/shared/card";
import type { PublicPurchaseOfferSummary } from "@/data/payments";
import { formatCurrency } from "@/lib/format";
import { centsToUsd } from "@/lib/payments/money";

export function PurchaseOptions({
  token,
  offer,
}: {
  token: string;
  offer: PublicPurchaseOfferSummary;
}) {
  const [state, formAction, pending] = useActionState<
    PublicPurchaseActionState,
    FormData
  >(createPublicCheckoutAction, null);

  useEffect(() => {
    if (state?.ok && state.checkoutUrl) {
      window.location.href = state.checkoutUrl;
    }
  }, [state]);

  const setupPrice = formatCurrency(centsToUsd(offer.setupAmountCents));
  const managedPrice =
    offer.managedMonthlyAmountCents !== null
      ? formatCurrency(centsToUsd(offer.managedMonthlyAmountCents))
      : null;

  return (
    <form action={formAction} className="mt-8 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="token" value={token} />

      <Card className="flex flex-col p-5">
        <h2 className="text-base font-semibold text-foreground">Website</h2>
        <p className="mt-1 text-2xl font-semibold text-foreground">{setupPrice}</p>
        <p className="text-xs text-muted-foreground">one time</p>
        <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
          <li>Professional website setup</li>
          <li>Deployment and setup handoff</li>
          <li>Initial implementation of your site</li>
        </ul>
        <Button
          type="submit"
          name="planChoice"
          value="website_only"
          variant="primary"
          className="mt-5 w-full"
          disabled={pending}
        >
          {pending ? "Starting checkout..." : `Get My Website — ${setupPrice}`}
        </Button>
      </Card>

      {offer.managedPlanAvailable && managedPrice ? (
        <Card className="flex flex-col border-accent/40 p-5">
          <h2 className="text-base font-semibold text-foreground">Website + Managed</h2>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {setupPrice} <span className="text-sm font-normal text-muted-foreground">today</span>
          </p>
          <p className="text-xs text-muted-foreground">
            then {managedPrice}/month for ongoing management — optional
          </p>
          <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
            <li>Everything in Website</li>
            <li>Ongoing managed service</li>
          </ul>
          <Button
            type="submit"
            name="planChoice"
            value="website_plus_managed"
            variant="primary"
            className="mt-5 w-full"
            disabled={pending}
          >
            {pending ? "Starting checkout..." : "Get Website + Management"}
          </Button>
        </Card>
      ) : null}

      {state?.error ? (
        <p className="text-sm text-danger sm:col-span-2">{state.error}</p>
      ) : null}
      <p className="text-xs text-muted-foreground sm:col-span-2">
        The {managedPrice ? `${managedPrice}/month management plan` : "management plan"} is
        always optional — you can get your website without it.
      </p>
    </form>
  );
}
