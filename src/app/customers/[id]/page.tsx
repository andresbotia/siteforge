import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  CustomerStatusBadge,
  PaymentEnvironmentBadge,
  PlanBadge,
} from "@/components/shared/status-badge";
import { getCustomerById } from "@/data/customers";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { centsToUsd } from "@/lib/payments/money";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: CustomerPageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);
  return { title: customer?.businessName ?? "Customer" };
}

export default async function CustomerDetailPage({ params }: CustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <>
      <PageHeader
        title={customer.businessName}
        description="Customer conversion record created from approved checkout completion. Payment does not automatically deploy a customer website."
      />
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        <Link href="/customers" className="text-muted hover:text-foreground">Back to customers</Link>
        {customer.leadId ? (
          <Link href={`/leads/${customer.leadId}`} className="text-accent hover:underline">Open lead</Link>
        ) : null}
        {customer.commercialOfferId ? (
          <Link href={`/offers/${customer.commercialOfferId}`} className="text-accent hover:underline">
            Open offer
          </Link>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Customer" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex gap-2">
              <PlanBadge plan={customer.plan} />
              <CustomerStatusBadge status={customer.status} />
              <PaymentEnvironmentBadge environment={customer.paymentEnvironment} />
            </div>
            <p className="text-muted">Stripe customer: {customer.stripeCustomerId ?? "N/A"}</p>
            <p className="text-muted">
              Converted: {customer.convertedAt ? formatDateTime(customer.convertedAt) : "N/A"}
            </p>
            <p className="text-muted">
              Setup payment:{" "}
              {customer.setupAmountCents !== null
                ? formatCurrency(centsToUsd(customer.setupAmountCents))
                : "N/A"}
            </p>
            <p className="text-muted">
              Managed subscription: {customer.managedSubscriptionStatus ?? "None"}
            </p>
            <p className="text-muted">
              Monthly revenue:{" "}
              {customer.paymentEnvironment === "live"
                ? formatCurrency(customer.monthlyRevenue)
                : "Not real revenue"}
            </p>
            {customer.paymentEnvironment !== "live" && customer.grossMonthlyAmount > 0 ? (
              <p className="text-muted">
                {customer.paymentEnvironment === "test" ? "Stripe TEST" : "Mock"} monthly
                amount (not real revenue): {formatCurrency(customer.grossMonthlyAmount)}
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Subscriptions" />
          <CardBody>
            {customer.subscriptions.length === 0 ? (
              <EmptyState title="No subscription rows." />
            ) : (
              <ul className="space-y-2">
                {customer.subscriptions.map((subscription) => (
                  <li
                    key={subscription.id}
                    className="rounded-sm bg-surface-2 p-3 text-sm"
                  >
                    <p>{subscription.status} — {subscription.interval ?? "one_time"}</p>
                    <p className="text-muted">
                      {formatCurrency(Number(subscription.amount_usd))} via {subscription.provider ?? "unknown"}
                    </p>
                    <p className="mt-1 font-mono text-xs break-all text-muted">
                      {subscription.provider_subscription_id ?? "No provider subscription id"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
