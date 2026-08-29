"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/shared/button";
import { Card, CardBody } from "@/components/shared/card";
import { Dialog } from "@/components/shared/dialog";
import { PageHeader } from "@/components/shared/page-header";
import {
  ApprovalTypeBadge,
  RiskBadge,
} from "@/components/shared/status-badge";
import { formatDateTime } from "@/lib/format";
import { agentName } from "@/lib/labels";
import { approvalPhilosophy } from "@/lib/policy";
import type { Approval, ApprovalStatus } from "@/types";

export function ApprovalsView({ approvals }: { approvals: Approval[] }) {
  const [records, setRecords] = useState(approvals);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const preview = records.find((item) => item.id === previewId);
  const pending = useMemo(
    () => records.filter((item) => item.status === "pending"),
    [records],
  );

  function updateStatus(id: string, status: ApprovalStatus) {
    setRecords((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              approvedAt: status === "approved" ? new Date().toISOString() : item.approvedAt,
            }
          : item,
      ),
    );
    setNotice(
      status === "approved"
        ? "Marked approved locally. No external action was taken."
        : "Marked rejected locally. No external action was taken.",
    );
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        description="External side effects stay behind this queue. Buttons update local mock state only."
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
            {approvalPhilosophy.external}
          </p>
        </CardBody>
      </Card>

      {notice ? (
        <p className="mb-4 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3">
        {pending.length === 0 ? (
          <p className="text-sm text-muted">No pending approvals.</p>
        ) : null}
        {pending.map((approval) => {
          return (
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
              <p className="mt-3 text-sm leading-6 text-muted">
                {approval.reason}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewId(approval.id)}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => updateStatus(approval.id, "approved")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => updateStatus(approval.id, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog
        open={Boolean(preview)}
        onClose={() => setPreviewId(null)}
        title="Approval preview"
        description="Preview deployments, email sending, and payments are not connected."
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
            <p className="text-xs text-muted-foreground">
              This dialog is UI-only. No website, email, or payment was changed.
            </p>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
