"use client";

import { useActionState } from "react";
import {
  startSalesDraftAction,
  type SalesActionState,
} from "@/app/actions/sales";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import type { SalesCandidate } from "@/data/sales";
import { SALES_COST_USD, SALES_PROVIDER_ID } from "@/lib/sales/limits";

export function SalesDraftForm({
  leads,
  selectedLeadId,
}: {
  leads: SalesCandidate[];
  selectedLeadId?: string;
}) {
  const [state, action, pending] = useActionState<SalesActionState, FormData>(
    startSalesDraftAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Eligible Lead"
        htmlFor="sales-lead"
        hint="Requires an active approved M7 preview deployment. Drafts are generated deterministically at $0."
      >
        <SelectInput
          id="sales-lead"
          name="leadId"
          required
          defaultValue={selectedLeadId ?? leads[0]?.id ?? ""}
        >
          {leads.length === 0 ? (
            <option value="">No eligible leads with active preview</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} - {lead.status} (Preview: {lead.previewTokenHint})
              </option>
            ))
          )}
        </SelectInput>
      </Field>

      <Field
        label="Recipient Email (Optional Override)"
        htmlFor="sales-recipient"
        hint="Leave blank to use the lead's email on file. If absent, you can enter it later before approval."
      >
        <TextInput
          id="sales-recipient"
          name="recipientEmail"
          type="email"
          placeholder="e.g. owner@business.com"
        />
      </Field>

      <div className="rounded-md border border-border-subtle p-3 text-sm">
        <p className="font-medium text-foreground">Draft cost: ${SALES_COST_USD.toFixed(2)}</p>
        <p className="mt-1 text-muted">
          Provider: {SALES_PROVIDER_ID}. Paid AI: Not required.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Human approval is required before sending. No real email is sent during test mode.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || leads.length === 0}>
          {pending ? "Drafting..." : "Draft Outreach Email"}
        </Button>
      </div>

      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
