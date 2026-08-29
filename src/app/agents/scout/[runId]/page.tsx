import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { getScoutRun } from "@/data/scout";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scout run",
};

export default async function ScoutRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getScoutRun(runId);
  if (!run) notFound();
  const output = asRecord(run.output);
  const candidates = Array.isArray(output.candidates) ? output.candidates : [];

  return (
    <>
      <PageHeader
        title={run.purpose ?? "Scout run"}
        description={`${run.status} · Discovery cost $0.00 · Paid AI not required`}
      />
      <p className="mb-4 text-xs text-muted">
        <Link href="/agents/scout" className="hover:text-foreground">
          Back to Scout
        </Link>
        {run.completed_at ? ` · Finished ${formatDateTime(run.completed_at)}` : ""}
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Discovered" value={String(output.discovered ?? 0)} />
        <MetricCard label="Inspected" value={String(output.inspected ?? 0)} />
        <MetricCard label="Qualified" value={String(output.qualified ?? 0)} />
        <MetricCard label="Review" value={String(output.review ?? 0)} />
        <MetricCard label="Rejected" value={String(output.rejected ?? 0)} />
      </div>
      <Card>
        <CardHeader title="Candidates" description="Deterministic qualification. No LLM scoring." />
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Business</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Location</th>
                <th className="px-4 py-2 font-medium">Rating</th>
                <th className="px-4 py-2 font-medium">Website</th>
                <th className="px-4 py-2 font-medium">Strength</th>
                <th className="px-4 py-2 font-medium">Opportunity</th>
                <th className="px-4 py-2 font-medium">Tier</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={8}>
                    No candidates stored for this run.
                  </td>
                </tr>
              ) : (
                candidates.map((item) => {
                  const row = asRecord(item);
                  const leadId = typeof row.lead_id === "string" ? row.lead_id : null;
                  const name = String(row.name ?? "Unknown");
                  return (
                    <tr key={`${name}-${String(row.website ?? "")}`} className="border-t border-border-subtle">
                      <td className="px-4 py-2">
                        {leadId ? (
                          <Link href={`/leads/${leadId}`} className="font-medium hover:text-accent">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted">{String(row.category ?? "")}</td>
                      <td className="px-4 py-2 text-muted">{String(row.city ?? "")}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {row.rating ? `${row.rating} · ${row.reviews ?? 0}` : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted break-all">
                        {String(row.website ?? "—")}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{String(row.business_strength ?? "—")}</td>
                      <td className="px-4 py-2 tabular-nums">{String(row.website_opportunity ?? "—")}</td>
                      <td className="px-4 py-2">{String(row.tier ?? "—")}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}
