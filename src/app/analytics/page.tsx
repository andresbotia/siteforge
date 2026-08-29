import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { FunnelBars } from "@/components/shared/pipeline";
import { mockAnalytics } from "@/data";
import { formatCurrency, formatPercent } from "@/lib/format";

export const metadata: Metadata = {
  title: "Analytics",
};

export default function AnalyticsPage() {
  const metrics = [
    {
      label: "Lead Conversion",
      value: formatPercent(mockAnalytics.leadConversion),
    },
    {
      label: "Website Conversion",
      value: formatPercent(mockAnalytics.websiteConversion),
    },
    {
      label: "Outreach Response Rate",
      value: formatPercent(mockAnalytics.outreachResponseRate),
    },
    {
      label: "Sales Conversion",
      value: formatPercent(mockAnalytics.salesConversion),
    },
    { label: "MRR", value: formatCurrency(mockAnalytics.mrr, true) },
    { label: "Agent Cost", value: formatCurrency(mockAnalytics.agentCost) },
    {
      label: "Cost Per Lead",
      value: formatCurrency(mockAnalytics.costPerLead),
    },
    {
      label: "Cost Per Website",
      value: formatCurrency(mockAnalytics.costPerWebsite),
    },
    {
      label: "Cost Per Sale",
      value: formatCurrency(mockAnalytics.costPerSale),
    },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Derived from the mock operating picture. Agent cost is $0 because agents are not connected."
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
          description="Discovered through customer, using current mock records."
        />
        <CardBody>
          <FunnelBars stages={mockAnalytics.funnel} />
        </CardBody>
      </Card>
    </>
  );
}
