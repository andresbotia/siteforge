"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  requestOutreachSendApprovalAction,
  sendApprovedOutreachAction,
  updateOutreachDraftAction,
  type SalesActionState,
} from "@/app/actions/sales";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, TextArea, TextInput } from "@/components/shared/field";
import { OutreachStatusBadge } from "@/components/shared/status-badge";
import type { OutreachDetail } from "@/data/outreach";
import { formatDateTime } from "@/lib/format";

export function OutreachDetailView({
  outreach,
}: {
  outreach: OutreachDetail;
}) {
  const [editState, saveAction, saving] = useActionState<SalesActionState, FormData>(
    updateOutreachDraftAction,
    null,
  );
  const [requestState, requestAction, requesting] = useActionState<SalesActionState, FormData>(
    requestOutreachSendApprovalAction,
    null,
  );
  const [sendState, sendAction, sending] = useActionState<SalesActionState, FormData>(
    sendApprovedOutreachAction,
    null,
  );

  const [subject, setSubject] = useState(outreach.subject);
  const [body, setBody] = useState(outreach.body);
  const [recipientEmail, setRecipientEmail] = useState(outreach.recipient);

  const isSent = outreach.status === "sent";
  const isAwaiting = outreach.status === "awaiting_approval";
  const isApproved = outreach.status === "approved";
  const isDraft = outreach.status === "draft";
  const isSendable = Boolean(recipientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()));

  const previewActive =
    outreach.previewDeployment &&
    outreach.previewDeployment.status === "active" &&
    !outreach.previewDeployment.revoked_at;

  return (
    <div className="grid gap-6">
      {/* Top Header Card */}
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{outreach.businessName}</h1>
            <OutreachStatusBadge status={outreach.status} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Created: {formatDateTime(outreach.createdAt)}
            {outreach.sentAt ? ` - Sent: ${formatDateTime(outreach.sentAt)}` : ""}
            {outreach.lead ? (
              <>
                {" - "}
                <Link href={`/leads/${outreach.lead.id}`} className="text-accent hover:underline">
                  View Lead Profile
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {outreach.previewDeployment ? (
            <Badge tone={previewActive ? "accent" : "danger"}>
              Preview: {previewActive ? "Active" : "Revoked/Inactive"} (ending {outreach.tokenHint})
            </Badge>
          ) : (
            <Badge tone="warning">No Preview Linked</Badge>
          )}
        </div>
      </div>

      {/* Main Grid: Left Editor & Actions, Right Evidence & Analytics */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Left Column: Email Content & Send Action */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Outreach Email Draft"
              description="Personalized content derived from audit findings and preview. Changes will require re-approval."
            />
            <CardBody>
              <form action={saveAction} className="grid gap-4">
                <input type="hidden" name="outreachId" value={outreach.id} />

                <Field label="Recipient Email" htmlFor="recipient-email">
                  <div className="flex items-center gap-2">
                    <TextInput
                      id="recipient-email"
                      name="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      disabled={isSent}
                      placeholder="e.g. owner@business.com"
                      required
                    />
                    <Badge tone={isSendable ? "accent" : "warning"}>
                      {isSendable ? "Valid" : "Missing / Invalid"}
                    </Badge>
                  </div>
                </Field>

                <Field label="Subject Line" htmlFor="email-subject">
                  <TextInput
                    id="email-subject"
                    name="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    disabled={isSent}
                    required
                  />
                </Field>

                <Field label="Email Body" htmlFor="email-body">
                  <TextArea
                    id="email-body"
                    name="body"
                    rows={12}
                    value={body}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
                    disabled={isSent}
                    className="font-mono text-xs leading-relaxed"
                    required
                  />
                </Field>

                {!isSent ? (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted">
                      {isAwaiting || isApproved
                        ? "Saving changes will reset existing approval."
                        : "Draft mode"}
                    </p>
                    <Button type="submit" variant="secondary" size="sm" disabled={saving}>
                      {saving ? "Saving..." : "Save Draft Changes"}
                    </Button>
                  </div>
                ) : null}

                {editState?.error ? (
                  <p className="text-xs text-danger" role="alert">
                    {editState.error}
                  </p>
                ) : null}
              </form>
            </CardBody>
          </Card>

          {/* Workflow & Approval Box */}
          <Card>
            <CardHeader
              title="Approval & Send Controls"
              description="Human-in-the-loop gating. External email cannot be sent without explicit human approval."
            />
            <CardBody className="space-y-4">
              {/* Draft state: request approval */}
              {isDraft ? (
                <div className="rounded-lg border border-border-subtle bg-surface-subtle/50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Request Send Approval</p>
                      <p className="text-xs text-muted">
                        {!isSendable
                          ? "Enter a valid recipient email above before requesting approval."
                          : !previewActive
                            ? "Associated preview deployment is not active."
                            : "Creates a pending approval request for a human operator."}
                      </p>
                    </div>
                    <form action={requestAction}>
                      <input type="hidden" name="outreachId" value={outreach.id} />
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={requesting || !isSendable || !previewActive}
                      >
                        {requesting ? "Requesting..." : "Request Send Approval"}
                      </Button>
                    </form>
                  </div>
                  {requestState?.error ? (
                    <p className="mt-2 text-xs text-danger">{requestState.error}</p>
                  ) : null}
                </div>
              ) : null}

              {/* Awaiting Approval state */}
              {isAwaiting ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                  <p className="text-sm font-medium text-amber-300">
                    Awaiting Human Approval
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    An approval request is currently pending. An admin must review and approve this outreach before it can be sent.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link href="/approvals">
                      <Button variant="secondary" size="sm">
                        Go to Approvals Queue
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : null}

              {/* Approved state: execute send */}
              {isApproved ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-300">
                        Outreach Approved for Sending
                      </p>
                      <p className="mt-1 text-xs text-emerald-200/80">
                        Approved by human operator. Ready for backend send execution.
                      </p>
                    </div>
                    <form action={sendAction}>
                      <input type="hidden" name="outreachId" value={outreach.id} />
                      <Button type="submit" variant="primary" disabled={sending}>
                        {sending ? "Sending..." : "Send Approved Email"}
                      </Button>
                    </form>
                  </div>
                  <div className="mt-3 rounded border border-emerald-500/20 bg-emerald-950/40 p-2.5 text-xs text-emerald-200/70">
                    Backend execution revalidates approval, content hash, live-email gate, provider configuration, and suppression status.
                  </div>
                  {sendState?.error ? (
                    <p className="mt-2 text-xs text-danger">{sendState.error}</p>
                  ) : null}
                </div>
              ) : null}

              {/* Sent state */}
              {isSent ? (
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                  <p className="text-sm font-medium text-blue-300">
                    Email Sent Successfully
                  </p>
                  <p className="mt-1 text-xs text-blue-200/80">
                    Delivered via {outreach.provider} provider at {outreach.sentAt ? formatDateTime(outreach.sentAt) : ""}.
                  </p>
                  {outreach.providerMessageId ? (
                    <p className="mt-1 font-mono text-xs text-muted">
                      Message ID: {outreach.providerMessageId}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Evidence, Preview Link & Analytics, Timeline */}
        <div className="space-y-6">
          {/* Sourced Evidence Panel */}
          <Card>
            <CardHeader
              title="Why this draft says what it says"
              description="Traceability & factual integrity. All statements are bound to structured evidence."
            />
            <CardBody>
              {outreach.evidence.length === 0 ? (
                <p className="text-sm text-muted">No evidence records captured.</p>
              ) : (
                <ul className="space-y-3">
                  {outreach.evidence.map((item, index) => (
                    <li key={index} className="rounded border border-border-subtle bg-surface-subtle/40 p-2.5 text-xs">
                      <span className="font-semibold text-foreground uppercase tracking-wider text-[10px]">
                        {item.type.replace("_", " ")}
                      </span>
                      <p className="mt-1 text-muted-foreground">{item.text}</p>
                      {item.source ? (
                        <p className="mt-0.5 font-mono text-[10px] text-muted">Source: {item.source}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Outreach Link & Attribution"
              description="Activity attributed to this outreach preview link."
            />
            <CardBody className="space-y-3">
              {outreach.previewDeployment ? (
                <div>
                  <p className="text-xs text-muted">Outreach preview link:</p>
                  <div className="mt-1 rounded bg-surface-subtle p-2 font-mono text-xs text-accent break-all">
                    {outreach.attributionTokenHint ? `/o/...${outreach.attributionTokenHint}` : "not generated"}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded border border-border-subtle p-2">
                      <span className="text-lg font-bold text-foreground">
                        {outreach.attributedPreviewEvents.filter((e) => e.event_type === "preview_viewed").length}
                      </span>
                      <p className="text-[11px] text-muted">Preview Views</p>
                    </div>
                    <div className="rounded border border-border-subtle p-2">
                      <span className="text-lg font-bold text-foreground">
                        {outreach.attributedPreviewEvents.filter((e) => e.event_type !== "preview_viewed").length}
                      </span>
                      <p className="text-[11px] text-muted">CTA Interactions</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted">No active preview deployment linked.</p>
              )}

              <p className="text-[11px] text-muted-foreground">
                Privacy notice: Activity attributed to this preview link. Raw IP addresses are not stored. Email scanners may trigger automated views.
              </p>
            </CardBody>
          </Card>

          {/* Outreach Events Timeline */}
          <Card>
            <CardHeader title="Outreach Lifecycle Events" />
            <CardBody>
              {outreach.events.length === 0 ? (
                <p className="text-xs text-muted">No events recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {outreach.events.map((event) => (
                    <li key={event.id} className="border-l-2 border-accent pl-3 text-xs">
                      <span className="font-medium text-foreground">{event.event_type}</span>
                      <p className="text-muted text-[11px]">{formatDateTime(event.occurred_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
