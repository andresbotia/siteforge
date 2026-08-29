import type { Metadata } from "next";
import { Badge } from "@/components/shared/badge";
import { CardBody } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { mockAgentPermissions, mockAgents } from "@/data";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = {
  title: "Agents",
};

export default function AgentsPage() {
  return (
    <>
      <PageHeader
        title="Agents"
        description="Five specialized agents are planned. None are implemented or configured in this milestone."
      />
      <div className="grid gap-3">
        {mockAgents.map((agent) => {
          const permissions = mockAgentPermissions.find(
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
                      <Badge>Not Configured</Badge>
                    </div>
                    <p className="mt-1 max-w-2xl text-sm text-muted">
                      {agent.purpose}
                    </p>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
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
                    <Metric label="Last run" value="Never" />
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
                {permissions ? (
                  <div className="mt-4">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Planned permissions
                    </h3>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      <Permission
                        allowed={permissions.canReadPublicData}
                        label="Read public data"
                      />
                      <Permission
                        allowed={permissions.canWriteInternal}
                        label="Internal writes"
                      />
                      <Permission
                        allowed={permissions.canSendEmail}
                        label="Send email"
                      />
                      <Permission
                        allowed={permissions.canDeployProduction}
                        label="Production deploy"
                      />
                      <Permission
                        allowed={permissions.canModifyCustomerSite}
                        label="Modify customer site"
                      />
                      <Permission
                        allowed={permissions.canProcessPayments}
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
