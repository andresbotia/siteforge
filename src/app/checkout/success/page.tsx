import type { Metadata } from "next";
import { Card, CardBody } from "@/components/shared/card";
import { getPublicCheckoutStatus } from "@/data/payments";
import { formatCurrency } from "@/lib/format";
import { centsToUsd } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ offer?: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">{children}</main>;
}

function Eyebrow() {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      SiteForge
    </p>
  );
}

/**
 * Public, unauthenticated confirmation page. Deliberately does NOT trust
 * the `session_id` query parameter (Stripe substitutes it into the success
 * URL before the customer's browser ever gets redirected here) as proof of
 * payment -- the verified Stripe webhook updating commercial_offers.status
 * is the only authoritative signal, read fresh on every render. A payment
 * is never shown as confirmed until that database state says so.
 */
export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { offer: offerId } = await searchParams;
  const status = offerId ? await getPublicCheckoutStatus(offerId) : null;

  if (!status) {
    return (
      <Shell>
        <Eyebrow />
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          We could not find that order.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          If you just completed a payment, please contact us and we will confirm it
          manually.
        </p>
      </Shell>
    );
  }

  if (status.status === "expired" || status.status === "cancelled") {
    return (
      <Shell>
        <Eyebrow />
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          This checkout is no longer active.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          For {status.businessName}, this checkout was {status.status}. Please contact
          us if you&apos;d like a new purchase link.
        </p>
      </Shell>
    );
  }

  const paid = status.status === "paid";

  return (
    <Shell>
      <Eyebrow />
      <h1 className="mt-3 text-2xl font-semibold text-foreground">
        {paid ? "Payment confirmed" : "Payment processing"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {paid
          ? `Thank you — we've received your order for ${status.businessName}.`
          : `We're confirming your payment for ${status.businessName}. This usually takes just a few seconds — you can refresh this page in a moment.`}
      </p>

      <Card className="mt-6">
        <CardBody className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Order summary
          </p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">Website setup</span>
            <span className="text-muted-foreground">
              {formatCurrency(centsToUsd(status.setupAmountCents))} one-time
            </span>
          </div>
          {status.managedPlanSelected && status.managedMonthlyAmountCents !== null ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">Managed website</span>
              <span className="text-muted-foreground">
                {formatCurrency(centsToUsd(status.managedMonthlyAmountCents))}/month
              </span>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {paid ? (
        <Card className="mt-4">
          <CardBody className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              What happens next
            </p>
            <p className="text-sm text-muted-foreground">
              Your order is now in our setup queue. SiteForge will prepare your website
              for the next fulfillment step. We&apos;ll be in touch as your site moves
              forward — nothing further is required from you right now.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </Shell>
  );
}
