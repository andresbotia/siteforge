import type { Metadata } from "next";
import Link from "next/link";
import { BuilderRunForm } from "@/components/builder/builder-run-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { LeadStatusBadge } from "@/components/shared/status-badge";
import { listBuilderRuns, listEligibleLeadsForBuild } from "@/data/builder";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Builder",
};

export default async function BuilderPage() {
  const [leads, runs] = await Promise.all([
    listEligibleLeadsForBuild(),
    listBuilderRuns(),
  ]);

  return (
    <>
      <PageHeader
        title="Builder"
        description="Manual $0 deterministic website drafts from reusable templates. Paid AI is not required. Builder does not deploy, email, or contact the business."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Start a website draft"
            description="Choose an audited lead. The draft stays inside SiteForge until Milestone 7 preview hosting."
          />
          <CardBody>
            <BuilderRunForm leads={leads} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent Builder runs" />
          {runs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No Builder runs yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const output = asRecord(run.output);
                const websiteId = typeof output.website_id === "string" ? output.website_id : null;
                return (
                  <li
                    key={run.id}
                    className="border-t border-border-subtle px-4 py-3 first:border-t-0"
                  >
                    {websiteId ? (
                      <Link
                        href={`/websites/${websiteId}`}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {run.purpose ?? "Builder run"}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{run.purpose ?? "Builder run"}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {run.status} · {formatDateTime(run.started_at ?? run.created_at)}
                      {typeof output.template === "string" ? ` · ${output.template}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader
          title="Eligible leads"
          description="Audited leads first. Rebuilds keep history."
        />
        {leads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No audited leads yet.</p>
        ) : (
          <ul>
            {leads.slice(0, 12).map((lead) => (
              <li
                key={lead.id}
                className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-accent">
                    {lead.businessName}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {lead.industry} · template {lead.recommendedTemplate}
                    {lead.latestOverall !== null ? ` · audit ${lead.latestOverall}` : ""}
                    {lead.latestOpportunity !== null
                      ? ` · opportunity ${lead.latestOpportunity}`
                      : ""}
                  </p>
                </div>
                <LeadStatusBadge status={lead.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
