import type { Metadata } from "next";
import Link from "next/link";
import { ScoutRunForm } from "@/components/scout/scout-run-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { listScoutRuns } from "@/data/scout";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scout",
};

export default async function ScoutPage() {
  const runs = await listScoutRuns();

  return (
    <>
      <PageHeader
        title="Scout"
        description="Manual lead discovery from a local public catalog. No paid API and no paid AI. Other agents stay disabled."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Start a Scout run"
            description="Configure geography and category, then inspect a bounded candidate set."
          />
          <CardBody>
            <ScoutRunForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent Scout runs" />
          {runs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No Scout runs yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const output = asRecord(run.output);
                return (
                  <li
                    key={run.id}
                    className="border-t border-border-subtle px-4 py-3 first:border-t-0"
                  >
                    <Link
                      href={`/agents/scout/${run.id}`}
                      className="text-sm font-medium hover:text-accent"
                    >
                      {run.purpose ?? "Scout run"}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {run.status} · {formatDateTime(run.started_at ?? run.created_at)}
                      {typeof output.discovered === "number"
                        ? ` · ${output.discovered} discovered`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
