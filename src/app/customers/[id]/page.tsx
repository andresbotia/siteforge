import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  CustomerStatusBadge,
  PaymentEnvironmentBadge,
  PlanBadge,
} from "@/components/shared/status-badge";
import { getCustomerById } from "@/data/customers";
import { formatCurrency, formatDateTime } from "@/lib/format";

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
              Monthly revenue:{" "}
              {customer.paymentEnvironment === "live"
                ? formatCurrency(customer.monthlyRevenue)
                : "Not real revenue"}
            </p>
            {customer.paymentEnvironment !== "live" && customer.grossMonthlyAmount > 0 ? (
              <p className="text-muted">
                Mock monthly amount: {formatCurrency(customer.grossMonthlyAmount)}
              </p>
            ) : null}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Subscriptions" />
          <CardBody>
            {customer.subscriptions.length === 0 ? (
              <p className="text-sm text-muted">No subscription rows.</p>
            ) : (
              <ul className="space-y-2">
                {customer.subscriptions.map((subscription) => (
                  <li key={subscription.id} className="rounded border border-border-subtle p-3 text-sm">
                    <p>{subscription.status} - {subscription.interval ?? "one_time"}</p>
                    <p className="text-muted">
                      {formatCurrency(Number(subscription.amount_usd))} via {subscription.provider ?? "unknown"}
                    </p>
                    <p className="break-all font-mono text-[11px] text-muted">
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
