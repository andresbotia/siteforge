import { createCommercialOfferAction } from "@/app/actions/offers";
import { Button } from "@/components/shared/button";
import { Field, TextArea } from "@/components/shared/field";
import { formatCurrency } from "@/lib/format";
import { centsToUsd } from "@/lib/payments/money";
import { OFFER_PLANS } from "@/lib/payments/plans";
import type { GeneratedWebsite, Lead } from "@/types";

export function CreateOfferForm({
  lead,
  website,
  outreachId,
}: {
  lead: Lead;
  website?: GeneratedWebsite | null;
  outreachId?: string | null;
}) {
  return (
    <form action={createCommercialOfferAction} className="grid gap-3">
      <input type="hidden" name="leadId" value={lead.id} />
      <input type="hidden" name="generatedWebsiteId" value={website?.id ?? ""} />
      <input type="hidden" name="outreachId" value={outreachId ?? ""} />
      <input type="hidden" name="currency" value="usd" />
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Plan
        </legend>
        {OFFER_PLANS.map((plan, index) => (
          <label
            key={plan.key}
            className="flex items-start gap-2 rounded border border-border-subtle p-3 text-sm"
          >
            <input
              type="radio"
              name="planKey"
              value={plan.key}
              defaultChecked={index === 0}
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
      </fieldset>
      <Field label="Description" htmlFor="new-offer-description">
        <TextArea
          id="new-offer-description"
          name="description"
          rows={4}
          defaultValue={`Website rebuild offer for ${lead.businessName}. Includes a one-time implementation payment and optional managed monthly support.`}
          required
        />
      </Field>
      <Button type="submit" variant="primary">
        Create Offer
      </Button>
    </form>
  );
}
