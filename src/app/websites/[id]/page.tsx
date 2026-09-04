import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { RequestExternalPreviewDeploymentForm } from "@/components/builder/external-site-import-form";
import { TemplateQaCard } from "@/components/builder/template-qa-card";
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
          <Detail label="Source" value={site.generationSource === "external_generated" ? "External generated" : "Deterministic Builder"} />
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

      {site.spec && site.generationSource !== "external_generated" ? (
        <TemplateQaCard spec={site.spec} />
      ) : null}

      {site.externalGeneratedSite ? (
        <Card className="mt-4">
          <CardHeader
            title="External generated review"
            description="Provider metadata is admin-only. Public preview approval remains blocked until the immutable artifact is deployed to SiteForge-controlled Vercel preview hosting."
            action={
              <Badge tone={site.externalGeneratedSite.validation.ok ? "success" : "danger"}>
                {site.externalGeneratedSite.lifecycleStatus}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Provider reference" value={site.externalGeneratedSite.externalProvider} />
              <Detail label="Provider project ID" value={site.externalGeneratedSite.providerProjectId ?? "none"} />
              <Detail label="Provider commit" value={site.externalGeneratedSite.providerCommitSha ?? "none"} />
              <Detail label="Provider preview URL - admin only" value={site.externalGeneratedSite.providerPreviewUrl ?? "none"} />
              <Detail label="Artifact ID" value={site.externalGeneratedSite.artifactId ?? "missing"} />
              <Detail label="Artifact status" value={site.externalGeneratedSite.lifecycleStatus} />
              <Detail label="Artifact fingerprint" value={site.externalGeneratedSite.sourceManifestFingerprint ?? "missing"} />
              <Detail label="Source type" value={site.externalGeneratedSite.sourceArtifact.sourceType === "zip_archive" ? "ZIP archive" : "JSON manifest"} />
              <Detail label="Archive file" value={site.externalGeneratedSite.sourceArtifact.archiveFileName ?? "none"} />
              <Detail label="Source files" value={site.externalGeneratedSite.sourceArtifact.fileCount?.toString() ?? "unknown"} />
              <Detail label="Source bytes" value={site.externalGeneratedSite.sourceArtifact.totalBytes?.toLocaleString() ?? "unknown"} />
              <Detail label="Static assets" value={site.externalGeneratedSite.sourceArtifact.assetCount?.toString() ?? "0"} />
              <Detail label="Detected stack" value={`${site.externalGeneratedSite.sourceArtifact.detectedFramework} / ${site.externalGeneratedSite.sourceArtifact.packageManager}`} />
              <Detail label="Fact fingerprint" value={site.externalGeneratedSite.verifiedFactFingerprint || "none"} />
              <Detail label="Validation status" value={site.externalGeneratedSite.validation.status} />
              <Detail label="Build status" value={`${site.externalGeneratedSite.build.status} - ${site.externalGeneratedSite.build.reason}`} />
              <Detail label="Deployment status" value={site.externalGeneratedSite.deploymentStatus} />
              <Detail label="SiteForge/Vercel deployment ID - generated" value={site.externalGeneratedSite.deploymentId ?? "none"} />
              <Detail label="SiteForge/Vercel deployment URL - generated" value={site.externalGeneratedSite.deploymentUrl ?? "none"} />
              <Detail
                label="Public SiteForge preview"
                value={
                  previewAnalytics.deployment
                    ? `${previewAnalytics.deployment.status} token ...${previewAnalytics.deployment.tokenHint}`
                    : previewAnalytics.pendingApprovalId
                      ? "approval pending"
                      : "not published"
                }
              />
            </div>
            {site.externalGeneratedSite.deploymentFailureSummary ? (
              <div className="rounded-md border border-danger/30 bg-danger-muted p-3 text-sm text-danger">
                {site.externalGeneratedSite.deploymentFailureSummary}
              </div>
            ) : null}
            {site.externalGeneratedSite.deploymentStatus === "deployed" ? (
              <p className="text-sm text-muted">
                External preview deployment is ready. Public preview still requires the normal M7 approval.
              </p>
            ) : (
              <RequestExternalPreviewDeploymentForm
                websiteId={site.id}
                disabled={
                  !site.externalGeneratedSite.validation.ok ||
                  !site.externalGeneratedSite.build.ok ||
                  site.externalGeneratedSite.deploymentStatus === "pending_approval" ||
                  site.externalGeneratedSite.deploymentStatus === "deploying"
                }
              />
            )}
            {site.externalGeneratedSite.staleFactWarnings.length ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900">
                <p className="font-medium">Website was generated from an older verified-facts snapshot.</p>
                <ul className="mt-2 list-disc pl-5">
                  {site.externalGeneratedSite.staleFactWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {site.externalGeneratedSite.validation.findings.length ? (
              <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle text-sm">
                {site.externalGeneratedSite.validation.findings.map((finding) => (
                  <li key={`${finding.code}-${finding.path ?? ""}`} className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={finding.severity === "severe" ? "danger" : "warning"}>{finding.severity}</Badge>
                      <span className="font-medium">{finding.code}</span>
                      {finding.path ? <span className="text-muted">{finding.path}</span> : null}
                    </div>
                    <p className="mt-1 text-muted">{finding.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No static safety findings recorded.</p>
            )}
          </CardBody>
        </Card>
      ) : null}

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
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <div className="mt-1 break-all text-sm">{value}</div>
    </div>
  );
}
