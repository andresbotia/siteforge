import { Card } from "@/components/shared/card";
import { cn } from "@/lib/cn";

export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className={cn("mt-1 text-xs text-muted-foreground")}>{hint}</p>
      ) : null}
    </Card>
  );
}
