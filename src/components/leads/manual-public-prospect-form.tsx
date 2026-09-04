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

/**
 * M10.6 Task 4. `bare` renders just the form (no Card chrome) for use inside
 * a Dialog, which already supplies the title/description/border -- nesting
 * a bordered Card inside the Dialog's own bordered panel would be exactly
 * the "box inside a box" the M10.6 restraint pass rules out. Standalone
 * (`bare` false, the default) keeps the original Card-wrapped presentation
 * for any future non-dialog use.
 */
export function ManualPublicProspectForm({ bare = false }: { bare?: boolean } = {}) {
  const [state, formAction, pending] = useActionState(
    importManualPublicProspectAction,
    initialState,
  );
  const values = state.values;
  const errors = state.fieldErrors ?? {};
  const noStandaloneWebsite = values?.noStandaloneWebsite === true;

  const content = (
    <>
      <form action={formAction} className="grid gap-3 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Field label="Business name" htmlFor="manual-business-name">
            <TextInput
              id="manual-business-name"
              name="businessName"
              required
              minLength={2}
              placeholder="Example Plumbing Co."
              defaultValue={values?.businessName ?? ""}
              aria-invalid={Boolean(errors.businessName)}
              aria-describedby={errors.businessName ? "manual-business-name-error" : undefined}
            />
            {errors.businessName ? (
              <p id="manual-business-name-error" className="text-xs text-danger">
                {errors.businessName}
              </p>
            ) : null}
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field
            label="Website"
            htmlFor="manual-website-url"
            hint="Public http/https only unless no standalone website is manually verified."
          >
            <TextInput
              id="manual-website-url"
              name="websiteUrl"
              placeholder="example.com"
              defaultValue={values?.websiteUrl ?? ""}
              aria-invalid={Boolean(errors.websiteUrl)}
              aria-describedby={errors.websiteUrl ? "manual-website-url-error" : undefined}
            />
            {errors.websiteUrl ? (
              <p id="manual-website-url-error" className="text-xs text-danger">
                {errors.websiteUrl}
              </p>
            ) : null}
          </Field>
        </div>
        <div className="lg:col-span-2">
          <label className="flex items-start gap-2 rounded-sm border border-border p-3 text-sm">
            <input
              type="checkbox"
              name="noStandaloneWebsite"
              className="mt-0.5 size-4 accent-accent"
              defaultChecked={noStandaloneWebsite}
            />
            <span>
              <span className="block font-medium text-foreground">
                No standalone website
              </span>
              <span className="mt-1 block text-xs text-muted">
                Use only after manual public verification. Website URL stays
                blank and no Auditor crawl runs.
              </span>
            </span>
          </label>
        </div>
        <div>
          <Field label="Location" htmlFor="manual-location" hint="Example: Coconut Creek, FL">
            <TextInput
              id="manual-location"
              name="location"
              required
              placeholder="Coconut Creek, FL"
              defaultValue={values?.location ?? ""}
              aria-invalid={Boolean(errors.location)}
              aria-describedby={errors.location ? "manual-location-error" : undefined}
            />
            {errors.location ? (
              <p id="manual-location-error" className="text-xs text-danger">
                {errors.location}
              </p>
            ) : null}
          </Field>
        </div>
        <div>
          <Field label="Industry" htmlFor="manual-industry">
            <SelectInput
              id="manual-industry"
              name="industry"
              required
              defaultValue={values?.industry ?? ""}
              aria-invalid={Boolean(errors.industry)}
              aria-describedby={errors.industry ? "manual-industry-error" : undefined}
            >
              <option value="" disabled>
                Select
              </option>
              {industries.map((industry) => (
                <option key={industry} value={industry}>
                  {industry}
                </option>
              ))}
            </SelectInput>
            {errors.industry ? (
              <p id="manual-industry-error" className="text-xs text-danger">
                {errors.industry}
              </p>
            ) : null}
          </Field>
        </div>
        <div>
          <Field label="Phone" htmlFor="manual-phone">
            <TextInput
              id="manual-phone"
              name="phone"
              type="tel"
              placeholder="Optional"
              defaultValue={values?.phone ?? ""}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "manual-phone-error" : undefined}
            />
            {errors.phone ? (
              <p id="manual-phone-error" className="text-xs text-danger">
                {errors.phone}
              </p>
            ) : null}
          </Field>
        </div>
        <div className="lg:col-span-2">
          <Field label="Address" htmlFor="manual-address">
            <TextInput
              id="manual-address"
              name="address"
              placeholder="Optional public address"
              defaultValue={values?.address ?? ""}
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
              defaultValue={values?.sourceNote ?? ""}
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
    </>
  );

  if (bare) return content;

  return (
    <Card className="mb-4">
      <CardHeader
        title="Add public prospect"
        description="Manual M9.5B import for public business data only."
      />
      <CardBody>{content}</CardBody>
    </Card>
  );
}
