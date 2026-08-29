import type { Metadata } from "next";
import { getAnalytics } from "@/data/dashboard";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { FunnelBars } from "@/components/shared/pipeline";
import { formatCurrency, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics",
};

export default async function AnalyticsPage() {
  const snapshot = await getAnalytics();
  const metrics = [
    { label: "Lead Conversion", value: formatPercent(snapshot.leadConversion) },
    {
      label: "Website Conversion",
      value: formatPercent(snapshot.websiteConversion),
    },
    {
      label: "Outreach Response Rate",
      value: formatPercent(snapshot.outreachResponseRate),
    },
    {
      label: "Sales Conversion",
      value: formatPercent(snapshot.salesConversion),
    },
    { label: "MRR", value: formatCurrency(snapshot.mrr, true) },
    { label: "Agent Cost", value: formatCurrency(snapshot.agentCost) },
    { label: "Cost Per Lead", value: formatCurrency(snapshot.costPerLead) },
    {
      label: "Cost Per Website",
      value: formatCurrency(snapshot.costPerWebsite),
    },
    { label: "Cost Per Sale", value: formatCurrency(snapshot.costPerSale) },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Derived from persisted Supabase records. xAI is not connected."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Funnel"
          description="Discovered through customer, using current persisted records."
        />
        <CardBody>
          <FunnelBars stages={snapshot.funnel} />
        </CardBody>
      </Card>
    </>
  );
}
