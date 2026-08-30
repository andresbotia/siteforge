import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OutreachDetailView } from "@/components/sales/outreach-detail-view";
import { CreateOfferForm } from "@/components/offers/create-offer-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { getOutreachById } from "@/data/outreach";
import { getLeadById } from "@/data/leads";
import { getWebsiteById } from "@/data/websites";

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
  const [lead, website] = await Promise.all([
    getLeadById(outreach.leadId),
    outreach.generatedWebsiteId ? getWebsiteById(outreach.generatedWebsiteId) : null,
  ]);

  return (
    <>
      <PageHeader
        title={`Outreach: ${outreach.businessName}`}
        description="Deterministic email outreach draft with evidence traceability and approval gates."
      />
      <OutreachDetailView outreach={outreach} />
      {lead ? (
        <Card className="mt-6">
          <CardHeader
            title="Commercial offer"
            description="Create an M9 offer connected to this outreach and preview context."
          />
          <CardBody>
            <CreateOfferForm lead={lead} website={website} outreachId={outreach.id} />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
