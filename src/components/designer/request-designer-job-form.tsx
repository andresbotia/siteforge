"use client";

import { useActionState } from "react";
import { requestDesignerJobAction, type DesignerActionState } from "@/app/actions/designer";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextArea } from "@/components/shared/field";
import type { BuilderCandidate } from "@/data/builder";

export function RequestDesignerJobForm({ leads }: { leads: BuilderCandidate[] }) {
  const [state, action, pending] = useActionState<DesignerActionState, FormData>(
    requestDesignerJobAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Lead"
        htmlFor="designer-lead"
        hint="Choose the lead this design work is for. Requesting a job never contacts the business or spends money by itself."
      >
        <SelectInput id="designer-lead" name="leadId" required defaultValue={leads[0]?.id ?? ""}>
          {leads.length === 0 ? (
            <option value="">No eligible leads</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} · {lead.industry}
              </option>
            ))
          )}
        </SelectInput>
      </Field>
      <Field label="Mode" htmlFor="designer-mode">
        <SelectInput id="designer-mode" name="mode" defaultValue="new_master">
          <option value="new_master">New master template (no approved master covers this industry)</option>
          <option value="adaptation">Adaptation of an approved master</option>
        </SelectInput>
      </Field>
      <Field
        label="Reason"
        htmlFor="designer-reason"
        hint="Why does this lead need design work rather than the deterministic Builder?"
      >
        <TextArea
          id="designer-reason"
          name="reason"
          rows={3}
          required
          placeholder="e.g. No approved master covers this industry, and the fallback template would read as generic."
        />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || leads.length === 0}>
          {pending ? "Creating…" : "Create Designer Job"}
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
