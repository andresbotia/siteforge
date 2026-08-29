"use client";

import { useActionState } from "react";
import {
  startScoutRunAction,
  type ScoutActionState,
} from "@/app/actions/scout";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import { SCOUT_CATEGORIES } from "@/lib/scout/categories";
import {
  SCOUT_DEFAULT_CANDIDATES,
  SCOUT_DISCOVERY_COST_USD,
  SCOUT_MAX_CANDIDATES,
  SCOUT_PROVIDER_LABEL,
} from "@/lib/scout/limits";

const locations = [
  "Fort Lauderdale, FL",
  "Coconut Creek, FL",
  "Boca Raton, FL",
  "Pompano Beach, FL",
];

export function ScoutRunForm() {
  const [state, action, pending] = useActionState<ScoutActionState, FormData>(
    startScoutRunAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field label="Location" htmlFor="scout-location">
        <TextInput
          id="scout-location"
          name="location"
          list="scout-locations"
          defaultValue="Fort Lauderdale, FL"
          required
        />
        <datalist id="scout-locations">
          {locations.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </Field>
      <Field label="Category" htmlFor="scout-category">
        <SelectInput id="scout-category" name="categoryId" defaultValue="plumbers">
          {SCOUT_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field
        label="Candidate limit"
        htmlFor="scout-limit"
        hint={`Maximum ${SCOUT_MAX_CANDIDATES} per manual run.`}
      >
        <TextInput
          id="scout-limit"
          name="limit"
          type="number"
          min={1}
          max={SCOUT_MAX_CANDIDATES}
          defaultValue={SCOUT_DEFAULT_CANDIDATES}
        />
      </Field>
      <div className="rounded-md border border-border-subtle p-3 text-sm">
        <p>
          Discovery cost: ${SCOUT_DISCOVERY_COST_USD.toFixed(2)}
        </p>
        <p className="mt-1 text-muted">
          Provider: {SCOUT_PROVIDER_LABEL}. Paid AI: Not required.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Running…" : "Start Scout Run"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
