import type { Metadata } from "next";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkButton } from "@/components/shared/button";
import { PageHeader } from "@/components/shared/page-header";
import { QueueReconciler } from "@/components/today/queue-reconciler";
import { WorkItemRow } from "@/components/today/work-item-row";
import { getTodayQueue } from "@/data/work-items";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Today" };

/**
 * M10 Task 3 / M10.5. The work-item queue and the post-login landing page.
 * Items are ordered by proximity to revenue; the visible list is capped at
 * seven so a long queue reads as attention, not a backlog. Reconciliation runs
 * from a client-mounted action (QueueReconciler), never in this render.
 */
export default async function TodayPage() {
  const queue = await getTodayQueue();

  const overflow: string[] = [];
  if (queue.hiddenCount > 0) {
    overflow.push(
      `${queue.hiddenCount} more item${queue.hiddenCount === 1 ? "" : "s"} not shown`,
    );
  }
  if (queue.snoozedCount > 0) {
    overflow.push(`${queue.snoozedCount} snoozed`);
  }

  return (
    <>
      <PageHeader
        title="Today"
        description="What needs your attention now, nearest-to-revenue first. Each item opens the business it belongs to."
      />

      <QueueReconciler />

      {queue.visible.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="Nothing needs attention right now."
            hint={
              queue.snoozedCount > 0
                ? `${queue.snoozedCount} item${queue.snoozedCount === 1 ? " is" : "s are"} snoozed.`
                : undefined
            }
            action={
              <LinkButton href="/leads" variant="secondary" size="sm">
                Open the pipeline
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <ul className="divide-y divide-border">
              {queue.visible.map((item, index) => (
                <WorkItemRow
                  key={item.id}
                  position={index + 1}
                  item={{
                    id: item.id,
                    leadId: item.leadId,
                    businessName: item.businessName,
                    type: item.type,
                    need: item.need,
                  }}
                />
              ))}
            </ul>
          </Card>
          {overflow.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              {overflow.join(" · ")}. Work the queue down, or open the pipeline.
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
