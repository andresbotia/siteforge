import type { Metadata } from "next";
import Link from "next/link";
import { SalesDraftForm } from "@/components/sales/sales-draft-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { LeadStatusBadge } from "@/components/shared/status-badge";
import { listEligibleLeadsForSales, listSalesRuns } from "@/data/sales";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sales Agent",
};

export default async function SalesAgentPage() {
  const [leads, runs] = await Promise.all([
    listEligibleLeadsForSales(),
    listSalesRuns(),
  ]);

  return (
    <>
      <PageHeader
        title="Sales Agent"
        description="Manual $0 personalized outreach drafts based on structured audit findings, Builder redesign specs, and active tracked previews. Sending email requires explicit human approval."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Draft outreach email"
            description="Select a prospect with an active approved preview. The draft is generated deterministically from audit and builder evidence."
          />
          <CardBody>
            <SalesDraftForm leads={leads} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent Sales runs" />
          {runs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No Sales runs yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const output = asRecord(run.output);
                const outreachId = typeof output.outreach_id === "string" ? output.outreach_id : null;
                return (
                  <li
                    key={run.id}
                    className="border-t border-border-subtle px-4 py-3 first:border-t-0"
                  >
                    {outreachId ? (
                      <Link
                        href={`/outreach/${outreachId}`}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {run.purpose ?? "Sales draft run"}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{run.purpose ?? "Sales draft run"}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {run.status} - {formatDateTime(run.started_at ?? run.created_at)}
                      {typeof output.recipient === "string" ? ` - to: ${output.recipient}` : ""}
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
          title="Eligible prospects"
          description="Prospects with a generated website and an active approved M7 preview deployment."
        />
        {leads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No leads currently have an active preview deployment. Publish a preview in Builder / Website details first.
          </p>
        ) : (
          <ul>
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-accent">
                    {lead.businessName}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {lead.industry} - {lead.city} - Preview token ending{" "}
                    <span className="font-mono">{lead.previewTokenHint}</span>
                    {lead.email ? ` - email: ${lead.email}` : " - no email on file"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {lead.latestOutreachId ? (
                    <Link
                      href={`/outreach/${lead.latestOutreachId}`}
                      className="text-xs text-accent hover:underline"
                    >
                      View existing outreach
                    </Link>
                  ) : null}
                  <LeadStatusBadge status={lead.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
