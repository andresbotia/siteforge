import type { Metadata } from "next";
import Link from "next/link";
import { listCustomers } from "@/data/customers";
import { DataTable, Td, Th, THead } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import {
  CustomerStatusBadge,
  PlanBadge,
} from "@/components/shared/status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { customerPlanPrice } from "@/lib/labels";

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
        description="Mock pricing only: Website Only is $99 one time, Managed is $39/month. Payments are not implemented."
      />
      <DataTable minWidth="min-w-[760px]">
        <THead>
          <tr>
            <Th>Business</Th>
            <Th>Website</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
            <Th>Monthly Revenue</Th>
            <Th>Joined</Th>
          </tr>
        </THead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="border-t border-border-subtle px-3 py-6 text-sm text-muted"
              >
                No customers yet.
              </td>
            </tr>
          ) : null}
          {customers.map((customer) => (
            <tr key={customer.id} className="hover:bg-surface-hover/70">
              <Td>
                {customer.leadId ? (
                  <Link
                    href={`/leads/${customer.leadId}`}
                    className="font-medium hover:text-accent"
                  >
                    {customer.businessName}
                  </Link>
                ) : (
                  customer.businessName
                )}
              </Td>
              <Td className="max-w-[240px] truncate text-xs text-muted">
                {customer.website.replace("https://", "")}
              </Td>
              <Td>
                <div className="flex flex-col gap-1">
                  <PlanBadge plan={customer.plan} />
                  <span className="text-[11px] text-muted-foreground">
                    {customerPlanPrice[customer.plan]}
                  </span>
                </div>
              </Td>
              <Td>
                <CustomerStatusBadge status={customer.status} />
              </Td>
              <Td className="tabular-nums">
                {formatCurrency(customer.monthlyRevenue, true)}
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
