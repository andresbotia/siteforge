import { cn } from "@/lib/cn";
import type { FunnelStage, PipelineStage } from "@/types";

export function PipelineStrip({ stages }: { stages: PipelineStage[] }) {
  return (
    <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4 lg:grid-cols-7">
      {stages.map((stage, index) => (
        <li
          key={stage.id}
          className="flex flex-col gap-1 bg-surface px-3 py-3"
        >
          <span className="text-xs text-muted-foreground">
            {index + 1}. {stage.label}
          </span>
          <span className="text-lg tabular-nums">{stage.count}</span>
        </li>
      ))}
    </ol>
  );
}

export function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);

  return (
    <ul className="space-y-3">
      {stages.map((stage) => {
        const width = Math.max(8, (stage.count / max) * 100);
        return (
          <li key={stage.stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted">{stage.stage}</span>
              <span className="tabular-nums text-foreground">{stage.count}</span>
            </div>
            <div className="h-2 rounded-full bg-border">
              <div
                className={cn("h-full rounded-full bg-accent")}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
