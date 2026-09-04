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
 * M10.6 follow-up. One outstanding item, ONE row inside a business's queue card. The
 * item used to read as its own mini-panel (a stacked label / need /
 * button-row, each at card-header padding) -- so an 8-item card looked like
 * 8 cards with a shared header. Now label+need share a line and the actions
 * are plain inline text, matching Dismiss's existing weight, so a row reads
 * as subordinate to the card rather than as a card of its own. The only
 * separator between rows is the parent `<ul>`'s `divide-y` hairline -- no
 * row draws its own border.
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
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 px-4 py-2">
      <p className="min-w-0 flex-1 text-sm text-foreground">
        <span className="text-xs tracking-wide text-muted uppercase">
          {WORK_ITEM_LABEL[item.type]}
        </span>{" "}
        <span className="text-muted">·</span> {item.need}
      </p>

      <div className="flex shrink-0 items-center gap-3">
        <form action={snooze}>
          <input type="hidden" name="workItemId" value={item.id} />
          <input type="hidden" name="hours" value="24" />
          <button
            type="submit"
            disabled={snoozing}
            className="text-xs text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            {snoozing ? "Snoozing…" : "Snooze 24h"}
          </button>
        </form>
        <button
          type="button"
          className="text-xs text-muted transition-colors hover:text-foreground"
          onClick={() => setShowDismiss((open) => !open)}
        >
          {showDismiss ? "Cancel" : "Dismiss…"}
        </button>
      </div>

      {snoozeState?.error ? (
        <p className="w-full text-xs text-danger">{snoozeState.error}</p>
      ) : null}

      {showDismiss ? (
        <form action={dismiss} className="mt-1 flex w-full flex-wrap items-center gap-2">
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
