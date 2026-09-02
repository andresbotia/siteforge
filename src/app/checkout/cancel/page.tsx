import type { Metadata } from "next";
import { getPublicCheckoutStatus } from "@/data/payments";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout cancelled",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ offer?: string }>;
};

export default async function CheckoutCancelPage({ searchParams }: PageProps) {
  const { offer: offerId } = await searchParams;
  const status = offerId ? await getPublicCheckoutStatus(offerId) : null;

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Checkout cancelled</h1>
      <p>
        {status
          ? `No payment was made for ${status.businessName}. If this was a mistake, please contact us and we can send a new payment link.`
          : "No payment was made. If this was a mistake, please contact us and we can send a new payment link."}
      </p>
    </main>
  );
}
