"use client";

import { useActionState } from "react";
import {
  startAuditorRunAction,
  type AuditorActionState,
} from "@/app/actions/auditor";
import { Button } from "@/components/shared/button";
import { AUDITOR_COST_USD } from "@/lib/auditor/limits";

export function AuditRunButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<AuditorActionState, FormData>(
    startAuditorRunAction,
    null,
  );

  return (
    <form action={action} className="grid justify-items-end gap-1">
      <input type="hidden" name="leadId" value={leadId} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Auditing…" : "Run Website Audit"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Audit cost: ${AUDITOR_COST_USD.toFixed(2)} · Paid AI: Not required
      </p>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
