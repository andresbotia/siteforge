import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelDesignerJobAction, promoteDesignerJobToMasterAction } from "@/app/actions/designer";
import { VisualReviewForm } from "@/components/designer/visual-review-form";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, TextInput } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { getDesignerJob } from "@/data/designer";
import { canPromoteToMaster } from "@/lib/designer/state-machine";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const job = await getDesignerJob(id);
  return { title: job ? `Designer Job ${job.id.slice(0, 8)}` : "Designer Job" };
}

export default async function DesignerJobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await getDesignerJob(id);
  if (!job) notFound();

  const brief = asRecord(job.design_brief);
  const facts = asRecord(job.input_facts_snapshot);
  const qa = asRecord(job.technical_qa_report);
  const validation = asRecord(qa.validation);
  const build = asRecord(qa.build);
  const workerReport = asRecord(job.output_report);
  const hasWorkerReport = typeof workerReport.summary === "string" && workerReport.summary.length > 0;
  const cancellable = ["queued", "claimed", "preparing", "generating"].includes(job.status);
  const promotable = canPromoteToMaster({ status: job.status, visualReviewStatus: job.visual_review_status, mode: job.mode }) && !job.is_fixture;

  return (
    <>
      <PageHeader
        title={typeof facts.businessName === "string" ? facts.businessName : "Designer Job"}
        description={`${job.mode} · ${job.template_family ?? "family unassigned"} · created ${formatDateTime(job.created_at)}`}
        actions={
          <div className="flex items-center gap-2">
            {job.lead_id ? (
              <Link href={`/leads/${job.lead_id}`} className="text-xs text-accent hover:underline">
                View lead
              </Link>
            ) : null}
            {job.output_generated_website_id ? (
              <Link href={`/websites/${job.output_generated_website_id}`} className="text-xs text-accent hover:underline">
                View generated website
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
        <Badge tone="neutral">visual review: {job.visual_review_status}</Badge>
        {job.is_fixture ? <Badge tone="warning">fixture / QA only -- never promotable</Badge> : null}
        {job.promoted_to_master ? <Badge tone="success">promoted to master ({job.master_template_key})</Badge> : null}
        {job.failure_code ? <Badge tone="danger">{job.failure_code}</Badge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Job" />
          <CardBody className="grid gap-2 text-sm">
            <Row label="Provider" value={`${job.provider} (${job.billing_mode})`} />
            <Row label="Reason" value={job.reason} />
            <Row label="Claimed by" value={job.claimed_by ?? "not yet claimed"} />
            <Row label="Started" value={job.started_at ? formatDateTime(job.started_at) : "—"} />
            <Row label="Completed" value={job.completed_at ? formatDateTime(job.completed_at) : "—"} />
            <Row label="Cash cost" value={`$${Number(job.cash_cost_usd).toFixed(2)}`} />
            <Row label="Subscription usage" value={job.subscription_usage_status} />
            {job.failure_reason ? <Row label="Failure reason" value={job.failure_reason} /> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Technical QA" description="Independently computed by SiteForge. Never trusts the worker's self-report." />
          <CardBody className="grid gap-2 text-sm">
            <Row label="Validation" value={typeof validation.status === "string" ? validation.status : "not run yet"} />
            <Row label="Build" value={typeof build.status === "string" ? build.status : "not run yet"} />
            {Array.isArray(validation.findings) && validation.findings.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">Findings</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted">
                  {validation.findings.map((finding: unknown, index: number) => {
                    const row = asRecord(finding);
                    return (
                      <li key={index}>
                        [{String(row.severity)}] {String(row.code)}: {String(row.message)}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Design brief" description="Provider-neutral, generated deterministically. This is what was sent to the worker." />
        <CardBody>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs text-muted">
            {typeof brief.markdown === "string" ? brief.markdown : "No brief recorded."}
          </pre>
        </CardBody>
      </Card>

      {hasWorkerReport ? (
        <Card className="mt-4">
          <CardHeader
            title="Worker's own report"
            description="A claim, not a verdict -- SiteForge independently validates the output above and does not trust this by itself."
          />
          <CardBody className="grid gap-3 text-sm">
            <Row label="Summary" value={String(workerReport.summary)} />
            {typeof workerReport.visualNotes === "string" && workerReport.visualNotes ? (
              <div>
                <p className="text-xs font-medium text-muted">Design decisions (visualNotes)</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{workerReport.visualNotes}</p>
              </div>
            ) : null}
            {typeof workerReport.selfCritique === "string" && workerReport.selfCritique ? (
              <div>
                <p className="text-xs font-medium text-muted">Self-critique pass</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{workerReport.selfCritique}</p>
              </div>
            ) : null}
            {Array.isArray(workerReport.factsOmitted) && workerReport.factsOmitted.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">Facts omitted (honest absence, not invented)</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {workerReport.factsOmitted.map((item: unknown, index: number) => (
                    <li key={index}>{String(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {Array.isArray(workerReport.warnings) && workerReport.warnings.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-muted">Worker warnings</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {workerReport.warnings.map((item: unknown, index: number) => (
                    <li key={index}>{String(item)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      {job.status === "visual_review_required" ? (
        <Card className="mt-4">
          <CardHeader
            title="Human visual review"
            description={`Would you confidently send this to ${typeof facts.businessName === "string" ? facts.businessName : "the business"}? An AI worker cannot answer this question for itself.`}
          />
          <CardBody>
            <VisualReviewForm jobId={job.id} />
          </CardBody>
        </Card>
      ) : job.visual_review_notes ? (
        <Card className="mt-4">
          <CardHeader title="Visual review" description={`${job.visual_review_status} by ${job.visual_reviewed_by ?? "unknown"} on ${job.visual_reviewed_at ? formatDateTime(job.visual_reviewed_at) : ""}`} />
          <CardBody>
            <p className="text-sm whitespace-pre-wrap text-muted">{job.visual_review_notes}</p>
          </CardBody>
        </Card>
      ) : null}

      {promotable ? (
        <Card className="mt-4">
          <CardHeader title="Promote to reusable master" description="Only available for an approved, non-fixture, new_master job." />
          <CardBody>
            <form action={promoteDesignerJobToMasterAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="jobId" value={job.id} />
              <Field label="Master template key" htmlFor="master-key">
                <TextInput id="master-key" name="masterTemplateKey" placeholder="e.g. home-services-editorial-v1" required />
              </Field>
              <Button type="submit" variant="primary">
                Promote to master
              </Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">
              This records the promotion on the job. Wiring a promoted master into the deterministic Builder registry (src/lib/builder/registry.ts) is a follow-up step, not automatic.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {cancellable ? (
        <form action={cancelDesignerJobAction} className="mt-4">
          <input type="hidden" name="jobId" value={job.id} />
          <Button type="submit" variant="danger" size="sm">
            Cancel job
          </Button>
        </form>
      ) : null}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

function statusTone(status: string): "neutral" | "accent" | "success" | "warning" | "danger" | "info" {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "visual_review_required") return "warning";
  if (status === "cancelled" || status === "superseded") return "neutral";
  return "info";
}
