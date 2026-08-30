import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OfferEditor } from "@/components/offers/offer-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { getCommercialOfferById } from "@/data/payments";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type OfferPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: OfferPageProps): Promise<Metadata> {
  const { id } = await params;
  const offer = await getCommercialOfferById(id);
  return { title: offer ? `Offer: ${offer.businessName}` : "Offer" };
}

export default async function OfferDetailPage({ params }: OfferPageProps) {
  const { id } = await params;
  const offer = await getCommercialOfferById(id);
  if (!offer) notFound();

  return (
    <>
      <PageHeader
        title={`Offer: ${offer.businessName}`}
        description="Checkout remains mock-only until a later milestone explicitly enables live Stripe. Payment does not automatically deploy a customer website."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href="/offers" className="text-muted hover:text-foreground">Back to offers</Link>
        <Link href={`/leads/${offer.leadId}`} className="text-accent hover:underline">Open lead</Link>
        {offer.outreachId ? (
          <Link href={`/outreach/${offer.outreachId}`} className="text-accent hover:underline">
            Open outreach
          </Link>
        ) : null}
      </div>
      <OfferEditor offer={offer} />
      <Card className="mt-4">
        <CardHeader title="Checkout sessions" />
        <CardBody>
          {offer.sessions.length === 0 ? (
            <p className="text-sm text-muted">No checkout sessions created.</p>
          ) : (
            <ul className="space-y-2">
              {offer.sessions.map((session) => (
                <li key={session.id} className="rounded border border-border-subtle p-3 text-sm">
                  <p className="font-mono text-xs">{session.stripeCheckoutSessionId}</p>
                  <p className="mt-1 text-muted">
                    {session.status} - {session.mode} - created {formatDateTime(session.createdAt)}
                  </p>
                  {session.checkoutUrl ? (
                    <p className="mt-1 break-all text-xs text-accent">{session.checkoutUrl}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
