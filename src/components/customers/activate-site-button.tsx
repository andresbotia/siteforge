"use client";

import { useActionState } from "react";
import {
  activateCustomerSiteAction,
  type ActivateCustomerSiteActionState,
} from "@/app/actions/customers";
import { Button } from "@/components/shared/button";

export function ActivateSiteButton({
  customerId,
  leadId,
}: {
  customerId: string;
  leadId?: string | null;
}) {
  const [state, action, pending] = useActionState<ActivateCustomerSiteActionState, FormData>(
    activateCustomerSiteAction,
    null,
  );

  return (
    <form action={action} className="grid justify-items-start gap-1">
      <input type="hidden" name="customerId" value={customerId} />
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Marking live…" : "Mark site live"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Confirms the domain, DNS, and deploy are done (see FULFILLMENT-RUNBOOK.md). Not
        checked automatically -- this is your confirmation.
      </p>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
