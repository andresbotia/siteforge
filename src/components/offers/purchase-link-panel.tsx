"use client";

import { useActionState, useState } from "react";
import {
  publishPurchaseLinkAction,
  revokePurchaseLinkAction,
  type PurchaseLinkActionState,
} from "@/app/actions/offers";
import { startFollowUpDraftAction, type SalesActionState } from "@/app/actions/sales";
import { Button } from "@/components/shared/button";
import type { CommercialOffer } from "@/types";

/**
 * The raw purchase URL is only ever available in-memory, right after
 * publishAction resolves -- SiteForge stores a hash + hint, never the
 * plaintext token (see purchase-tokens.ts), so it cannot be recovered on a
 * later page load. `justPublished` ties that one-time reveal to the current
 * server-confirmed status still being "active", so revoking clears the
 * reveal even though the underlying action state object is unchanged.
 */
export function PurchaseLinkPanel({ offer }: { offer: CommercialOffer }) {
  const [publishState, publishAction, publishing] = useActionState<
    PurchaseLinkActionState,
    FormData
  >(publishPurchaseLinkAction, null);
  const [revokeState, revokeAction, revoking] = useActionState<
    PurchaseLinkActionState,
    FormData
  >(revokePurchaseLinkAction, null);
  const [followUpState, followUpAction, drafting] = useActionState<SalesActionState, FormData>(
    startFollowUpDraftAction,
    null,
  );
  const [copied, setCopied] = useState(false);

  const justPublished =
    publishState?.ok && offer.purchaseLinkStatus === "active" && publishState.url;
  const statusLabel =
    offer.purchaseLinkStatus === "active"
      ? "Active"
      : offer.purchaseLinkStatus === "revoked"
        ? "Revoked"
        : "Not published";

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Customer purchase link
      </p>
      <p className="text-sm text-foreground">Status: {statusLabel}</p>

      {justPublished ? (
        <div className="space-y-2 rounded border border-border-subtle p-3">
          <p className="break-all font-mono text-xs text-accent">{publishState.url}</p>
          <p className="text-[11px] text-muted-foreground">
            This link is shown once and cannot be recovered later — copy it now to send
            to the customer.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(publishState.url!);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : offer.purchaseLinkStatus === "active" && offer.purchaseTokenHint ? (
        <p className="text-xs text-muted-foreground">
          A purchase link is active (ending …{offer.purchaseTokenHint}). To get a
          shareable link again, revoke this one and publish a new one.
        </p>
      ) : null}

      {offer.purchaseLinkStatus === "active" ? (
        <form action={revokeAction}>
          <input type="hidden" name="offerId" value={offer.id} />
          <Button type="submit" variant="danger" size="sm" disabled={revoking}>
            {revoking ? "Revoking..." : "Revoke"}
          </Button>
        </form>
      ) : offer.status === "approved" ? (
        <form action={publishAction}>
          <input type="hidden" name="offerId" value={offer.id} />
          <Button type="submit" variant="primary" size="sm" disabled={publishing}>
            {publishing ? "Publishing..." : "Publish purchase link"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          Approve this offer to publish a customer purchase link.
        </p>
      )}

      {publishState?.error ? (
        <p className="text-xs text-danger">{publishState.error}</p>
      ) : null}
      {revokeState?.error ? <p className="text-xs text-danger">{revokeState.error}</p> : null}

      {offer.purchaseLinkStatus === "active" ? (
        <div className="space-y-2 border-t border-border-subtle pt-3">
          <p className="text-xs text-muted">
            Draft the payment follow-up email that carries this link. It still requires human
            send approval, and the lead must be marked interested before it can go out.
          </p>
          <form action={followUpAction}>
            <input type="hidden" name="offerId" value={offer.id} />
            <Button type="submit" variant="secondary" size="sm" disabled={drafting}>
              {drafting ? "Drafting..." : "Draft payment follow-up"}
            </Button>
          </form>
          {followUpState?.error ? (
            <p className="text-xs text-danger">{followUpState.error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
