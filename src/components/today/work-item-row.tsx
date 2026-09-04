"use client";

import { useActionState, useState } from "react";
import {
  dismissWorkItemAction,
  snoozeWorkItemAction,
  type WorkItemActionState,
} from "@/app/actions/work-items";
import { Button, LinkButton } from "@/components/shared/button";
import { WORK_ITEM_LABEL, type WorkItemType } from "@/lib/work-items/types";

export type WorkItemRowData = {
  id: string;
  leadId: string;
  businessName: string;
  type: WorkItemType;
  need: string;
};

/**
 * See DESIGN-SYSTEM.md section 5 (list density) and the M10.5 brief: a queue
 * row must read as business name / what's needed / one obvious action, and the
 * position number makes priority legible without reading every row.
 */
export function WorkItemRow({
  item,
  position,
}: {
  item: WorkItemRowData;
  position: number;
}) {
  const [snoozeState, snooze, snoozing] = useActionState<WorkItemActionState, FormData>(
    snoozeWorkItemAction,
    null,
  );
  const [dismissState, dismiss, dismissing] = useActionState<WorkItemActionState, FormData>(
    dismissWorkItemAction,
    null,
  );
  const [showDismiss, setShowDismiss] = useState(false);

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
      <span
        aria-hidden="true"
        className="hidden w-4 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground sm:block"
      >
        {position}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{item.businessName}</p>
        <p className="mt-0.5 text-xs tracking-wide text-muted uppercase">
          {WORK_ITEM_LABEL[item.type]}
        </p>
        <p className="mt-1 text-sm text-muted">{item.need}</p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <form action={snooze}>
            <input type="hidden" name="workItemId" value={item.id} />
            <input type="hidden" name="hours" value="24" />
            <Button type="submit" variant="ghost" size="sm" disabled={snoozing}>
              {snoozing ? "Snoozing…" : "Snooze 24h"}
            </Button>
          </form>
          <button
            type="button"
            className="text-xs text-muted transition-colors hover:text-foreground"
            onClick={() => setShowDismiss((open) => !open)}
          >
            {showDismiss ? "Cancel" : "Dismiss…"}
          </button>
          {snoozeState?.error ? (
            <span className="text-xs text-danger">{snoozeState.error}</span>
          ) : null}
        </div>

        {showDismiss ? (
          <form action={dismiss} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="workItemId" value={item.id} />
            <input
              name="reason"
              required
              placeholder="Why is this not relevant?"
              className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-surface px-2.5 text-sm"
            />
            <Button type="submit" variant="danger" size="sm" disabled={dismissing}>
              {dismissing ? "Dismissing…" : "Dismiss"}
            </Button>
            {dismissState?.error ? (
              <span className="text-xs text-danger">{dismissState.error}</span>
            ) : null}
          </form>
        ) : null}
      </div>

      <LinkButton
        href={`/leads/${item.leadId}#next-actions`}
        variant="primary"
        size="sm"
        className="shrink-0"
      >
        Open
      </LinkButton>
    </li>
  );
}
