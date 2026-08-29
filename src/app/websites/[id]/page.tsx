import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { PreviewManagementCard } from "@/components/previews/preview-management-card";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { WebsiteStatusBadge } from "@/components/shared/status-badge";
import { getPreviewAnalyticsForWebsite } from "@/data/previews";
import { getWebsiteById } from "@/data/websites";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type WebsitePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: WebsitePageProps): Promise<Metadata> {
  const { id } = await params;
  const site = await getWebsiteById(id);
  return { title: site ? `${site.businessName} draft` : "Website" };
}

export default async function WebsiteDetailPage({ params }: WebsitePageProps) {
  const { id } = await params;
  const site = await getWebsiteById(id);
  if (!site) notFound();
  const previewAnalytics = await getPreviewAnalyticsForWebsite(site.id);

  return (
    <>
      <PageHeader
        title={site.businessName}
        description="Internal Builder draft. This is not a public or production website."
        actions={
          site.spec ? (
            <Link href={`/websites/${site.id}/preview`}>
              <Button variant="primary">Open Draft Preview</Button>
            </Link>
          ) : (
            <Button variant="secondary" disabled>
              No renderable spec
            </Button>
          )
        }
      />
      <p className="mb-4 text-xs text-muted">
        <Link href="/websites" className="hover:text-foreground">
          Back to websites
        </Link>
        {" · "}
        <Link href={`/leads/${site.leadId}`} className="hover:text-foreground">
          Lead
        </Link>
        {site.sourceAuditId ? (
          <>
            {" · "}
            <Link href={`/audits/${site.sourceAuditId}`} className="hover:text-foreground">
              Source audit
            </Link>
          </>
        ) : null}
      </p>

      <Card>
        <CardHeader title="Draft metadata" />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Detail label="Status" value={<WebsiteStatusBadge status={site.status} />} />
          <Detail label="Template" value={site.template || site.templateKey || "—"} />
          <Detail label="Build version" value={site.buildVersion ?? "legacy seed"} />
          <Detail label="Built" value={formatDateTime(site.createdAt)} />
          <Detail
            label="Builder run"
            value={site.sourceRunId ?? "—"}
          />
          <Detail label="Internal preview" value={site.previewUrl || "—"} />
        </CardBody>
      </Card>

      <PreviewManagementCard site={site} analytics={previewAnalytics} />

      <Card className="mt-4">
        <CardHeader
          title="Audit fixes addressed"
          description="Problems identified by Auditor and how this draft responds."
        />
        {site.auditFixes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No structured audit-fix mapping on this record.
          </p>
        ) : (
          <ul>
            {site.auditFixes.map((item) => (
              <li
                key={`${item.findingCode}-${item.builderAction}`}
                className="border-t border-border-subtle px-4 py-3 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.addressed ? "success" : "warning"}>
                    {item.addressed ? "Addressed" : "Limited"}
                  </Badge>
                  <span className="text-sm font-medium">{item.findingCode}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{item.builderAction}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Content provenance"
          description="Sourced facts versus derived template copy. Placeholders never invent phone, hours, or reviews."
        />
        {site.contentProvenance.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No provenance stored on this record.</p>
        ) : (
          <ul className="grid gap-2 px-4 py-3 sm:grid-cols-2">
            {site.contentProvenance.map((item) => (
              <li key={item.field} className="text-sm">
                <span className="font-medium">{item.field}</span>
                {" · "}
                <span className="text-muted">{item.provenance}</span>
                {item.source ? <span className="text-muted-foreground"> · {item.source}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 break-all text-sm">{value}</div>
    </div>
  );
}
