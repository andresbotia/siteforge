"use client";

import { useActionState } from "react";
import {
  updateVerifiedPublicFactsAction,
  type VerifiedPublicFactsActionState,
} from "@/app/actions/leads";
import { Button } from "@/components/shared/button";
import { Field, TextArea, TextInput } from "@/components/shared/field";
import { asRecord } from "@/lib/json";

export function VerifiedPublicFactsForm({
  leadId,
  verifiedPublicFacts,
}: {
  leadId: string;
  verifiedPublicFacts: Record<string, unknown> | null;
}) {
  const [state, action, pending] = useActionState<
    VerifiedPublicFactsActionState,
    FormData
  >(updateVerifiedPublicFactsAction, { ok: true });
  const summary = asRecord(verifiedPublicFacts);
  const facts = asRecord(summary.facts);
  const errors = state.ok ? {} : { [state.field ?? "form"]: state.error };

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="leadId" value={leadId} />
      <Field
        label="Verification source URL"
        htmlFor="verified-source-url"
        hint="Public source for manually verified facts."
      >
        <TextInput
          id="verified-source-url"
          name="sourceUrl"
          defaultValue={String(summary.source_url ?? "")}
          aria-invalid={Boolean(errors.sourceUrl)}
        />
        {errors.sourceUrl ? <ErrorText>{errors.sourceUrl}</ErrorText> : null}
      </Field>
      <Field
        label="Public summary"
        htmlFor="verified-description"
        hint="Plain public text only. Do not paste HTML."
      >
        <TextArea
          id="verified-description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={String(facts.description ?? "")}
          aria-invalid={Boolean(errors.description)}
        />
        {errors.description ? <ErrorText>{errors.description}</ErrorText> : null}
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Cuisine / category" htmlFor="verified-cuisine">
          <TextInput
            id="verified-cuisine"
            name="cuisine"
            maxLength={80}
            defaultValue={String(facts.cuisine ?? "")}
            aria-invalid={Boolean(errors.cuisine)}
          />
          {errors.cuisine ? <ErrorText>{errors.cuisine}</ErrorText> : null}
        </Field>
        <Field label="Public hours" htmlFor="verified-hours">
          <TextInput
            id="verified-hours"
            name="hours"
            maxLength={220}
            placeholder="Mon-Sat 10 AM-8 PM"
            defaultValue={String(facts.hours ?? "")}
            aria-invalid={Boolean(errors.hours)}
          />
          {errors.hours ? <ErrorText>{errors.hours}</ErrorText> : null}
        </Field>
        <Field label="Rating" htmlFor="verified-rating">
          <TextInput
            id="verified-rating"
            name="rating"
            type="number"
            min={0}
            max={5}
            step={0.1}
            defaultValue={String(facts.rating ?? "")}
            aria-invalid={Boolean(errors.rating)}
          />
          {errors.rating ? <ErrorText>{errors.rating}</ErrorText> : null}
        </Field>
        <Field label="Review count" htmlFor="verified-review-count">
          <TextInput
            id="verified-review-count"
            name="reviewCount"
            type="number"
            min={0}
            step={1}
            defaultValue={String(facts.reviewCount ?? "")}
            aria-invalid={Boolean(errors.reviewCount)}
          />
          {errors.reviewCount ? <ErrorText>{errors.reviewCount}</ErrorText> : null}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Social URL" htmlFor="verified-social-url">
          <TextInput
            id="verified-social-url"
            name="socialUrl"
            defaultValue={String(facts.socialUrl ?? "")}
            aria-invalid={Boolean(errors.socialUrl)}
          />
          {errors.socialUrl ? <ErrorText>{errors.socialUrl}</ErrorText> : null}
        </Field>
        <Field label="Menu URL" htmlFor="verified-menu-url">
          <TextInput
            id="verified-menu-url"
            name="menuUrl"
            defaultValue={String(facts.menuUrl ?? "")}
            aria-invalid={Boolean(errors.menuUrl)}
          />
          {errors.menuUrl ? <ErrorText>{errors.menuUrl}</ErrorText> : null}
        </Field>
        <Field label="Ordering URL" htmlFor="verified-order-url">
          <TextInput
            id="verified-order-url"
            name="orderUrl"
            defaultValue={String(facts.orderUrl ?? "")}
            aria-invalid={Boolean(errors.orderUrl)}
          />
          {errors.orderUrl ? <ErrorText>{errors.orderUrl}</ErrorText> : null}
        </Field>
        <Field label="Reservation URL" htmlFor="verified-reservation-url">
          <TextInput
            id="verified-reservation-url"
            name="reservationUrl"
            defaultValue={String(facts.reservationUrl ?? "")}
            aria-invalid={Boolean(errors.reservationUrl)}
          />
          {errors.reservationUrl ? <ErrorText>{errors.reservationUrl}</ErrorText> : null}
        </Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          Saving facts does not publish a preview or send outreach.
        </p>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving..." : "Save verified facts"}
        </Button>
      </div>
      {state.ok && state.message ? (
        <p className="text-xs text-success">{state.message}</p>
      ) : null}
      {!state.ok && errors.form ? <ErrorText>{errors.form}</ErrorText> : null}
    </form>
  );
}

function ErrorText({ children }: { children: string }) {
  return (
    <p className="text-[11px] text-danger" role="alert">
      {children}
    </p>
  );
}
