import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { PipelineStrip } from "@/components/shared/pipeline";
import {
  ApprovalTypeBadge,
  ConnectionBadge,
} from "@/components/shared/status-badge";
import {
  getDashboardMetrics,
  mockAgentRuns,
  mockAgentSpend,
  mockApprovals,
  mockPipeline,
  mockSystemStatus,
} from "@/data";
import { getLeadById } from "@/data/mock-leads";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { agentName } from "@/lib/labels";

export default function OverviewPage() {
  const metrics = getDashboardMetrics();
  const pendingApprovals = mockApprovals.filter(
    (approval) => approval.status === "pending",
  );
  const recentRuns = [...mockAgentRuns].sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  return (
    <>
      <PageHeader
        title="Overview"
        description="Operating picture for the SiteForge pipeline. All figures are mock data. Integrations are not connected."
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
        <PipelineStrip stages={mockPipeline} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Recent agent activity"
            description="Sample history for layout review. Agents are not configured and are not running."
          />
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
        </Card>

        <Card>
          <CardHeader
            title="System status"
            description="Milestone 1 foundation. Nothing is connected."
          />
          <ul>
            {mockSystemStatus.map((service) => (
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
          <ul>
            {pendingApprovals.slice(0, 4).map((approval) => {
              const lead = approval.leadId
                ? getLeadById(approval.leadId)
                : undefined;
              return (
                <li
                  key={approval.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 first:border-t-0"
                >
                  <div>
                    <p className="text-sm text-foreground">
                      {lead?.businessName ?? "Unknown business"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {approval.requestedAction}
                    </p>
                  </div>
                  <ApprovalTypeBadge type={approval.type} />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Agent spend"
            description="No live usage. Agents are disabled."
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">
                  Today
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(mockAgentSpend.today)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">
                  This month
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(mockAgentSpend.thisMonth)}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {mockAgentSpend.breakdown.map((row) => (
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
