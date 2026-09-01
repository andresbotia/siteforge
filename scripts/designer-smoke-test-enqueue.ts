/**
 * Enqueues ONE fixture Designer Job for the real production Designer Worker
 * to claim and process. Run with `npm run designer:smoke-test:enqueue`, then
 * `npm run designer:worker:once` to process it through the actual worker
 * (real claim, real Claude Code subscription invocation, real SiteForge
 * validation) -- this script does not touch the Claude CLI or generate any
 * site content itself, it only writes the queued work order.
 *
 * Exists only because this script has no HTTP session/cookies to satisfy
 * requireAdminSession(), which the real admin-UI path
 * (requestDesignerJobAction / createFixtureDesignerJobAction in
 * src/app/actions/designer.ts) requires. See
 * src/lib/designer/worker-db.ts's enqueueFixtureDesignerJob(), which is
 * hard-limited to is_fixture=true and can never enqueue a real lead.
 *
 * Deliberately NOT the HVAC fixture used by the earlier Designer smoke
 * test and the isolated design-quality experiment -- a different category
 * (landscaping) lets a human reviewer judge whether the worker learned
 * transferable design PRINCIPLES, rather than just reproducing one
 * memorized business.
 */
process.env.SITEFORGE_DESIGNER_WORKER = "true";

import { buildDesignerBrief } from "@/lib/designer/brief";
import { emptyImageryManifest, fixtureBusinessFacts } from "@/lib/designer/facts";
import { enqueueFixtureDesignerJob } from "@/lib/designer/worker-db";

async function main(): Promise<void> {
  const facts = fixtureBusinessFacts({
    businessName: "Cypress & Coast Landscape Co.",
    industry: "Residential landscaping and lawn care",
    city: "Delray Beach",
    region: "FL",
    phone: "(561) 555-0173",
    address: "2240 S Federal Hwy, Delray Beach, FL 33483",
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
      "Production Designer Worker smoke test after the visual-quality pivot. Non-HVAC category " +
      "(landscaping) chosen deliberately to test whether the worker learned transferable design " +
      "principles rather than reproducing the earlier isolated HVAC experiment. Synthetic fixture " +
      "business; must never be promoted to a commercial master or treated as a real lead.",
    facts,
    imagery: emptyImageryManifest(),
    designBriefMarkdown: brief.markdown,
  });

  if (!result.ok) {
    process.stderr.write(`[designer-smoke-test-enqueue] FAILED: ${result.error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`[designer-smoke-test-enqueue] Enqueued fixture Designer Job ${result.jobId} (${facts.businessName}).\n`);
  process.stdout.write(`[designer-smoke-test-enqueue] Run: npm run designer:worker:once\n`);
}

main().catch((error) => {
  process.stderr.write(`[designer-smoke-test-enqueue] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
