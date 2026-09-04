import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/shared/badge";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { MetricCard } from "@/components/shared/metric-card";
import { PageHeader } from "@/components/shared/page-header";
import { getScoutRun } from "@/data/scout";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scout run",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "build", label: "BUILD" },
  { key: "review", label: "REVIEW" },
  { key: "skip", label: "SKIP" },
  { key: "no_website", label: "No website" },
  { key: "weak_website", label: "Weak website" },
  { key: "rating_3", label: "3.0+ stars" },
  { key: "rating_4", label: "4.0+ stars" },
  { key: "reviews_100", label: "100+ reviews" },
  { key: "reviews_500", label: "500+ reviews" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

type PageProps = {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ filter?: string }>;
};

export default async function ScoutRunPage({ params, searchParams }: PageProps) {
  const { runId } = await params;
  const { filter: rawFilter } = await searchParams;
  const run = await getScoutRun(runId);
  if (!run) notFound();
  const output = asRecord(run.output);
  const allCandidates = Array.isArray(output.candidates) ? output.candidates.map(asRecord) : [];
  const filter: FilterKey = FILTERS.some((item) => item.key === rawFilter) ? (rawFilter as FilterKey) : "all";
  const candidates = allCandidates.filter((row) => matchesFilter(row, filter));
  const discoveryDiagnostic = typeof output.discovery_diagnostic === "string" ? output.discovery_diagnostic : null;

  return (
    <>
      <PageHeader
        title={run.purpose ?? "Scout run"}
        description={`${run.status} · Discovery cost $0.00 · Provider: ${String(output.discovery_provider ?? "—")} · Paid AI not required`}
      />
      <p className="mb-4 text-xs text-muted">
        <Link href="/agents/scout" className="hover:text-foreground">
          Back to Scout
        </Link>
        {run.completed_at ? ` · Finished ${formatDateTime(run.completed_at)}` : ""}
      </p>

      {discoveryDiagnostic ? (
        <Card className="mb-4">
          <CardBody className="text-sm">
            <p className="font-medium">Discovery note</p>
            <p className="mt-1 text-muted">{discoveryDiagnostic}</p>
          </CardBody>
        </Card>
      ) : null}

      {typeof output.provider_selection_note === "string" ? (
        <Card className="mb-4">
          <CardBody className="text-sm">
            <p className="font-medium">Provider selection</p>
            <p className="mt-1 text-muted">{output.provider_selection_note}</p>
          </CardBody>
        </Card>
      ) : null}

      {output.ceiling_reached ? (
        <Card className="mb-4">
          <CardBody className="text-sm">
            <p className="font-medium">Partial run: request ceiling reached</p>
            <p className="mt-1 text-muted">
              {String(output.not_inspected_due_to_ceiling ?? 0)} discovered candidate(s) were not inspected this run to stay within the per-run external
              request budget. No infinite discovery loop was run.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Discovered" value={String(output.discovered ?? 0)} />
        <MetricCard label="Inspected" value={String(output.inspected ?? 0)} />
        <MetricCard label="Build" value={String(output.build ?? 0)} />
        <MetricCard label="Review / Skip" value={`${String(output.review_commercial ?? 0)} / ${String(output.skip ?? 0)}`} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={item.key === "all" ? `/agents/scout/${runId}` : `/agents/scout/${runId}?filter=${item.key}`}
            className={`rounded-full border px-3 py-1 text-xs ${filter === item.key ? "border-accent bg-accent/10 text-accent" : "border-border-subtle text-muted hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Candidates"
          description="Deterministic qualification and commercial ranking. No LLM scoring. Ranked by commercial potential."
        />
        <CardBody className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Business</th>
                <th className="px-4 py-2 font-medium">Category / City</th>
                <th className="px-4 py-2 font-medium">Provider</th>
                <th className="px-4 py-2 font-medium">Rating / Reviews</th>
                <th className="px-4 py-2 font-medium">Website status</th>
                <th className="px-4 py-2 font-medium">Strength</th>
                <th className="px-4 py-2 font-medium">Opportunity</th>
                <th className="px-4 py-2 font-medium">Contactability</th>
                <th className="px-4 py-2 font-medium">Facts</th>
                <th className="px-4 py-2 font-medium">Designer coverage</th>
                <th className="px-4 py-2 font-medium">Commercial score</th>
                <th className="px-4 py-2 font-medium">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={12}>
                    No candidates match this filter.
                  </td>
                </tr>
              ) : (
                candidates.map((row, index) => {
                  const leadId = typeof row.lead_id === "string" ? row.lead_id : null;
                  const name = String(row.name ?? "Unknown");
                  const reasons = Array.isArray(row.commercial_reasons) ? row.commercial_reasons.slice(0, 3) : [];
                  return (
                    <tr key={`${name}-${index}`} className="border-t border-border-subtle align-top">
                      <td className="px-4 py-2">
                        {leadId ? (
                          <Link href={`/leads/${leadId}`} className="font-medium hover:text-accent">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                        {reasons.length > 0 ? (
                          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                            {reasons.map((reason: unknown, i: number) => (
                              <li key={i}>{String(reason)}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {String(row.category ?? "")}
                        <br />
                        {String(row.city ?? "")}
                      </td>
                      <td className="px-4 py-2 text-muted">{String(row.source ?? "—")}</td>
                      <td className="px-4 py-2 tabular-nums text-muted">
                        {row.rating ? `${Number(row.rating).toFixed(1)} (${String(row.rating_tier ?? "—")})` : "— (UNKNOWN)"}
                        <br />
                        {typeof row.reviews === "number" ? `${row.reviews} (${String(row.review_volume_tier ?? "—")})` : "— (UNKNOWN)"}
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {websiteStatusText(String(row.website_status ?? ""))}
                        {row.business_status && row.business_status !== "OPERATIONAL" ? (
                          <div className="text-[11px] text-danger">{String(row.business_status)}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{String(row.business_strength ?? "—")}</td>
                      <td className="px-4 py-2 tabular-nums">{String(row.website_opportunity ?? "—")}</td>
                      <td className="px-4 py-2 tabular-nums">
                        {String(row.contactability_score ?? "—")}
                        {Array.isArray(row.contactability_channels) && row.contactability_channels.length > 0 ? (
                          <div className="text-[11px] text-muted-foreground">{row.contactability_channels.join(", ")}</div>
                        ) : (
                          <div className="text-[11px] text-danger">none verified</div>
                        )}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{String(row.facts_completeness_count ?? "—")}/6</td>
                      <td className="px-4 py-2">{String(row.designer_coverage ?? "—")}</td>
                      <td className="px-4 py-2 tabular-nums font-medium">{String(row.commercial_score ?? "—")}</td>
                      <td className="px-4 py-2">
                        <Badge tone={recommendationTone(String(row.recommendation ?? ""))}>{String(row.recommendation ?? "—")}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  );
}

function matchesFilter(row: Record<string, unknown>, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "build") return row.recommendation === "BUILD";
  if (filter === "review") return row.recommendation === "REVIEW";
  if (filter === "skip") return row.recommendation === "SKIP";
  if (filter === "no_website") {
    return row.website_status === "no_standalone_website_unverified" || row.website_status === "social_or_directory_only" || row.website_status === "website_not_listed_by_provider";
  }
  if (filter === "weak_website") return typeof row.website_opportunity === "number" && row.website_opportunity >= 55;
  if (filter === "rating_3") return typeof row.rating === "number" && row.rating >= 3.0;
  if (filter === "rating_4") return typeof row.rating === "number" && row.rating >= 4.0;
  if (filter === "reviews_100") return typeof row.reviews === "number" && row.reviews >= 100;
  if (filter === "reviews_500") return typeof row.reviews === "number" && row.reviews >= 500;
  return true;
}

function websiteStatusText(status: string): string {
  switch (status) {
    case "working_standalone_website":
      return "Working website";
    case "website_unreachable":
      return "Listed but unreachable";
    case "social_or_directory_only":
      return "Social/directory only";
    case "website_not_listed_by_provider":
      return "Not listed by Google (unconfirmed)";
    case "no_standalone_website_unverified":
      return "No website verified";
    default:
      return status || "—";
  }
}

function recommendationTone(value: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (value === "BUILD") return "success";
  if (value === "REVIEW") return "warning";
  if (value === "SKIP") return "neutral";
  return "neutral";
}
