import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ScoreBar, ScoreRing } from "@/components/shared/score-bar";
import { getAuditById, getLeadById } from "@/data/leads";
import { formatDateTime } from "@/lib/format";
import type { AuditSeverity } from "@/types";

export const dynamic = "force-dynamic";

type AuditPageProps = {
  params: Promise<{ id: string }>;
};

const severityTone: Record<AuditSeverity, "danger" | "warning" | "info" | "neutral"> = {
  critical: "danger",
  high: "warning",
  medium: "warning",
  low: "info",
  info: "neutral",
};

export async function generateMetadata({ params }: AuditPageProps): Promise<Metadata> {
  const { id } = await params;
  const audit = await getAuditById(id);
  return { title: audit ? "Website audit" : "Audit" };
}

export default async function AuditDetailPage({ params }: AuditPageProps) {
  const { id } = await params;
  const audit = await getAuditById(id);
  if (!audit) notFound();
  const lead = await getLeadById(audit.leadId);

  const grouped = groupFindings(audit.findings);

  return (
    <>
      <PageHeader
        title={lead?.businessName ?? "Website audit"}
        description="Deterministic Auditor results. Quality scores are 100 = healthy. Redesign opportunity is 100 = strong SiteForge candidate."
      />
      <p className="mb-4 text-xs text-muted">
        <Link href={lead ? `/leads/${lead.id}` : "/leads"} className="hover:text-foreground">
          Back to lead
        </Link>
        {" · "}
        <Link href="/agents/auditor" className="hover:text-foreground">
          Auditor
        </Link>
        {audit.createdAt ? ` · ${formatDateTime(audit.createdAt)}` : ""}
        {audit.auditVersion ? ` · ${audit.auditVersion}` : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Card>
          <CardHeader title="Audit summary" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Detail label="Business" value={lead?.businessName ?? "—"} />
            <Detail label="Website" value={audit.websiteUrl ?? lead?.website ?? "—"} />
            <Detail label="Pages inspected" value={String(audit.pagesInspected)} />
            <Detail
              label="Redesign opportunity"
              value={
                audit.redesignOpportunityScore === null
                  ? "—"
                  : String(audit.redesignOpportunityScore)
              }
            />
          </CardBody>
        </Card>
        <Card className="flex items-center justify-center py-6">
          <ScoreRing value={audit.overallScore} label="Website health" />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Category scores" description="100 = healthy / strong." />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <ScoreBar label="Technical" value={audit.technicalScore ?? audit.performanceScore} />
            <ScoreBar label="SEO" value={audit.seoScore} />
            <ScoreBar label="UX / Conversion" value={audit.uxScore ?? audit.conversionScore ?? 0} />
            <ScoreBar label="Content" value={audit.contentScore ?? audit.designScore} />
          </div>
        </CardBody>
      </Card>

      {audit.inspectedUrls.length > 0 ? (
        <Card className="mt-4">
          <CardHeader title="Pages inspected" />
          <ul>
            {audit.inspectedUrls.map((page) => (
              <li
                key={`${page.url}-${page.kind}`}
                className="border-t border-border-subtle px-4 py-2 text-sm first:border-t-0"
              >
                <span className="text-muted">{page.kind}</span>
                {" · "}
                <span className="break-all">{page.url}</span>
                {" · "}
                <span className="tabular-nums text-muted">
                  {page.status ?? (page.ok ? "ok" : "failed")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardHeader
          title="Findings"
          description={
            audit.findings.length === 0
              ? "No structured Auditor findings on this record. Legacy issues are listed below when present."
              : "Grouped by severity. Evidence is deterministic, not a ranking claim."
          }
        />
        {audit.findings.length === 0 ? (
          <CardBody className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Issues
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                {audit.issues.length === 0 ? (
                  <li>None stored.</li>
                ) : (
                  audit.issues.map((issue) => <li key={issue}>{issue}</li>)
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Recommendations
              </h3>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                {audit.recommendations.length === 0 ? (
                  <li>None stored.</li>
                ) : (
                  audit.recommendations.map((item) => <li key={item}>{item}</li>)
                )}
              </ul>
            </div>
          </CardBody>
        ) : (
          <div>
            {grouped.map(([severity, findings]) => (
              <div key={severity} className="border-t border-border-subtle px-4 py-4 first:border-t-0">
                <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {severity}
                </h3>
                <ul className="grid gap-3">
                  {findings.map((finding) => (
                    <li
                      key={`${finding.code}-${finding.affectedUrl ?? ""}-${finding.title}`}
                      className="rounded-md border border-border-subtle p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={severityTone[finding.severity]}>{finding.severity}</Badge>
                        <Badge>{finding.category}</Badge>
                        <p className="text-sm font-medium">{finding.title}</p>
                      </div>
                      <p className="mt-2 text-sm text-muted">{finding.evidence}</p>
                      <p className="mt-1 text-sm">{finding.recommendation}</p>
                      {finding.affectedUrl ? (
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          {finding.affectedUrl}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function groupFindings(findings: import("@/types").AuditFinding[]) {
  const order: AuditSeverity[] = ["critical", "high", "medium", "low", "info"];
  return order
    .map((severity) => [severity, findings.filter((item) => item.severity === severity)] as const)
    .filter(([, items]) => items.length > 0);
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  );
}
