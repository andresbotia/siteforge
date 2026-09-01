"use client";

import { useActionState } from "react";
import { recordVisualReviewAction, type DesignerActionState } from "@/app/actions/designer";
import { Button } from "@/components/shared/button";
import { Field, SelectInput, TextArea } from "@/components/shared/field";

/**
 * The only UI in SiteForge that can move a Designer Job to `approved`. This
 * always posts through recordVisualReviewAction, which requires an admin
 * session and only accepts the transition from visual_review_required. No
 * worker, QA result, or automated process can reach this outcome.
 */
export function VisualReviewForm({ jobId }: { jobId: string }) {
  const [state, action, pending] = useActionState<DesignerActionState, FormData>(
    recordVisualReviewAction,
    null,
  );

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="jobId" value={jobId} />
      <Field label="Would you confidently send this to the business owner?" htmlFor="review-status">
        <SelectInput id="review-status" name="status" defaultValue="needs_revision">
          <option value="approved">Approved -- ready to become a reusable candidate</option>
          <option value="needs_revision">Needs revision -- not ready yet</option>
          <option value="rejected">Rejected -- do not reuse this candidate</option>
        </SelectInput>
      </Field>
      <Field
        label="Notes"
        htmlFor="review-notes"
        hint="Optional, but useful: hero, typography, imagery, mobile, conversion, overall."
      >
        <TextArea id="review-notes" name="notes" rows={4} placeholder="What would need to change, or why this is a strong candidate." />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Record Visual Review"}
        </Button>
      </div>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <p className="text-xs text-success">Saved.</p> : null}
    </form>
  );
}
