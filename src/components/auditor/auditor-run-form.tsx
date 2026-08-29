"use client";

import { useActionState } from "react";
import {
  startAuditorRunAction,
  type AuditorActionState,
} from "@/app/actions/auditor";
import { Button } from "@/components/shared/button";
import { Field, SelectInput } from "@/components/shared/field";
import { AUDITOR_COST_USD, AUDITOR_PROVIDER_LABEL } from "@/lib/auditor/limits";
import type { Lead } from "@/types";

export function AuditorRunForm({
  leads,
  selectedLeadId,
}: {
  leads: Lead[];
  selectedLeadId?: string;
}) {
  const [state, action, pending] = useActionState<AuditorActionState, FormData>(
    startAuditorRunAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Lead"
        htmlFor="auditor-lead"
        hint="Review, qualified, and high-priority Scout leads are listed first. Later-stage leads can be re-audited without moving backward."
      >
        <SelectInput
          id="auditor-lead"
          name="leadId"
          required
          defaultValue={selectedLeadId ?? leads[0]?.id ?? ""}
        >
          {leads.length === 0 ? (
            <option value="">No eligible leads</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} · {lead.status}
                {lead.qualificationTier ? ` · ${lead.qualificationTier}` : ""}
              </option>
            ))
          )}
        </SelectInput>
      </Field>
      <div className="rounded-md border border-border-subtle p-3 text-sm">
        <p>Audit cost: ${AUDITOR_COST_USD.toFixed(2)}</p>
        <p className="mt-1 text-muted">
          {AUDITOR_PROVIDER_LABEL}. Paid AI: Not required.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || leads.length === 0}>
          {pending ? "Auditing…" : "Run Website Audit"}
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
