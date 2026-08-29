import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listActivityForLead } from "@/data/activity";
import { getLatestAuditForLead, getLeadById } from "@/data/leads";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { ScoreBar, ScoreRing } from "@/components/shared/score-bar";
import { LeadStatusBadge } from "@/components/shared/status-badge";
import { formatDateTime, formatNumber } from "@/lib/format";

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

  const [audit, activity] = await Promise.all([
    getLatestAuditForLead(lead.id),
    listActivityForLead(lead.id),
  ]);

  return (
    <>
      <PageHeader
        title={lead.businessName}
        description={`${lead.industry} · ${lead.location}`}
        actions={
          <div className="flex flex-col items-end gap-1">
            <Button variant="primary" disabled>
              Build Website
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Builder Agent not implemented yet.
            </p>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LeadStatusBadge status={lead.status} />
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

      {audit ? (
        <Card className="mt-4">
          <CardHeader
            title="Website audit"
            description="Latest persisted audit. Auditor is not implemented."
          />
          <CardBody>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              <ScoreBar label="Overall" value={audit.overallScore} />
              <ScoreBar label="Design" value={audit.designScore} />
              <ScoreBar label="Mobile" value={audit.mobileScore} />
              <ScoreBar label="SEO" value={audit.seoScore} />
              <ScoreBar label="Performance" value={audit.performanceScore} />
              <ScoreBar
                label="Conversion"
                value={audit.conversionScore ?? 0}
              />
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Issues
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {audit.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Recommendations
                </h3>
                <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-muted">
                  {audit.recommendations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardBody>
            <p className="text-sm text-muted">
              No audit yet. This lead is still in discovery.
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all text-sm">{value}</p>
    </div>
  );
}
