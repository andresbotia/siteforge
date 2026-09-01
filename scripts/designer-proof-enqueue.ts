/**
 * Enqueues ONE fixture Designer Job to prove the reference-driven,
 * commercial-quality Designer Worker pivot (imagery-mode strategy,
 * category-context information architecture, commercial page anatomy,
 * reference architecture, self-critique pass -- see brief.ts, category.ts,
 * reference.ts, prompt.ts). Run with `npm run designer:proof:enqueue`, then
 * `npm run designer:worker:once` to process it through the real worker.
 *
 * Deliberately professional_services -- a category never exercised by any
 * prior Designer Worker run (the earlier smoke test used landscaping) --
 * so this run actually exercises the new category-context differentiation
 * rather than repeating a memorized category. No imagery is attached
 * (honest PHOTO_ABSENT; no rights-safe professional-services imagery
 * exists yet -- see HANDOFF.md), which is itself a real test of the new
 * IMAGE STRATEGY FOR THIS JOB section.
 */
process.env.SITEFORGE_DESIGNER_WORKER = "true";

import { buildDesignerBrief } from "@/lib/designer/brief";
import { emptyImageryManifest, fixtureBusinessFacts } from "@/lib/designer/facts";
import { enqueueFixtureDesignerJob } from "@/lib/designer/worker-db";

async function main(): Promise<void> {
  const facts = fixtureBusinessFacts({
    businessName: "Sabal Point Tax & Bookkeeping",
    industry: "Bookkeeping and tax advisory services",
    city: "Boca Raton",
    region: "FL",
    phone: "(561) 555-0148",
    address: "1900 NW Corporate Blvd, Boca Raton, FL 33431",
  });

  const brief = buildDesignerBrief({
    industry: facts.industry,
    exampleBusiness: {
      name: facts.businessName,
      city: facts.city,
      region: facts.region,
      hasPhone: Boolean(facts.snapshot.phone),
      hasAddress: Boolean(facts.snapshot.address),
      hasRating: facts.snapshot.rating !== null,
      hasHours: facts.snapshot.dailyHours.length > 0,
    },
  });

  const result = await enqueueFixtureDesignerJob({
    mode: "new_master",
    templateFamily: null,
    reason:
      "Proof run for the reference-driven / commercial-quality Designer Worker session: exercises " +
      "imagery-mode strategy (PHOTO_ABSENT), category-context information architecture " +
      "(professional_services, not previously exercised), the commercial page-anatomy framework, " +
      "the formalized reference architecture, and the new self-critique pass. Synthetic fixture " +
      "business; must never be promoted to a commercial master or treated as a real lead.",
    facts,
    imagery: emptyImageryManifest(),
    designBriefMarkdown: brief.markdown,
  });

  if (!result.ok) {
    process.stderr.write(`[designer-proof-enqueue] FAILED: ${result.error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`[designer-proof-enqueue] Enqueued fixture Designer Job ${result.jobId} (${facts.businessName}).\n`);
  process.stdout.write(`[designer-proof-enqueue] Run: npm run designer:worker:once\n`);
}

main().catch((error) => {
  process.stderr.write(`[designer-proof-enqueue] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
