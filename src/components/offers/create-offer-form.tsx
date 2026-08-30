import { createCommercialOfferAction } from "@/app/actions/offers";
import { Button } from "@/components/shared/button";
import { Field, TextArea, TextInput } from "@/components/shared/field";
import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";
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
      <Field label="Setup amount, cents" htmlFor="new-setup-amount">
        <TextInput
          id="new-setup-amount"
          name="setupAmountCents"
          inputMode="numeric"
          defaultValue={DEFAULT_SETUP_AMOUNT_CENTS}
          required
        />
      </Field>
      <Field label="Managed monthly amount, cents" htmlFor="new-monthly-amount">
        <TextInput
          id="new-monthly-amount"
          name="managedMonthlyAmountCents"
          inputMode="numeric"
          defaultValue={DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="managedPlanSelected" />
        Include managed monthly service
      </label>
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
