import { cn } from "@/lib/cn";

/**
 * See DESIGN-SYSTEM.md sections 1 and 6. A badge expresses the STATE of a
 * thing. Five tones, all semantic -- there is no `accent` tone, because the
 * accent means "interactive" and a badge is not. Soft fill, matching text,
 * no border.
 */
type Tone = "neutral" | "info" | "warning" | "success" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  info: "bg-info-muted text-info",
  warning: "bg-warning-muted text-warning",
  success: "bg-success-muted text-success",
  danger: "bg-danger-muted text-danger",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-full", dotTones[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
