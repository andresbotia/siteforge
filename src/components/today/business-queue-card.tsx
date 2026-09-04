import { Card } from "@/components/shared/card";
import { LinkButton } from "@/components/shared/button";
import { WorkItemRow } from "@/components/today/work-item-row";
import type { TodayQueueBusiness } from "@/data/work-items";

/**
 * M10.6 Task 2. One business, one card, every outstanding action it has
 * open. Replaces one-row-per-item so a business needing three things occupies
 * one queue slot, not three. `position` makes priority legible without
 * reading every card.
 */
export function BusinessQueueCard({
  business,
  position,
}: {
  business: TodayQueueBusiness;
  position: number;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="pt-0.5 text-xs tabular-nums text-muted-foreground"
          >
            {position}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{business.businessName}</p>
            <p className="mt-0.5 text-xs text-muted">
              {business.items.length} outstanding action{business.items.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <LinkButton
          href={`/leads/${business.leadId}#next-actions`}
          variant="primary"
          size="sm"
          className="shrink-0"
        >
          Open
        </LinkButton>
      </div>
      <ul className="divide-y divide-border">
        {business.items.map((item) => (
          <WorkItemRow key={item.id} item={{ id: item.id, type: item.type, need: item.need }} />
        ))}
      </ul>
    </Card>
  );
}
