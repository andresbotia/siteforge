import type { Metadata } from "next";
import { PurchaseOptions } from "@/components/purchase/purchase-options";
import { resolvePublicPurchaseOffer } from "@/data/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your website offer",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

function UnavailableCard() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        SiteForge
      </p>
      <h1 className="mt-3 text-xl font-semibold text-foreground">
        This link is unavailable
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This purchase link may have expired, been replaced, or is no longer active.
        Please contact us for an updated link.
      </p>
    </main>
  );
}

function AlreadyPurchasedCard({ businessName }: { businessName: string }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        SiteForge
      </p>
      <h1 className="mt-3 text-xl font-semibold text-foreground">You&apos;re all set</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ve already received payment for {businessName}. If you have questions
        about your order, please contact us.
      </p>
    </main>
  );
}

/**
 * Public, unauthenticated customer purchase page. Never resolves an
 * internal offer ID from the URL -- only the opaque sfb_ token. An invalid
 * token, a revoked link, an unapproved offer, and a materially-edited offer
 * (which resets status away from "approved") all render the identical
 * UnavailableCard, so this page never leaks whether an internal offer
 * exists behind a bad token.
 */
export default async function PublicPurchasePage({ params }: PageProps) {
  const { token } = await params;
  const resolution = await resolvePublicPurchaseOffer(token);

  if (!resolution || resolution.kind === "unavailable") {
    return <UnavailableCard />;
  }

  if (resolution.kind === "already_purchased") {
    return <AlreadyPurchasedCard businessName={resolution.businessName} />;
  }

  const { offer } = resolution;

  return (
    <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        SiteForge
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
        Your new website is ready to make yours.
      </h1>
      <p className="mt-2 text-base text-muted-foreground">{offer.businessName}</p>
      <p className="mt-4 text-sm text-muted-foreground">
        We&apos;ve prepared a professional website for {offer.businessName}. Choose how
        you&apos;d like to move forward — a one-time setup, or setup plus ongoing
        management.
      </p>
      <PurchaseOptions token={token} offer={offer} />
    </main>
  );
}
