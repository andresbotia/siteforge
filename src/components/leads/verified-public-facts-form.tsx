"use client";

import { useActionState } from "react";
import {
  updateVerifiedPublicFactsAction,
  type VerifiedPublicFactsActionState,
} from "@/app/actions/leads";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextArea, TextInput } from "@/components/shared/field";
import { asRecord } from "@/lib/json";
import { DAY_ORDER } from "@/lib/prospects/verified-public-facts";
import type { DailyHours, SocialPlatform, WebsiteImageAsset } from "@/lib/builder/types";

const SOCIAL_FIELDS: Array<{ platform: SocialPlatform; label: string }> = [
  { platform: "instagram", label: "Instagram URL" },
  { platform: "facebook", label: "Facebook URL" },
  { platform: "tiktok", label: "TikTok URL" },
  { platform: "youtube", label: "YouTube URL" },
  { platform: "x", label: "X URL" },
  { platform: "linkedin", label: "LinkedIn URL" },
];

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
  const dailyHours = readHoursByDay(facts.hoursByDay);
  const socialProfiles = readSocialProfiles(facts.socialProfiles);
  const imageAssets = readImageAssets(summary.imageAssets);

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
        hint="Short public description of the business. Do not include rating, review count, hours, phone, address, or URLs here; use the structured fields below."
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
        <Field label="Legacy public hours" htmlFor="verified-hours" hint="Optional fallback only. Prefer the daily fields below.">
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
      <section className="grid gap-2 rounded-md border border-border p-3">
        <div>
          <h3 className="text-xs font-semibold text-muted">Daily hours</h3>
          <p className="text-[11px] text-muted-foreground">Enter each day separately. Check Closed for closed days.</p>
        </div>
        <div className="grid gap-2">
          {DAY_ORDER.map(({ key, label }) => {
            const row = dailyHours[key];
            return (
              <div key={key} className="grid gap-2 sm:grid-cols-[7rem_1fr_auto] sm:items-center">
                <label className="text-xs text-muted" htmlFor={`verified-hours-${key}`}>
                  {label}
                </label>
                <TextInput
                  id={`verified-hours-${key}`}
                  name={`hours_${key}`}
                  maxLength={60}
                  placeholder="8:00 AM - 10:00 PM"
                  defaultValue={row?.closed ? "" : row?.value ?? ""}
                />
                <label className="inline-flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    name={`hours_${key}_closed`}
                    defaultChecked={row?.closed ?? false}
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </div>
        {errors.hoursByDay ? <ErrorText>{errors.hoursByDay}</ErrorText> : null}
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Legacy social URL" htmlFor="verified-social-url" hint="Optional fallback. Prefer platform fields below.">
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
      <section className="grid gap-3 rounded-md border border-border p-3">
        <div>
          <h3 className="text-xs font-semibold text-muted">Verified social profiles</h3>
          <p className="text-[11px] text-muted-foreground">Only attach profiles the operator has verified as belonging to this business.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {SOCIAL_FIELDS.map(({ platform, label }) => (
            <Field key={platform} label={label} htmlFor={`verified-social-${platform}`}>
              <TextInput
                id={`verified-social-${platform}`}
                name={`social_${platform}`}
                defaultValue={socialProfiles[platform] ?? ""}
                aria-invalid={Boolean(errors.socialProfiles)}
              />
            </Field>
          ))}
        </div>
        {errors.socialProfiles ? <ErrorText>{errors.socialProfiles}</ErrorText> : null}
      </section>
      <section className="grid gap-3 rounded-md border border-border p-3">
        <div>
          <h3 className="text-xs font-semibold text-muted">Approved images</h3>
          <p className="text-[11px] text-muted-foreground">Attach only right-cleared hero/gallery assets. Public platform photos must not be reused unless rights are approved.</p>
        </div>
        {[0, 1, 2, 3].map((index) => {
          const image = imageAssets[index];
          return (
            <div key={index} className="grid gap-2 rounded-md border border-border-subtle p-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label={`Image ${index + 1} URL/reference`} htmlFor={`verified-image-${index}-url`}>
                  <TextInput id={`verified-image-${index}-url`} name={`image_${index}_url`} defaultValue={image?.url ?? ""} />
                </Field>
                <Field label="Alt text" htmlFor={`verified-image-${index}-alt`}>
                  <TextInput id={`verified-image-${index}-alt`} name={`image_${index}_alt`} defaultValue={image?.alt ?? ""} />
                </Field>
                <Field label="Role" htmlFor={`verified-image-${index}-role`}>
                  <SelectInput id={`verified-image-${index}-role`} name={`image_${index}_role`} defaultValue={image?.role ?? "gallery"}>
                    <option value="hero">Hero</option>
                    <option value="gallery">Gallery</option>
                  </SelectInput>
                </Field>
                <Field label="Source type" htmlFor={`verified-image-${index}-source-type`}>
                  <SelectInput id={`verified-image-${index}-source-type`} name={`image_${index}_source_type`} defaultValue={image?.sourceType ?? "business_owned"}>
                    <option value="business_owned">Business owned</option>
                    <option value="operator_uploaded">Operator uploaded</option>
                    <option value="licensed_stock">Licensed stock</option>
                    <option value="approved_public_asset">Approved public asset</option>
                  </SelectInput>
                </Field>
                <Field label="Source URL" htmlFor={`verified-image-${index}-source-url`}>
                  <TextInput id={`verified-image-${index}-source-url`} name={`image_${index}_source_url`} defaultValue={image?.sourceUrl ?? ""} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Rights" htmlFor={`verified-image-${index}-rights`}>
                    <SelectInput id={`verified-image-${index}-rights`} name={`image_${index}_rights_status`} defaultValue={image?.rightsStatus ?? "unknown"}>
                      <option value="unknown">Unknown</option>
                      <option value="approved">Approved</option>
                    </SelectInput>
                  </Field>
                  <Field label="Approval" htmlFor={`verified-image-${index}-approval`}>
                    <SelectInput id={`verified-image-${index}-approval`} name={`image_${index}_approval_status`} defaultValue={image?.approvalStatus ?? "pending"}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                    </SelectInput>
                  </Field>
                </div>
              </div>
            </div>
          );
        })}
        {errors.imageAssets ? <ErrorText>{errors.imageAssets}</ErrorText> : null}
      </section>
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

function readHoursByDay(value: unknown): Partial<Record<string, DailyHours>> {
  const rows = Array.isArray(value) ? value : [];
  return Object.fromEntries(
    rows.flatMap((row) => {
      const item = asRecord(row) as unknown as DailyHours;
      return typeof item.day === "string" ? [[item.day, item]] : [];
    }),
  );
}

function readSocialProfiles(value: unknown): Partial<Record<SocialPlatform, string>> {
  const rows = Array.isArray(value) ? value : [];
  return Object.fromEntries(
    rows.flatMap((row) => {
      const item = asRecord(row);
      return typeof item.platform === "string" && typeof item.url === "string"
        ? [[item.platform as SocialPlatform, item.url]]
        : [];
    }),
  );
}

function readImageAssets(value: unknown): WebsiteImageAsset[] {
  return Array.isArray(value) ? (value as WebsiteImageAsset[]).slice(0, 4) : [];
}

function ErrorText({ children }: { children: string }) {
  return (
    <p className="text-[11px] text-danger" role="alert">
      {children}
    </p>
  );
}
