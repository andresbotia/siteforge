import { cn } from "@/lib/cn";

/**
 * See DESIGN-SYSTEM.md section 6. One treatment for an inline notice tied to
 * status -- a stale queue, a drifted offer amount, a "this is a public-data
 * prospect" note. `tone` is semantic (status), never the accent.
 */
type CalloutTone = "info" | "warning" | "danger";

const tones: Record<CalloutTone, string> = {
  info: "bg-info-muted text-info",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
};

export function InlineCallout({
  tone = "warning",
  children,
  className,
}: {
  tone?: CalloutTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-sm px-3 py-2 text-sm",
        tones[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
