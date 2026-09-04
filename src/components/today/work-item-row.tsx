"use client";

import { useActionState, useState } from "react";
import {
  dismissWorkItemAction,
  snoozeWorkItemAction,
  type WorkItemActionState,
} from "@/app/actions/work-items";
import { Button } from "@/components/shared/button";
import { WORK_ITEM_LABEL, type WorkItemType } from "@/lib/work-items/types";

export type WorkItemRowData = {
  id: string;
  type: WorkItemType;
  need: string;
};

/**
 * M10.6 Task 2. One outstanding item inside a business's queue card. No
 * per-item "Open" link any more -- the business card carries the one "Open"
 * action; this row is just what's needed and the snooze/dismiss controls.
 */
export function WorkItemRow({ item }: { item: WorkItemRowData }) {
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
    <li className="px-4 py-3">
      <p className="text-xs tracking-wide text-muted uppercase">
        {WORK_ITEM_LABEL[item.type]}
      </p>
      <p className="mt-0.5 text-sm text-foreground">{item.need}</p>

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
    </li>
  );
}
