import type { Metadata } from "next";
import Link from "next/link";
import { ExternalSiteImportForm } from "@/components/builder/external-site-import-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { listEligibleLeadsForBuild } from "@/data/builder";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import External Site",
};

export default async function ImportExternalSitePage() {
  const leads = await listEligibleLeadsForBuild();

  return (
    <>
      <PageHeader
        title="Import External Site"
        description="Admin-only import for approved external generated source. Imported source is stored as an immutable artifact before deployment approval."
      />
      <p className="mb-4 text-xs text-muted">
        <Link href="/websites" className="hover:text-foreground">
          Back to websites
        </Link>
        {" / "}
        <Link href="/agents/builder" className="hover:text-foreground">
          Builder
        </Link>
      </p>
      <Card>
        <CardHeader
          title="External generated source"
          description="Paste the bounded source manifest supplied by the operator. Deployment is a separate approval-gated step."
        />
        <CardBody>
          <ExternalSiteImportForm leads={leads} />
        </CardBody>
      </Card>
    </>
  );
}
