import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditRunButton } from "@/components/auditor/audit-run-button";
import { listActivityForLead } from "@/data/activity";
import { getLatestAuditForLead, getLeadById, listAuditsForLead } from "@/data/leads";
import { isLeadEligibleForAudit } from "@/lib/auditor/eligibility";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ScoreBar, ScoreRing } from "@/components/shared/score-bar";
import {
  LeadStatusBadge,
  QualificationBadge,
} from "@/components/shared/status-badge";
import { formatDateTime, formatNumber } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

type LeadPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: LeadPageProps): Promise<Metadata> {
  const { id } = await params;
  const lead = await getLeadById(id);
  return { title: lead?.businessName ?? "Lead" };
}

export default async function LeadDetailPage({ params }: LeadPageProps) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) notFound();

  const [audit, audits, activity] = await Promise.all([
    getLatestAuditForLead(lead.id),
    listAuditsForLead(lead.id),
    listActivityForLead(lead.id),
  ]);
  const canAudit = isLeadEligibleForAudit(lead);

  return (
    <>
      <PageHeader
        title={lead.businessName}
        description={`${lead.industry} · ${lead.location}`}
        actions={
          <div className="flex flex-col items-end gap-3">
            {canAudit ? <AuditRunButton leadId={lead.id} /> : null}
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" disabled>
                Build Website
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Builder Agent not implemented yet.
              </p>
            </div>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
        {lead.qualificationTier ? (
          <QualificationBadge tier={lead.qualificationTier} />
        ) : null}
        <Link href="/leads" className="text-xs text-muted hover:text-foreground">
          Back to leads
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <Card>
          <CardHeader title="Business" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <Detail label="Phone" value={lead.phone} />
            <Detail label="Email" value={lead.email} />
            <Detail label="Website" value={lead.website} />
            <Detail
              label="Rating"
              value={`${lead.rating.toFixed(1)} · ${formatNumber(lead.reviewCount)} reviews`}
            />
            <Detail label="Website score" value={String(lead.websiteScore)} />
            <Detail label="Lead score" value={String(lead.leadScore)} />
          </CardBody>
        </Card>
        <Card className="flex items-center justify-center py-6">
          <ScoreRing value={lead.leadScore} label="Lead score" />
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Scout qualification"
          description="Deterministic public-business and website-opportunity scores. Not LLM-authored."
        />
        <CardBody className="grid gap-3 sm:grid-cols-2">
          <Detail label="Discovery source" value={lead.discoverySource ?? "—"} />
          <Detail
            label="Last Scout run"
            value={
              lead.lastScoutRunId ? (
                <Link
                  href={`/agents/scout/${lead.lastScoutRunId}`}
                  className="text-accent hover:underline"
                >
                  Open run
                </Link>
              ) : (
                "—"
              )
            }
          />
          <Detail
            label="Business strength"
            value={lead.businessStrengthScore === null ? "—" : String(lead.businessStrengthScore)}
          />
          <Detail
            label="Website opportunity"
            value={
              lead.websiteOpportunityScore === null
                ? "—"
                : String(lead.websiteOpportunityScore)
            }
          />
          <div className="sm:col-span-2">
            <p className="text-[11px] text-muted-foreground uppercase">Reasons</p>
            {lead.qualificationReasons.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No Scout reasons stored.</p>
            ) : (
              <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                {lead.qualificationReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>
          {lead.inspectionSummary ? (
            <div className="sm:col-span-2">
              <p className="text-[11px] text-muted-foreground uppercase">
                Inspection
              </p>
              <p className="mt-1 text-sm text-muted">
                Reachable: {String(asRecord(lead.inspectionSummary).reachable ?? "—")}
                {asRecord(lead.inspectionSummary).final_url
                  ? ` · ${String(asRecord(lead.inspectionSummary).final_url)}`
                  : ""}
                {asRecord(lead.inspectionSummary).has_viewport === false
                  ? " · missing viewport"
                  : ""}
              </p>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {audit ? (
        <Card className="mt-4">
          <CardHeader
            title="Website audit"
            description={
              audit.auditVersion
                ? `Latest deterministic audit (${audit.auditVersion}). Historical rows are kept when you re-run Auditor.`
                : "Latest persisted audit."
            }
            action={
              <Link href={`/audits/${audit.id}`} className="text-xs text-accent hover:underline">
                Open full audit
              </Link>
            }
          />
          <CardBody>
            <p className="mb-4 text-sm text-muted">
              Audited{audit.createdAt ? ` · ${formatDateTime(audit.createdAt)}` : ""}
              {audit.redesignOpportunityScore !== null
                ? ` · redesign opportunity ${audit.redesignOpportunityScore}`
                : ""}
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <ScoreBar label="Overall" value={audit.overallScore} />
              <ScoreBar label="Technical" value={audit.technicalScore ?? audit.performanceScore} />
              <ScoreBar label="SEO" value={audit.seoScore} />
              <ScoreBar
                label="UX / Conversion"
                value={audit.uxScore ?? audit.conversionScore ?? 0}
              />
              <ScoreBar label="Content" value={audit.contentScore ?? audit.designScore} />
            </div>
            <div className="mt-6">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Major findings
              </h3>
              {audit.findings.filter((item) => item.severity === "critical" || item.severity === "high").length === 0 ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {(audit.issues.slice(0, 4).length > 0
                    ? audit.issues.slice(0, 4)
                    : ["No high or critical findings stored."]
                  ).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {audit.findings
                    .filter((item) => item.severity === "critical" || item.severity === "high")
                    .slice(0, 6)
                    .map((item) => (
                      <li key={`${item.code}-${item.title}`}>{item.title}</li>
                    ))}
                </ul>
              )}
            </div>
            {audits.length > 1 ? (
              <p className="mt-4 text-xs text-muted">
                {audits.length} audit records on this lead. Latest is shown.
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardBody>
            <p className="text-sm text-muted">
              Not audited. {canAudit ? "Run a website audit from this page." : "This lead is not eligible for Auditor."}
            </p>
          </CardBody>
        </Card>
      )}

      <Card className="mt-4">
        <CardHeader title="Activity timeline" />
        {activity.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No activity yet.</p>
        ) : (
          <ol>
            {activity.map((item, index) => (
              <li
                key={item.id}
                className="grid grid-cols-[12px_minmax(0,1fr)] gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0"
              >
                <span
                  className={`mt-1.5 size-2 rounded-full ${index === 0 ? "bg-accent" : "bg-border"}`}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.detail}</p>
                  <time className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(item.timestamp)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  );
}
