import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers } from "@/data/customers";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import {
  CustomerStatusBadge,
  PaymentEnvironmentBadge,
  PlanBadge,
} from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { centsToUsd } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <>
      <PageHeader
        title="Customers"
        description="Website Setup is $99 one time; Managed Website is an optional $39/month. Payment provenance (MOCK / Stripe TEST / Stripe LIVE) is shown per customer -- only LIVE payments count as real revenue."
      />
      <DataTable minWidth="min-w-[920px]">
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Plan</Th>
            <Th>Payment</Th>
            <Th>Setup payment</Th>
            <Th>Managed subscription</Th>
            <Th>Fulfillment status</Th>
            <Th>Joined</Th>
          </tr>
        </THead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={7}
                className="border-t border-border px-3 py-8 text-center text-sm text-muted"
              >
                No customers yet.
              </td>
            </tr>
          ) : null}
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-surface-2/60">
              <Td>
                <Link
                  href={`/customers/${customer.id}`}
                  className="font-medium hover:text-accent"
                >
                  {customer.businessName}
                </Link>
                {customer.leadId ? (
                  <div>
                    <Link
                      href={`/leads/${customer.leadId}`}
                      className="text-xs text-muted hover:text-foreground"
                    >
                      Lead profile
                    </Link>
                  </div>
                ) : null}
              </Td>
              <Td>
                <PlanBadge plan={customer.plan} />
              </Td>
              <Td>
                <PaymentEnvironmentBadge environment={customer.paymentEnvironment} />
              </Td>
              <Td className="tabular-nums text-sm">
                {customer.setupAmountCents !== null
                  ? `${formatCurrency(centsToUsd(customer.setupAmountCents))} paid`
                  : "—"}
              </Td>
              <Td className="text-sm">
                {customer.managedSubscriptionStatus
                  ? `${customer.managedSubscriptionStatus}${
                      customer.paymentEnvironment === "live"
                        ? ` — ${formatCurrency(customer.grossMonthlyAmount, true)}/mo`
                        : ""
                    }`
                  : "None"}
              </Td>
              <Td>
                <CustomerStatusBadge status={customer.status} />
              </Td>
              <Td className="text-muted whitespace-nowrap">
                {formatDate(customer.joinedAt)}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  );
}
