"use client";

import { useActionState } from "react";
import {
  startBuilderRunAction,
  type BuilderActionState,
} from "@/app/actions/builder";
import { Button } from "@/components/shared/button";
import { Field, SelectInput } from "@/components/shared/field";
import { BUILDER_COST_USD, BUILDER_PROVIDER_LABEL } from "@/lib/builder/limits";
import type { BuilderCandidate } from "@/data/builder";

export function BuilderRunForm({
  leads,
  selectedLeadId,
}: {
  leads: BuilderCandidate[];
  selectedLeadId?: string;
}) {
  const [state, action, pending] = useActionState<BuilderActionState, FormData>(
    startBuilderRunAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Lead"
        htmlFor="builder-lead"
        hint="Audited leads and explicit no-website prospects can receive a $0 template draft. Later-stage leads can be rebuilt without moving backward."
      >
        <SelectInput
          id="builder-lead"
          name="leadId"
          required
          defaultValue={selectedLeadId ?? leads[0]?.id ?? ""}
        >
          {leads.length === 0 ? (
            <option value="">No eligible leads</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} · {lead.status} · {lead.recommendedTemplate}
              </option>
            ))
          )}
        </SelectInput>
      </Field>
      <div className="rounded-md border border-border-subtle p-3 text-sm">
        <p>Build cost: ${BUILDER_COST_USD.toFixed(2)}</p>
        <p className="mt-1 text-muted">
          {BUILDER_PROVIDER_LABEL}. Paid AI: Not required.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || leads.length === 0}>
          {pending ? "Building…" : "Build Website Draft"}
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
