import type { Metadata } from "next";
import Link from "next/link";
import { createFixtureDesignerJobAction } from "@/app/actions/designer";
import { RequestDesignerJobForm } from "@/components/designer/request-designer-job-form";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { listEligibleLeadsForBuild } from "@/data/builder";
import { listDesignerJobs } from "@/data/designer";
import { checkClaudeAuthHealth, checkClaudeCliVersion, locateClaudeCli } from "@/lib/designer/cli";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Designer",
};

export default async function DesignerAgentPage() {
  const [leads, jobs, health] = await Promise.all([
    listEligibleLeadsForBuild(),
    listDesignerJobs(),
    getWorkerHealth(),
  ]);

  return (
    <>
      <PageHeader
        title="Designer"
        description="Premium visual design for leads the deterministic Builder template registry cannot confidently cover. Designer creates candidates; it never approves them, deploys them, or contacts a business."
      />

      <Card className="mb-4">
        <CardHeader title="Local worker health" description="Read-only check against this machine's Claude Code installation. Starting a worker requires running `npm run designer:worker` locally." />
        <CardBody className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <HealthItem label="CLI detected" value={health.cliDetected ? "Yes" : "No"} tone={health.cliDetected ? "success" : "danger"} />
          <HealthItem label="CLI source" value={health.cliSource ?? "—"} tone="neutral" />
          <HealthItem
            label="Subscription auth"
            value={health.subscriptionAuth ? `Yes (${health.subscriptionType ?? "unknown plan"})` : "No"}
            tone={health.subscriptionAuth ? "success" : "danger"}
          />
          <HealthItem label="Billing mode" value="Subscription only -- no API key fallback" tone="neutral" />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Request a Designer Job"
            description="Creates a queued job for the local worker to claim. $0 cash cost; consumes subscription capacity when it runs."
          />
          <CardBody>
            <RequestDesignerJobForm leads={leads} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Fixture / smoke-test job"
            description="Synthetic business only. Never promotable to a commercial master. Useful for proving the pipeline without touching a real lead."
          />
          <CardBody>
            <form action={createFixtureDesignerJobAction}>
              <Button type="submit" variant="secondary">
                Create fixture job
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Recent Designer Jobs" />
        {jobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No Designer Jobs yet.</p>
        ) : (
          <ul>
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/designer-jobs/${job.id}`} className="text-sm font-medium hover:text-accent">
                    {job.is_fixture ? "Fixture: " : ""}
                    {(job.design_brief as { suggestedTemplateKey?: string } | null)?.suggestedTemplateKey ?? job.template_family ?? "Designer Job"}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {job.mode} · {formatDateTime(job.created_at)}
                    {job.lead_id ? "" : " · no lead (fixture)"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(job.status)}>{job.status}</Badge>
                  {job.status === "visual_review_required" ? <Badge tone="warning">needs review</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function HealthItem({ label, value, tone }: { label: string; value: string; tone: "success" | "danger" | "neutral" }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="mt-0.5">
        <Badge tone={tone}>{value}</Badge>
      </p>
    </div>
  );
}

function statusTone(status: string): "neutral" | "accent" | "success" | "warning" | "danger" | "info" {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "visual_review_required") return "warning";
  if (status === "cancelled" || status === "superseded") return "neutral";
  return "info";
}

async function getWorkerHealth(): Promise<{
  cliDetected: boolean;
  cliSource: string | null;
  subscriptionAuth: boolean;
  subscriptionType: string | null;
}> {
  const cli = locateClaudeCli();
  if (!cli) return { cliDetected: false, cliSource: null, subscriptionAuth: false, subscriptionType: null };
  const version = await checkClaudeCliVersion(cli.path);
  if (!version.ok) return { cliDetected: true, cliSource: cli.source, subscriptionAuth: false, subscriptionType: null };
  const auth = await checkClaudeAuthHealth(cli.path);
  return {
    cliDetected: true,
    cliSource: cli.source,
    subscriptionAuth: auth.ok && auth.subscriptionAuth === true,
    subscriptionType: auth.ok && auth.subscriptionAuth === true ? auth.subscriptionType : null,
  };
}
