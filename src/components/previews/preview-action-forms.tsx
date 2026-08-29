"use client";

import { useActionState } from "react";
import {
  requestPreviewPublicationAction,
  revokePreviewDeploymentAction,
  type PreviewActionState,
} from "@/app/actions/previews";
import { Button } from "@/components/shared/button";

export function RequestPreviewPublicationForm({
  websiteId,
  disabled,
}: {
  websiteId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<PreviewActionState, FormData>(
    requestPreviewPublicationAction,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="websiteId" value={websiteId} />
      <Button type="submit" variant="primary" size="sm" disabled={pending || disabled}>
        Request Public Preview
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RevokePreviewDeploymentForm({
  websiteId,
  deploymentId,
}: {
  websiteId: string;
  deploymentId: string;
}) {
  const [state, action, pending] = useActionState<PreviewActionState, FormData>(
    revokePreviewDeploymentAction,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="websiteId" value={websiteId} />
      <input type="hidden" name="deploymentId" value={deploymentId} />
      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        Revoke Preview
      </Button>
      {state?.error ? (
        <p className="text-xs text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
