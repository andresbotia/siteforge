import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { CommercialOfferStatusBadge } from "@/components/shared/status-badge";
import { listCommercialOffers } from "@/data/payments";
import { centsToUsd } from "@/lib/payments/money";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offers",
};

export default async function OffersPage() {
  const offers = await listCommercialOffers();
  return (
    <>
      <PageHeader
        title="Commercial Offers"
        description="Manual Stripe checkout offers with approval-bound payment execution. Checkout mode (mock/test/live) is shown on each offer."
      />
      <DataTable minWidth="min-w-[820px]">
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Status</Th>
            <Th>Setup</Th>
            <Th>Managed</Th>
            <Th>Created</Th>
            <Th>Action</Th>
          </tr>
        </THead>
        <tbody>
          {offers.length === 0 ? (
            <tr>
              <td colSpan={6} className="border-t border-border-subtle px-3 py-6 text-sm text-muted">
                No commercial offers yet.
              </td>
            </tr>
          ) : null}
          {offers.map((offer) => (
            <tr key={offer.id} className="hover:bg-surface-hover/70">
              <Td>
                <Link href={`/offers/${offer.id}`} className="font-medium hover:text-accent">
                  {offer.businessName}
                </Link>
              </Td>
              <Td>
                <CommercialOfferStatusBadge status={offer.status} />
              </Td>
              <Td>{formatCurrency(centsToUsd(offer.setupAmountCents))}</Td>
              <Td>
                {offer.managedPlanSelected && offer.managedMonthlyAmountCents
                  ? `${formatCurrency(centsToUsd(offer.managedMonthlyAmountCents))}/mo`
                  : "Not selected"}
              </Td>
              <Td className="whitespace-nowrap text-muted">{formatDate(offer.createdAt)}</Td>
              <Td>
                <Link href={`/offers/${offer.id}`} className="text-xs text-accent hover:underline">
                  View
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
