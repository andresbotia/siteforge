"use client";

import { useActionState } from "react";
import {
  importExternalGeneratedSiteAction,
  requestExternalPreviewDeploymentAction,
  type ExternalSiteImportActionState,
} from "@/app/actions/external-sites";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/shared/field";
import type { BuilderCandidate } from "@/data/builder";

export function ExternalSiteImportForm({ leads }: { leads: BuilderCandidate[] }) {
  const [state, action, pending] = useActionState<ExternalSiteImportActionState, FormData>(
    importExternalGeneratedSiteAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        label="Lead"
        htmlFor="external-site-lead"
        hint="The import is bound to this lead ID; business-name-only association is not accepted."
      >
        <SelectInput id="external-site-lead" name="leadId" required defaultValue={leads[0]?.id ?? ""}>
          {leads.length === 0 ? (
            <option value="">No eligible leads</option>
          ) : (
            leads.map((lead) => (
              <option key={lead.id} value={lead.id}>
                {lead.businessName} - {lead.status}
              </option>
            ))
          )}
        </SelectInput>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Provider" htmlFor="external-provider">
          <SelectInput id="external-provider" name="provider" defaultValue="lovable" required>
            <option value="lovable">Lovable</option>
            <option value="manual">Manual</option>
            <option value="other">Other</option>
          </SelectInput>
        </Field>
        <Field label="Provider project ID" htmlFor="external-project">
          <TextInput id="external-project" name="providerProjectId" />
        </Field>
        <Field label="Provider commit SHA" htmlFor="external-commit">
          <TextInput id="external-commit" name="providerCommitSha" />
        </Field>
        <Field
          label="Vercel-controlled preview URL"
          htmlFor="external-controlled-preview"
          hint="Required before public preview approval; provider editor URLs are never prospect-facing."
        >
          <TextInput
            id="external-controlled-preview"
            name="controlledPreviewUrl"
            placeholder="https://example.vercel.app"
          />
        </Field>
        <Field label="Provider preview URL" htmlFor="external-provider-preview">
          <TextInput
            id="external-provider-preview"
            name="providerPreviewUrl"
            placeholder="Admin reference only"
          />
        </Field>
        <Field label="Cost notes" htmlFor="external-cost-notes">
          <TextInput id="external-cost-notes" name="providerCostNotes" placeholder="$0 fixture import" />
        </Field>
        <Field label="Generation credits" htmlFor="external-cost-credits">
          <TextInput id="external-cost-credits" name="generationCostCredits" inputMode="decimal" placeholder="Optional" />
        </Field>
        <Field label="Estimated cost USD" htmlFor="external-cost-usd">
          <TextInput id="external-cost-usd" name="generationCostUsdEstimate" inputMode="decimal" placeholder="0" />
        </Field>
      </div>

      <Field
        label="Source manifest JSON"
        htmlFor="external-manifest"
        hint='Use {"files":[{"path":"package.json","content":"..."}],"packageJson":{"scripts":{"build":"vite build"}}}. Do not paste secrets.'
      >
        <TextArea
          id="external-manifest"
          name="manifest"
          rows={8}
          spellCheck={false}
          placeholder='{"files":[{"path":"src/App.tsx","content":"export default function App(){return null}"}],"packageJson":{"dependencies":{"@vitejs/plugin-react":"latest","vite":"latest","react":"latest"},"scripts":{"build":"vite build"}}}'
          required
        />
      </Field>

      <div className="rounded-md border border-border-subtle p-3 text-sm text-muted">
        This import persists the bounded source manifest as an immutable artifact for review. It does not call Lovable, send email, publish a preview, deploy production, call paid AI, or contact the business.
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending || leads.length === 0}>
          {pending ? "Validating..." : "Import External Draft"}
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

export function RequestExternalPreviewDeploymentForm({
  websiteId,
  disabled,
}: {
  websiteId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<ExternalSiteImportActionState, FormData>(
    requestExternalPreviewDeploymentAction,
    null,
  );

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="websiteId" value={websiteId} />
      <Button type="submit" variant="primary" disabled={pending || disabled}>
        {pending ? "Requesting..." : "Request Preview Deployment"}
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
