"use client";

import { useActionState } from "react";
import {
  generateDesignBriefAction,
  type DesignBriefActionState,
} from "@/app/actions/templates";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, TextArea, TextInput } from "@/components/shared/field";

/**
 * Generates a master-template brief for an industry the library does not cover.
 * Local text generation only: it does not call, authorize, or pay for any
 * design tool. The operator decides what to do with the brief.
 */
export function DesignBriefForm() {
  const [state, action, pending] = useActionState<DesignBriefActionState, FormData>(
    generateDesignBriefAction,
    null,
  );

  return (
    <Card className="mt-4">
      <CardHeader
        title="Designer brief"
        description="Produce a provider-neutral brief for a new master template. No paid tool is called and no credits are spent."
      />
      <CardBody className="space-y-4">
        <form action={action} className="grid gap-4">
          <Field
            label="Industry"
            htmlFor="brief-industry"
            hint="Use the lead's industry label, for example 'Auto Glass Repair'."
          >
            <TextInput id="brief-industry" name="industry" required maxLength={80} />
          </Field>
          <Field
            label="Conversion objective"
            htmlFor="brief-objective"
            hint="Optional. What one action should a visitor take? Defaults to calling or messaging within one screen of scrolling."
          >
            <TextArea id="brief-objective" name="conversionObjective" rows={2} maxLength={300} />
          </Field>
          <div>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Generating..." : "Generate brief"}
            </Button>
          </div>
        </form>

        {state && !state.ok ? <p className="text-sm text-danger">{state.error}</p> : null}

        {state?.ok ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={state.newTemplateNeeded ? "warning" : "success"}>
                {state.newTemplateNeeded ? "New master template needed" : "Covered by an existing template"}
              </Badge>
              <span className="font-mono text-xs text-muted">{state.suggestedTemplateKey}</span>
            </div>
            <p className="text-sm text-muted">{state.selectionReason}</p>
            <textarea
              readOnly
              value={state.markdown}
              rows={18}
              aria-label={`Design brief for ${state.industry}`}
              className="w-full rounded-md border border-border bg-surface p-3 font-mono text-xs"
            />
            <p className="text-xs text-muted">
              Hand this to an operator or design agent. Approve the resulting template into the
              registry before any prospect draft uses it.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
