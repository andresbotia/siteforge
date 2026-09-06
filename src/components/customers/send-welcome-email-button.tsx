"use client";

import { useActionState, useState } from "react";
import {
  sendWelcomeEmailAction,
  type SendWelcomeEmailActionState,
} from "@/app/actions/customers";
import { Button } from "@/components/shared/button";
import { Field, TextInput } from "@/components/shared/field";

export function SendWelcomeEmailButton({
  customerId,
  leadId,
  defaultSiteUrl,
}: {
  customerId: string;
  leadId?: string | null;
  defaultSiteUrl?: string;
}) {
  const [state, action, pending] = useActionState<SendWelcomeEmailActionState, FormData>(
    sendWelcomeEmailAction,
    null,
  );
  const [siteUrl, setSiteUrl] = useState(defaultSiteUrl ?? "");

  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="customerId" value={customerId} />
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      <Field
        label="Live site URL"
        htmlFor="welcome-email-site-url"
        hint="The domain/hosting/no-lock-in language comes from the same fixed terms used in outreach -- you only supply the link."
      >
        <TextInput
          id="welcome-email-site-url"
          name="siteUrl"
          type="url"
          required
          placeholder="https://example.com"
          value={siteUrl}
          onChange={(event) => setSiteUrl(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" size="sm" disabled={pending} className="justify-self-start">
        {pending ? "Sending…" : "Send welcome email"}
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
