import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { runTemplateQa } from "@/lib/builder/qa";
import { validateWebsiteSpec } from "@/lib/builder/validate";

/**
 * Deterministic pre-review QA for a Builder draft. Read-only: it reports what a
 * reviewer should look at and never changes the draft or an approval state.
 */
export function TemplateQaCard({ spec }: { spec: unknown }) {
  const validated = validateWebsiteSpec(spec);
  if (!validated.ok) {
    return (
      <Card className="mt-4">
        <CardHeader title="Template QA" description="Automated pre-review checks. No paid services are used." />
        <CardBody>
          <p className="text-sm text-muted">
            Spec failed trusted validation ({validated.error}); QA cannot run.
          </p>
        </CardBody>
      </Card>
    );
  }

  const report = runTemplateQa(validated.spec);
  const blockers = report.findings.filter((finding) => finding.severity === "blocker");
  const warnings = report.findings.filter((finding) => finding.severity === "warning");
  const notes = report.findings.filter((finding) => finding.severity === "note");

  return (
    <Card className="mt-4">
      <CardHeader
        title="Template QA"
        description="Deterministic pre-review checks over the stored spec. $0, no network, no paid AI."
        action={
          <Badge tone={report.passed ? "success" : "danger"}>
            {report.passed ? "No blockers" : `${report.blockers} blocker${report.blockers === 1 ? "" : "s"}`}
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Template" value={report.templateId} />
          <Stat label="Blockers" value={String(report.blockers)} />
          <Stat label="Warnings" value={String(report.warnings)} />
        </div>

        {report.findings.length === 0 ? (
          <p className="text-sm text-muted">All checks passed.</p>
        ) : (
          <div className="space-y-4">
            <FindingGroup title="Blockers" tone="danger" findings={blockers} />
            <FindingGroup title="Warnings" tone="warning" findings={warnings} />
            <FindingGroup title="Notes" tone="neutral" findings={notes} />
          </div>
        )}

        <p className="text-xs text-muted">
          QA is advisory. Human review is still required before any preview approval or outreach.
        </p>
      </CardBody>
    </Card>
  );
}

function FindingGroup({
  title,
  tone,
  findings,
}: {
  title: string;
  tone: "danger" | "warning" | "neutral";
  findings: Array<{ code: string; message: string; location: string }>;
}) {
  if (findings.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-2">
        {findings.map((finding, index) => (
          <li key={`${finding.code}-${index}`} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={tone}>{finding.code}</Badge>
              <span className="font-mono text-xs text-muted">{finding.location}</span>
            </div>
            <p className="mt-2 text-sm">{finding.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}
