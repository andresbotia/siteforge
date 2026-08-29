import type { Metadata } from "next";
import Link from "next/link";
import { AuditorRunForm } from "@/components/auditor/auditor-run-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  LeadStatusBadge,
  QualificationBadge,
} from "@/components/shared/status-badge";
import { listAuditorRuns, listEligibleLeadsForAudit } from "@/data/auditor";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Auditor",
};

export default async function AuditorPage() {
  const [leads, runs] = await Promise.all([
    listEligibleLeadsForAudit(),
    listAuditorRuns(),
  ]);

  return (
    <>
      <PageHeader
        title="Auditor"
        description="Deep website analysis. Manual, $0 deterministic audit. Paid AI is not required. Auditor does not generate a replacement site or contact the business."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Start a website audit"
            description="Choose an existing Scout lead. Inspection is bounded and SSRF-safe."
          />
          <CardBody>
            <AuditorRunForm leads={leads} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent Auditor runs" />
          {runs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No Auditor runs yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const output = asRecord(run.output);
                const auditId = typeof output.audit_id === "string" ? output.audit_id : null;
                return (
                  <li
                    key={run.id}
                    className="border-t border-border-subtle px-4 py-3 first:border-t-0"
                  >
                    {auditId ? (
                      <Link
                        href={`/audits/${auditId}`}
                        className="text-sm font-medium hover:text-accent"
                      >
                        {run.purpose ?? "Auditor run"}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">{run.purpose ?? "Auditor run"}</p>
                    )}
                    <p className="mt-1 text-xs text-muted">
                      {run.status} · {formatDateTime(run.started_at ?? run.created_at)}
                      {typeof output.overall_audit_score === "number"
                        ? ` · overall ${output.overall_audit_score}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader
          title="Eligible leads"
          description="Review, qualified, and high-priority Scout candidates, plus later-stage leads available for re-audit."
        />
        {leads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">No eligible leads yet.</p>
        ) : (
          <ul>
            {leads.slice(0, 12).map((lead) => (
              <li
                key={lead.id}
                className="flex flex-col gap-2 border-t border-border-subtle px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link href={`/leads/${lead.id}`} className="text-sm font-medium hover:text-accent">
                    {lead.businessName}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {lead.industry} · {lead.location || "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <LeadStatusBadge status={lead.status} />
                  {lead.qualificationTier ? (
                    <QualificationBadge tier={lead.qualificationTier} />
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
