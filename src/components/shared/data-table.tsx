import { cn } from "@/lib/cn";

export function DataTable({
  children,
  minWidth = "min-w-[880px]",
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={cn("w-full text-left text-sm", minWidth)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-hover/60 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </thead>
  );
}

export function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-2.5 font-medium whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "border-t border-border-subtle px-3 py-2.5 align-middle",
        className,
      )}
    >
      {children}
    </td>
  );
}
