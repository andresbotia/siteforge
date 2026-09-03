"use client";

import Link from "next/link";
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
  leadId: string;
  businessName: string;
  type: WorkItemType;
  need: string;
};

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
    <li className="rounded border border-border-subtle p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {item.businessName}
          </p>
          <p className="text-xs text-accent">{WORK_ITEM_LABEL[item.type]}</p>
          <p className="mt-0.5 text-xs text-muted">{item.need}</p>
        </div>
        <Link
          href={`/leads/${item.leadId}#next-actions`}
          className="shrink-0 rounded border border-accent px-2.5 py-1 text-xs text-accent hover:bg-surface-hover"
        >
          Open business
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <form action={snooze}>
          <input type="hidden" name="workItemId" value={item.id} />
          <input type="hidden" name="hours" value="24" />
          <Button type="submit" variant="ghost" size="sm" disabled={snoozing}>
            {snoozing ? "Snoozing…" : "Snooze 24h"}
          </Button>
        </form>
        <button
          type="button"
          className="text-xs text-muted hover:text-foreground"
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
            className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
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
