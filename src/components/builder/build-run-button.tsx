"use client";

import { useActionState } from "react";
import {
  startBuilderRunAction,
  type BuilderActionState,
} from "@/app/actions/builder";
import { Button } from "@/components/shared/button";
import { BUILDER_COST_USD } from "@/lib/builder/limits";

export function BuildRunButton({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<BuilderActionState, FormData>(
    startBuilderRunAction,
    null,
  );

  return (
    <form action={action} className="grid justify-items-end gap-1">
      <input type="hidden" name="leadId" value={leadId} />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Building…" : "Build Website Draft"}
      </Button>
      <p className="text-[11px] text-muted-foreground">
        Build cost: ${BUILDER_COST_USD.toFixed(2)} · Paid AI: Not required
      </p>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
