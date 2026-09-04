"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { reconcileTodayQueueAction } from "@/app/actions/today";

/**
 * M10.5 Task 0. Runs the work-item reconcile once, after mount, so the write
 * never happens during the Server Component render. Refreshes the route only
 * when the pass actually changed something, and surfaces a failed write as a
 * banner instead of letting it fail silently (mutateTable logs + returns null).
 */
export function QueueReconciler() {
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    reconcileTodayQueueAction()
      .then((result) => {
        if (!result.ok && result.error) setError(result.error);
        if (result.changed) router.refresh();
      })
      .catch(() => {
        setError(
          "The work queue could not be refreshed. You are seeing the last known state.",
        );
      });
  }, [router]);

  if (!error) return null;

  return (
    <div
      role="status"
      className="mb-4 rounded-md border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning"
    >
      {error}
    </div>
  );
}
