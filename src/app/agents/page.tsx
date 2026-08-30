import type { Metadata } from "next";
import Link from "next/link";
import { CostControlsPanel } from "@/components/ai/cost-controls-panel";
import { Badge } from "@/components/shared/badge";
import { CardBody } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { listAgentPermissions, listAgents } from "@/data/agents";
import { getBudgetSnapshot, toCostControlsView } from "@/data/budget";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agents",
};

export default async function AgentsPage() {
  const [agents, permissions, budget] = await Promise.all([
    listAgents(),
    Promise.resolve(listAgentPermissions()),
    getBudgetSnapshot(),
  ]);
  const costControls = toCostControlsView(budget);

  return (
    <>
      <PageHeader
        title="Agents"
        description="Scout, Auditor, and Builder run manually at $0. Sales and Manager stay disabled. Paid xAI still requires an approved dollar ceiling."
      />

      <div className="mb-6">
        <CostControlsPanel snapshot={costControls} compact />
      </div>

      {agents.length === 0 ? (
        <p className="text-sm text-muted">No agents seeded yet.</p>
      ) : null}
      <div className="grid gap-3">
        {agents.map((agent) => {
          const agentPermissions = permissions.find(
            (item) => item.agentId === agent.id,
          );
          const ceiling = costControls.perRunCeilings.find(
            (item) => item.agentId === agent.id,
          );
          return (
            <details
              key={agent.id}
              className="group rounded-lg border border-border bg-surface open:bg-surface"
            >
              <summary className="cursor-pointer list-none px-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-medium">{agent.name}</h2>
                      <Badge>
                        {agent.id === "scout" ||
                        agent.id === "auditor" ||
                        agent.id === "builder" ||
                        agent.id === "sales"
                          ? "Manual"
                          : "Disabled"}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-muted">
                      {agent.purpose}
                      {agent.id === "scout" ? (
                        <>
                          {" "}
                          <Link href="/agents/scout" className="text-accent hover:underline">
                            Open Scout
                          </Link>
                        </>
                      ) : null}
                      {agent.id === "auditor" ? (
                        <>
                          {" "}
                          <Link href="/agents/auditor" className="text-accent hover:underline">
                            Open Auditor
                          </Link>
                        </>
                      ) : null}
                      {agent.id === "builder" ? (
                        <>
                          {" "}
                          <Link href="/agents/builder" className="text-accent hover:underline">
                            Open Builder
                          </Link>
                        </>
                      ) : null}
                      {agent.id === "sales" ? (
                        <>
                          {" "}
                          <Link href="/agents/sales" className="text-accent hover:underline">
                            Open Sales
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-5">
                    <Metric label="Runs today" value={String(agent.runsToday)} />
                    <Metric
                      label="Success rate"
                      value={
                        agent.successRate === null
                          ? "—"
                          : `${Math.round(agent.successRate * 100)}%`
                      }
                    />
                    <Metric
                      label="Cost today"
                      value={formatCurrency(agent.costToday)}
                    />
                    <Metric
                      label="Run ceiling"
                      value={ceiling?.amountUsd ?? "—"}
                    />
                    <Metric
                      label="Last run"
                      value={
                        agent.lastRun ? formatDateTime(agent.lastRun) : "Never"
                      }
                    />
                  </dl>
                </div>
              </summary>
              <CardBody className="border-t border-border-subtle pt-0">
                <p className="text-sm leading-6 text-muted">{agent.description}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Capabilities
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                      {agent.capabilities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Restrictions
                    </h3>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
                      {agent.restrictions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {agentPermissions ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Planned permissions
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      <Permission
                        allowed={agentPermissions.canReadPublicData}
                        label="Read public data"
                      />
                      <Permission
                        allowed={agentPermissions.canWriteInternal}
                        label="Internal writes"
                      />
                      <Permission
                        allowed={agentPermissions.canSendEmail}
                        label="Send email"
                      />
                      <Permission
                        allowed={agentPermissions.canDeployProduction}
                        label="Production deploy"
                      />
                      <Permission
                        allowed={agentPermissions.canModifyCustomerSite}
                        label="Modify customer site"
                      />
                      <Permission
                        allowed={agentPermissions.canProcessPayments}
                        label="Payments"
                      />
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </details>
          );
        })}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function Permission({ allowed, label }: { allowed: boolean; label: string }) {
  return (
    <Badge tone={allowed ? "accent" : "neutral"}>
      {allowed ? "Allowed" : "Denied"} · {label}
    </Badge>
  );
}
