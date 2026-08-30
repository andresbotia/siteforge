import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OutreachDetailView } from "@/components/sales/outreach-detail-view";
import { PageHeader } from "@/components/shared/page-header";
import { getOutreachById } from "@/data/outreach";

export const dynamic = "force-dynamic";

type OutreachDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: OutreachDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const outreach = await getOutreachById(id);
  return {
    title: outreach ? `Outreach: ${outreach.businessName}` : "Outreach detail",
  };
}

export default async function OutreachDetailPage({
  params,
}: OutreachDetailPageProps) {
  const { id } = await params;
  const outreach = await getOutreachById(id);
  if (!outreach) notFound();

  return (
    <>
      <PageHeader
        title={`Outreach: ${outreach.businessName}`}
        description="Deterministic email outreach draft with evidence traceability and approval gates."
      />
      <OutreachDetailView outreach={outreach} />
    </>
  );
}
