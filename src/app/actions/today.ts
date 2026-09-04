"use server";

import { reconcileWorkItems, type ReconcileResult } from "@/data/work-items";
import { requireAdminSession } from "@/lib/auth/guard";

/**
 * M10.5 Task 0. `/today` must not reconcile during render -- writing to the
 * database inside a Server Component is against App Router convention and can
 * double-run under prefetch. Instead the page mounts a client component that
 * calls this action once. Reconciliation is still synchronous and request-
 * scoped (no background job); it just runs in an action rather than a render.
 *
 * The mutating code paths (audit completion, approval request, lifecycle
 * change, conversion) also reconcile after their writes, so this is a
 * backstop -- but it is the one place a broken work-item write surfaces to
 * the operator, via the returned `error`.
 */
export async function reconcileTodayQueueAction(): Promise<ReconcileResult> {
  await requireAdminSession();
  return reconcileWorkItems();
}
