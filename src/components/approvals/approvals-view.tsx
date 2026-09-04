"use client";

import { useState } from "react";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { Button } from "@/components/shared/button";
import { Card, CardBody } from "@/components/shared/card";
import { Dialog } from "@/components/shared/dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  ApprovalTypeBadge,
  RiskBadge,
} from "@/components/shared/status-badge";
import { formatTicksAsUsd, type Ticks } from "@/lib/ai/money";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { agentName } from "@/lib/labels";
import { approvalPhilosophy } from "@/lib/policy";
import type { Approval } from "@/types";

export type BudgetView = {
  dailyLimitTicks: string;
  monthlyLimitTicks: string;
  dailyActualTicks: string;
  monthlyActualTicks: string;
  reservedTicks: string;
};

export function ApprovalsView({
  approvals,
  budget,
}: {
  approvals: Approval[];
  budget: BudgetView;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const pending = approvals.filter((item) => item.status === "pending");
  const preview = approvals.find((item) => item.id === previewId);
  const dailyUsed = BigInt(budget.dailyActualTicks) + BigInt(budget.reservedTicks);
  const monthlyUsed =
    BigInt(budget.monthlyActualTicks) + BigInt(budget.reservedTicks);

  return (
    <>
      <PageHeader
        title="Approvals"
        description="Paid AI usage requires an explicit dollar ceiling. External side effects stay behind this queue."
      />

      <Card className="mb-6">
        <CardBody className="grid gap-3 text-sm leading-6 text-muted md:grid-cols-3">
          <p>
            <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Read
            </span>
            {approvalPhilosophy.read}
          </p>
          <p>
            <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Internal writes
            </span>
            {approvalPhilosophy.internalWrite}
          </p>
          <p>
            <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
              External side effects
            </span>
            {approvalPhilosophy.external} Paid AI spend also requires a maximum authorization.
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-3">
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No pending approvals.</p>
        ) : null}
        {pending.map((approval) => (
          <article
            key={approval.id}
            className="rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-foreground">
                  {approval.businessName}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {approval.requestedAction}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ApprovalTypeBadge type={approval.type} />
                <RiskBadge level={approval.riskLevel} />
              </div>
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Agent</dt>
                <dd className="mt-0.5 text-foreground">
                  {agentName[approval.agentId]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Requested</dt>
                <dd className="mt-0.5 text-foreground">
                  {formatDateTime(approval.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-0.5 text-foreground capitalize">
                  {approval.status}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-sm leading-6 text-muted">{approval.reason}</p>
            {approval.type === "paid_ai_usage" ? (
              <div className="mt-3 rounded-md border border-border-subtle p-3">
                <p className="mb-3 text-xs text-muted">
                  Approving authorizes a spend ceiling. It does not call xAI.
                </p>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Model</dt>
                  <dd className="mt-0.5 text-foreground">{approval.model ?? "grok-4.6"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Purpose</dt>
                  <dd className="mt-0.5 text-foreground">{approval.purpose ?? approval.reason}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Estimated</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatCurrency(approval.estimatedCostUsd ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Maximum authorization</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatCurrency(approval.requestedMaxUsd ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Daily usage / cap</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatTicksAsUsd(dailyUsed as Ticks)} / {formatTicksAsUsd(BigInt(budget.dailyLimitTicks))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Monthly usage / cap</dt>
                  <dd className="mt-0.5 text-foreground">
                    {formatTicksAsUsd(monthlyUsed as Ticks)} / {formatTicksAsUsd(BigInt(budget.monthlyLimitTicks))}
                  </dd>
                </div>
              </dl>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-start gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPreviewId(approval.id)}
              >
                Preview
              </Button>
              <ApprovalActions approval={approval} />
            </div>
          </article>
        ))}
      </div>

      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreviewId(null)}
        title="Approval preview"
        description="Paid AI approvals persist to the database. Other side effects still require later integrations."
      >
        {preview ? (
          <div className="space-y-2 text-sm text-muted">
            <p>
              <span className="text-muted-foreground">Action: </span>
              {preview.requestedAction}
            </p>
            <p>
              <span className="text-muted-foreground">Reason: </span>
              {preview.reason}
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
