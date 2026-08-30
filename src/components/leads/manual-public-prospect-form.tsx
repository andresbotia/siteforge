"use client";

import { useActionState } from "react";
import {
  importManualPublicProspectAction,
  type ManualPublicProspectActionState,
} from "@/app/actions/leads";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, SelectInput, TextArea, TextInput } from "@/components/shared/field";
import { industries } from "@/lib/constants";

const initialState: ManualPublicProspectActionState = { ok: true };

export function ManualPublicProspectForm() {
  const [state, formAction, pending] = useActionState(
    importManualPublicProspectAction,
    initialState,
  );

  return (
    <Card className="mb-4">
      <CardHeader
        title="Add public prospect"
        description="Manual M9.5B import for public business data only."
      />
      <CardBody>
        <form action={formAction} className="grid gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Field label="Business name" htmlFor="manual-business-name">
              <TextInput
                id="manual-business-name"
                name="businessName"
                required
                minLength={2}
                placeholder="Example Plumbing Co."
              />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field
              label="Website"
              htmlFor="manual-website-url"
              hint="Public http/https only."
            >
              <TextInput
                id="manual-website-url"
                name="websiteUrl"
                required
                placeholder="example.com"
              />
            </Field>
          </div>
          <div>
            <Field label="Location" htmlFor="manual-location">
              <TextInput
                id="manual-location"
                name="location"
                required
                placeholder="Miami, FL"
              />
            </Field>
          </div>
          <div>
            <Field label="Industry" htmlFor="manual-industry">
              <SelectInput id="manual-industry" name="industry" required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                {industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div>
            <Field label="Phone" htmlFor="manual-phone">
              <TextInput
                id="manual-phone"
                name="phone"
                type="tel"
                placeholder="Optional"
              />
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="Address" htmlFor="manual-address">
              <TextInput
                id="manual-address"
                name="address"
                placeholder="Optional public address"
              />
            </Field>
          </div>
          <div className="lg:col-span-3">
            <Field label="Source note" htmlFor="manual-source-note">
              <TextArea
                id="manual-source-note"
                name="sourceNote"
                rows={2}
                maxLength={300}
                placeholder="Where the public info came from"
              />
            </Field>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Adding..." : "Add prospect"}
            </Button>
            {!state.ok && state.error ? (
              <p className="text-xs text-danger">{state.error}</p>
            ) : null}
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Public business data only. No outreach, payment, paid AI, or customer
          production deployment will run.
        </p>
      </CardBody>
    </Card>
  );
}
