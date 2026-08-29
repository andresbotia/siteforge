"use client";

import { useActionState, useState } from "react";
import {
  approveApprovalAction,
  rejectApprovalAction,
  type ApprovalActionState,
} from "@/app/actions/approvals";
import { Button } from "@/components/shared/button";
import { Field, TextInput } from "@/components/shared/field";
import { formatTicksAsUsd, usdToTicks } from "@/lib/ai/money";
import type { Approval } from "@/types";

export function ApprovalActions({ approval }: { approval: Approval }) {
  const [approveState, approveAction, approvePending] = useActionState<
    ApprovalActionState,
    FormData
  >(approveApprovalAction, null);
  const [rejectState, rejectAction, rejectPending] = useActionState<
    ApprovalActionState,
    FormData
  >(rejectApprovalAction, null);

  const paid = approval.type === "paid_ai_usage";
  const defaultMax = approval.requestedMaxUsd ?? approval.estimatedCostUsd ?? 0.1;
  const [maxUsd, setMaxUsd] = useState(defaultMax);

  return (
    <div className="mt-4 space-y-3">
      {paid ? (
        <form action={approveAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="approvalId" value={approval.id} />
          <input type="hidden" name="approvalType" value={approval.type} />
          <input
            type="hidden"
            name="approvalPayloadAction"
            value={approval.payloadAction ?? ""}
          />
          <Field label="Maximum authorization (USD)" htmlFor={`max-${approval.id}`}>
            <TextInput
              id={`max-${approval.id}`}
              name="maxUsd"
              type="number"
              min={0.0001}
              step="0.01"
              value={maxUsd}
              onChange={(event) => setMaxUsd(Number(event.target.value))}
              required
            />
          </Field>
          <Button type="submit" size="sm" variant="primary" disabled={approvePending}>
            {`Approve up to ${formatTicksAsUsd(usdToTicks(maxUsd || defaultMax))}`}
          </Button>
        </form>
      ) : (
        <form action={approveAction} className="inline">
          <input type="hidden" name="approvalId" value={approval.id} />
          <input type="hidden" name="approvalType" value={approval.type} />
          <input
            type="hidden"
            name="approvalPayloadAction"
            value={approval.payloadAction ?? ""}
          />
          <Button type="submit" size="sm" variant="primary" disabled={approvePending}>
            Approve
          </Button>
        </form>
      )}
      <form action={rejectAction} className="inline">
        <input type="hidden" name="approvalId" value={approval.id} />
        <Button type="submit" size="sm" variant="danger" disabled={rejectPending}>
          Reject
        </Button>
      </form>
      {approveState?.error || rejectState?.error ? (
        <p className="text-xs text-danger" role="alert">
          {approveState?.error ?? rejectState?.error}
        </p>
      ) : null}
      {approveState?.publicPath ? (
        <div className="rounded-md border border-border-subtle bg-background p-3 text-xs">
          <p className="font-medium text-foreground">Public preview link created</p>
          <p className="mt-1 text-muted">
            This full tokenized path is only shown immediately after approval.
          </p>
          <code className="mt-2 block break-all rounded bg-surface px-2 py-1 text-foreground">
            {approveState.publicPath}
          </code>
        </div>
      ) : null}
    </div>
  );
}
