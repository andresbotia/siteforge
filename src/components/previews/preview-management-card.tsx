import Link from "next/link";
import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import {
  RequestPreviewPublicationForm,
  RevokePreviewDeploymentForm,
} from "@/components/previews/preview-action-forms";
import { formatDateTime } from "@/lib/format";
import type { GeneratedWebsite, PreviewAnalytics } from "@/types";

export function PreviewManagementCard({
  site,
  analytics,
}: {
  site: GeneratedWebsite;
  analytics: PreviewAnalytics;
}) {
  const deployment = analytics.deployment;
  const active = deployment?.status === "active";

  return (
    <Card className="mt-4">
      <CardHeader
        title="Prospect preview"
        description="Human-approved public preview. Full tokenized URLs are shown only when approval executes."
        action={
          deployment ? (
            <Badge tone={active ? "success" : "neutral"}>{deployment.status}</Badge>
          ) : analytics.pendingApprovalId ? (
            <Badge tone="warning">pending approval</Badge>
          ) : (
            <Badge tone="neutral">not published</Badge>
          )
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 text-sm sm:grid-cols-4">
          <Metric label="Human views" value={analytics.humanLikelyViews} />
          <Metric label="Bot views" value={analytics.botLikelyViews} />
          <Metric label="CTA clicks" value={analytics.ctaClicks} />
          <Metric label="Visitors" value={analytics.uniqueVisitors} />
        </div>

        {deployment ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Token hint" value={`...${deployment.tokenHint}`} />
            <Detail label="Approved" value={formatDateTime(deployment.approvedAt)} />
            <Detail
              label="Last viewed"
              value={deployment.lastViewedAt ? formatDateTime(deployment.lastViewedAt) : "none"}
            />
            <Detail
              label="Attribution"
              value={deployment.campaignId ?? deployment.outreachId ?? "unassigned"}
            />
          </dl>
        ) : (
          <p className="text-sm text-muted">
            No public preview exists for this Builder draft.
          </p>
        )}

        {active ? (
          <RevokePreviewDeploymentForm
            websiteId={site.id}
            deploymentId={deployment.id}
          />
        ) : analytics.pendingApprovalId ? (
          <p className="text-sm text-muted">
            Approval is waiting in the <Link href="/approvals" className="underline">approvals queue</Link>.
          </p>
        ) : (
          <RequestPreviewPublicationForm websiteId={site.id} disabled={!site.spec} />
        )}

        {analytics.recentEvents.length ? (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase">
              Recent tracking
            </h3>
            <ul className="mt-2 divide-y divide-border-subtle text-sm">
              {analytics.recentEvents.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="text-foreground">{event.eventType}</span>
                  <span className="text-muted">
                    {event.botClassification} &middot; {event.deviceClass} &middot; {formatDateTime(event.occurredAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 break-all text-foreground">{value}</p>
    </div>
  );
}
