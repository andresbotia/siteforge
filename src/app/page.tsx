import Link from "next/link";
import { getAgentSpend, listRecentAgentRuns } from "@/data/activity";
import { listPendingApprovals } from "@/data/approvals";
import { getDashboardMetrics, getPipeline } from "@/data/dashboard";
import { listSystemStatus } from "@/data/integrations";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PipelineStrip } from "@/components/shared/pipeline";
import {
  ApprovalTypeBadge,
  ConnectionBadge,
} from "@/components/shared/status-badge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { agentName } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [metrics, pipeline, pendingApprovals, recentRuns, spend, systemStatus] =
    await Promise.all([
      getDashboardMetrics(),
      getPipeline(),
      listPendingApprovals(),
      listRecentAgentRuns(),
      getAgentSpend(),
      listSystemStatus(),
    ]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Operating picture for the SiteForge pipeline. Figures come from Supabase when connected. Agents are not running."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Qualified Leads" value={String(metrics.qualifiedLeads)} />
        <MetricCard
          label="Websites Generated"
          value={String(metrics.websitesGenerated)}
        />
        <MetricCard
          label="Awaiting Approval"
          value={String(metrics.awaitingApproval)}
        />
        <MetricCard label="Outreach Sent" value={String(metrics.outreachSent)} />
        <MetricCard label="Customers" value={String(metrics.customers)} />
        <MetricCard label="MRR" value={formatCurrency(metrics.mrr, true)} />
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium">Pipeline</h2>
        <PipelineStrip stages={pipeline} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent agent activity"
            description="Persisted run history. Agents are disabled and are not executing."
          />
          {recentRuns.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No agent activity yet.</p>
          ) : (
            <ul>
              {recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-start justify-between gap-4 border-t border-border-subtle px-4 py-3 first:border-t-0"
                >
                  <div>
                    <p className="text-sm text-foreground">{run.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {agentName[run.agentId]} · {run.status}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(run.startedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="System status"
            description="Supabase is the only integration in this milestone."
          />
          <ul>
            {systemStatus.map((service) => (
              <li
                key={service.id}
                className="flex items-center justify-between border-t border-border-subtle px-4 py-3 first:border-t-0"
              >
                <span className="text-sm">{service.name}</span>
                <ConnectionBadge status={service.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Approval queue"
            description="External side effects wait here."
            action={
              <Link href="/approvals" className="text-xs text-accent hover:underline">
                View all
              </Link>
            }
          />
          {pendingApprovals.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No pending approvals.</p>
          ) : (
            <ul>
              {pendingApprovals.slice(0, 4).map((approval) => (
                <li
                  key={approval.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      {approval.businessName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {approval.requestedAction}
                    </p>
                  </div>
                  <ApprovalTypeBadge type={approval.type} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Agent spend"
            description="From persisted agent_runs. Agents are disabled."
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">
                  Today
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(spend.today)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">
                  This month
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(spend.thisMonth)}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {spend.breakdown.map((row) => (
                <li
                  key={row.agentId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted">{agentName[row.agentId]}</span>
                  <span className="tabular-nums">
                    {formatCurrency(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
