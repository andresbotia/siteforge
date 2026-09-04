import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import type { AiCostControlsView } from "@/types";

export function CostControlsPanel({
  snapshot,
  compact = false,
}: {
  snapshot: AiCostControlsView;
  compact?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Daily usage / cap"
          value={`${snapshot.dailyUsedUsd} / ${snapshot.dailyLimitUsd}`}
          hint={`Actual ${snapshot.dailyActualUsd} · reserved ${snapshot.reservedUsd}`}
        />
        <MetricCard
          label="Monthly usage / cap"
          value={`${snapshot.monthlyUsedUsd} / ${snapshot.monthlyLimitUsd}`}
          hint={`Actual ${snapshot.monthlyActualUsd} · reserved ${snapshot.reservedUsd}`}
        />
        <MetricCard label="Reserved" value={snapshot.reservedUsd} hint="Active approved hold" />
        <MetricCard
          label="Provider"
          value={snapshot.provider}
          hint={snapshot.defaultModel}
        />
      </div>

      <Card>
        <CardHeader
          title="AI Cost Controls"
          description="No paid xAI call can run without an approved dollar ceiling. Agents remain disabled."
        />
        <CardBody className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Provider" value={snapshot.provider} />
          <Row
            label="API key"
            value={snapshot.apiKeyConfigured ? "Configured" : "Not configured"}
            tone={snapshot.apiKeyConfigured ? "success" : "warning"}
          />
          <Row label="Daily hard cap" value={snapshot.dailyLimitUsd} />
          <Row label="Monthly hard cap" value={snapshot.monthlyLimitUsd} />
          <Row label="Paid usage approvals" value="Required" />
          <Row label="Automatic paid spending" value="Disabled" />
          {compact ? null : (
            <>
              <Row
                label="Live inference gate"
                value={
                  snapshot.liveInferenceEnabled
                    ? "Enabled (env)"
                    : "Disabled"
                }
              />
              <Row label="Default model" value={snapshot.defaultModel} />
            </>
          )}
        </CardBody>
      </Card>

      {compact ? null : (
        <Card>
          <CardHeader
            title="Per-run development ceilings"
            description="Hard limits applied in addition to the approved maximum for a single run."
          />
          <CardBody className="grid gap-2 sm:grid-cols-5">
            {snapshot.perRunCeilings.map((item) => (
              <div key={item.agentId}>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums">{item.amountUsd}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2">
      <span className="text-muted">{label}</span>
      {tone ? <Badge tone={tone}>{value}</Badge> : <span className="tabular-nums">{value}</span>}
    </div>
  );
}
