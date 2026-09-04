import { cn } from "@/lib/cn";

/**
 * See DESIGN-SYSTEM.md section 6. One treatment for "there is nothing here
 * yet". Sits inside a CardBody or replaces a table/list body. `action` is a
 * single Button or LinkButton.
 */
export function EmptyState({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-2 py-2", className)}>
      <p className="text-sm text-muted">{title}</p>
      {hint ? <p className="max-w-2xl text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
