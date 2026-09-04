import { cn } from "@/lib/cn";

/**
 * See DESIGN-SYSTEM.md section 5. Dense: ~36px rows, 13px cells, one border
 * weight, surface-2 header. The page body never scrolls sideways -- the table
 * does, inside this box.
 */
export function DataTable({
  children,
  minWidth = "min-w-[880px]",
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className={cn("w-full text-left text-sm", minWidth)}>
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-2 text-xs text-muted uppercase">
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
    <th className={cn("px-3 py-2 font-medium whitespace-nowrap", className)}>
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
      className={cn("border-t border-border px-3 py-2 align-middle", className)}
    >
      {children}
    </td>
  );
}
