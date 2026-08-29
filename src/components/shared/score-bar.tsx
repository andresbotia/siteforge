import { cn } from "@/lib/cn";

function scoreTone(value: number): string {
  if (value >= 80) return "bg-success";
  if (value >= 60) return "bg-accent";
  if (value >= 40) return "bg-warning";
  return "bg-danger";
}

export function ScoreBar({
  label,
  value,
}: {
  label?: string;
  value: number;
}) {
  return (
    <div className="min-w-0">
      {label ? (
        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted">{label}</span>
          <span className="tabular-nums text-foreground">{value}</span>
        </div>
      ) : null}
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        <div
          className={cn("h-full rounded-full", scoreTone(value))}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ScoreRing({
  value,
  label,
  size = 88,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 88 88"
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-border"
            strokeWidth="6"
          />
          <circle
            cx="44"
            cy="44"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-accent"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{value}</span>
        </div>
      </div>
      {label ? (
        <p className="text-xs text-muted-foreground">{label}</p>
      ) : null}
    </div>
  );
}
