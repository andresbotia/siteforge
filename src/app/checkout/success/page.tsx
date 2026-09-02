import type { Metadata } from "next";
import { getPublicCheckoutStatus } from "@/data/payments";
import { centsToUsd } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ offer?: string }>;
};

/**
 * Public, unauthenticated confirmation page. Deliberately does NOT trust
 * the `session_id` query parameter (Stripe substitutes it into the success
 * URL before the customer's browser ever gets redirected here) as proof of
 * payment -- the verified Stripe webhook updating commercial_offers.status
 * is the only authoritative signal, read fresh on every render.
 */
export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { offer: offerId } = await searchParams;
  const status = offerId ? await getPublicCheckoutStatus(offerId) : null;

  if (!status) {
    return (
      <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif" }}>
        <h1>We could not find that order.</h1>
        <p>If you just completed a payment, please contact us and we will confirm it manually.</p>
      </main>
    );
  }

  const paid = status.status === "paid";

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>{paid ? "Payment confirmed" : "Payment is being confirmed"}</h1>
      <p>
        {paid
          ? `Thank you -- your payment for ${status.businessName} is confirmed.`
          : `Thanks -- we're waiting on final confirmation from Stripe for ${status.businessName}. This usually takes a few seconds. You can refresh this page in a moment.`}
      </p>
      <dl style={{ marginTop: "1.5rem", fontSize: "0.9rem", color: "#555" }}>
        <dt>Website setup</dt>
        <dd>${centsToUsd(status.setupAmountCents).toFixed(2)} one-time</dd>
        {status.managedPlanSelected && status.managedMonthlyAmountCents !== null ? (
          <>
            <dt style={{ marginTop: "0.5rem" }}>Managed website</dt>
            <dd>${centsToUsd(status.managedMonthlyAmountCents).toFixed(2)}/month</dd>
          </>
        ) : null}
      </dl>
    </main>
  );
}
