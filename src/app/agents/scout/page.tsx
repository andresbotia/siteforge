import type { Metadata } from "next";
import Link from "next/link";
import { ScoutRunForm } from "@/components/scout/scout-run-form";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { PageHeader } from "@/components/shared/page-header";
import { listScoutRuns } from "@/data/scout";
import { formatDateTime } from "@/lib/format";
import { asRecord } from "@/lib/json";
import { isGooglePlacesConfigured } from "@/lib/scout/providers/google-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scout",
};

export default async function ScoutPage() {
  const runs = await listScoutRuns();
  const googleConfigured = isGooglePlacesConfigured();

  return (
    <>
      <PageHeader
        title="Scout"
        description={
          googleConfigured
            ? "Google Places (official API) is configured and preferred for discovery, with the $0 OpenStreetMap Overpass provider as fallback. No paid AI. Stops at a ranked recommendation -- no outreach, no site generation, no deployment."
            : "Real, $0 lead discovery from the public OpenStreetMap Overpass API. Google Places is not configured (GOOGLE_PLACES_API_KEY unset) -- see Settings. No paid AI. Stops at a ranked recommendation -- no outreach, no site generation, no deployment."
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Start a Scout run"
            description="Configure geography and category, then inspect a bounded candidate set."
          />
          <CardBody>
            <ScoutRunForm googlePlacesConfigured={googleConfigured} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recent Scout runs" />
          {runs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No Scout runs yet.</p>
          ) : (
            <ul>
              {runs.map((run) => {
                const output = asRecord(run.output);
                return (
                  <li
                    key={run.id}
                    className="border-t border-border-subtle px-4 py-3 first:border-t-0"
                  >
                    <Link
                      href={`/agents/scout/${run.id}`}
                      className="text-sm font-medium hover:text-accent"
                    >
                      {run.purpose ?? "Scout run"}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {run.status} · {formatDateTime(run.started_at ?? run.created_at)}
                      {typeof output.discovered === "number"
                        ? ` · ${output.discovered} discovered`
                        : ""}
                      {typeof output.build === "number"
                        ? ` · ${output.build} build / ${output.review_commercial ?? 0} review / ${output.skip ?? 0} skip`
                        : ""}
                      {run.provider ? ` · ${run.provider}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
