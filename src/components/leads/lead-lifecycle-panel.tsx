"use client";

import { useActionState, useState } from "react";
import {
  updateLeadStatusAction,
  updateLeadSuggestedDomainAction,
  type LeadLifecycleActionState,
} from "@/app/actions/leads";
import { Button } from "@/components/shared/button";
import { Field, TextInput } from "@/components/shared/field";
import { LeadStatusBadge } from "@/components/shared/status-badge";
import { leadStatusLabel } from "@/lib/labels";
import { operatorSelectableStatuses } from "@/lib/leads/lifecycle";
import type { Lead } from "@/types";

/**
 * Presentation only. Which transitions exist comes from the shared
 * allowed-transitions table (`src/lib/leads/lifecycle.ts`); the server action
 * re-checks it independently, so a tampered form cannot produce a transition
 * this list does not offer.
 */
export function LeadLifecyclePanel({ lead }: { lead: Lead }) {
  const [statusState, statusAction, savingStatus] = useActionState<
    LeadLifecycleActionState,
    FormData
  >(updateLeadStatusAction, null);
  const [domainState, domainAction, savingDomain] = useActionState<
    LeadLifecycleActionState,
    FormData
  >(updateLeadSuggestedDomainAction, null);

  const options = operatorSelectableStatuses(lead.status);
  const [nextStatus, setNextStatus] = useState<string>(options[0] ?? "");

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <LeadStatusBadge status={lead.status} />
          {lead.archivedReason ? (
            <span className="text-xs text-muted">Archived: {lead.archivedReason}</span>
          ) : null}
        </div>

        {options.length === 0 ? (
          <p className="text-xs text-muted">
            This lead is archived. Archived is a terminal state -- no further transition is
            available from the console.
          </p>
        ) : (
          <form action={statusAction} className="grid gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <Field label="Move lead to" htmlFor="lead-next-status">
              <select
                id="lead-next-status"
                name="nextStatus"
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              >
                {options.map((status) => (
                  <option key={status} value={status}>
                    {leadStatusLabel[status]}
                  </option>
                ))}
              </select>
            </Field>
            {nextStatus === "archived" ? (
              <Field label="Reason (required to archive)" htmlFor="lead-archive-reason">
                <TextInput
                  id="lead-archive-reason"
                  name="archivedReason"
                  placeholder="e.g. went quiet after two follow-ups"
                  required
                />
              </Field>
            ) : null}
            <Button type="submit" variant="secondary" size="sm" disabled={savingStatus}>
              {savingStatus ? "Saving..." : "Update status"}
            </Button>
            {statusState?.error ? (
              <p className="text-xs text-danger" role="alert">
                {statusState.error}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <form action={domainAction} className="grid gap-2 border-t border-border-subtle pt-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <Field label="Suggested domain (optional)" htmlFor="lead-suggested-domain">
          <TextInput
            id="lead-suggested-domain"
            name="suggestedDomain"
            defaultValue={lead.suggestedDomain ?? ""}
            placeholder="exampleplumbing.com"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Operator-supplied example only. SiteForge does not check availability, and outreach
          copy never claims the domain is available -- you are responsible for having checked.
        </p>
        <Button type="submit" variant="secondary" size="sm" disabled={savingDomain}>
          {savingDomain ? "Saving..." : "Save domain"}
        </Button>
        {domainState?.error ? (
          <p className="text-xs text-danger" role="alert">
            {domainState.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
