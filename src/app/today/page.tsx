import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { QueueReconciler } from "@/components/today/queue-reconciler";
import { WorkItemRow } from "@/components/today/work-item-row";
import { getTodayQueue } from "@/data/work-items";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Today" };

/**
 * M10 Task 3. The work-item queue and the post-login landing page. Items are
 * ordered by proximity to revenue; the visible list is capped at seven so a
 * long queue reads as attention, not a backlog. Reconciliation (creation +
 * resolution, both derived from live state) runs inside getTodayQueue().
 */
export default async function TodayPage() {
  const queue = await getTodayQueue();

  return (
    <>
      <PageHeader
        title="Today"
        description="What needs your attention now, nearest-to-revenue first. Each item opens the business it belongs to."
      />

      <QueueReconciler />

      {queue.visible.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-muted">
              Nothing needs attention right now.{" "}
              <Link href="/leads" className="text-accent hover:underline">
                Open the pipeline
              </Link>
              .
              {queue.snoozedCount > 0
                ? ` ${queue.snoozedCount} item${queue.snoozedCount === 1 ? " is" : "s are"} snoozed.`
                : ""}
            </p>
          </CardBody>
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {queue.visible.map((item) => (
              <WorkItemRow
                key={item.id}
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
          {queue.hiddenCount > 0 || queue.snoozedCount > 0 ? (
            <p className="mt-3 text-xs text-muted">
              {queue.hiddenCount > 0
                ? `${queue.hiddenCount} more item${queue.hiddenCount === 1 ? "" : "s"} not shown`
                : ""}
              {queue.hiddenCount > 0 && queue.snoozedCount > 0 ? " · " : ""}
              {queue.snoozedCount > 0
                ? `${queue.snoozedCount} snoozed`
                : ""}
              . Work the queue down, or open the{" "}
              <Link href="/leads" className="text-accent hover:underline">
                pipeline
              </Link>
              .
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
