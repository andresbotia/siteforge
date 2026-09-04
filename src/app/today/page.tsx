import type { Metadata } from "next";
import { Card } from "@/components/shared/card";
import { EmptyState } from "@/components/shared/empty-state";
import { LinkButton } from "@/components/shared/button";
import { PageHeader } from "@/components/shared/page-header";
import { BusinessQueueCard } from "@/components/today/business-queue-card";
import { QueueReconciler } from "@/components/today/queue-reconciler";
import { getTodayQueue } from "@/data/work-items";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Today" };

/**
 * M10 Task 3 / M10.5 / M10.6. The work-item queue and the post-login landing
 * page, grouped one card per business so a business with several outstanding
 * actions occupies one queue slot instead of several. Capped at seven
 * businesses. Reconciliation runs from a client-mounted action
 * (QueueReconciler), never in this render.
 */
export default async function TodayPage() {
  const queue = await getTodayQueue();

  const overflow: string[] = [];
  if (queue.hiddenBusinessCount > 0) {
    overflow.push(
      `${queue.hiddenBusinessCount} more business${queue.hiddenBusinessCount === 1 ? "" : "es"} (${queue.hiddenItemCount} item${queue.hiddenItemCount === 1 ? "" : "s"}) not shown`,
    );
  }
  if (queue.snoozedCount > 0) {
    overflow.push(`${queue.snoozedCount} item${queue.snoozedCount === 1 ? "" : "s"} snoozed`);
  }

  return (
    <>
      <PageHeader
        title="Today"
        description="What needs your attention now, nearest-to-revenue first. One card per business, every outstanding action it has."
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
          <div className="space-y-3">
            {queue.visible.map((business, index) => (
              <BusinessQueueCard key={business.leadId} business={business} position={index + 1} />
            ))}
          </div>
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
