/**
 * Provider-neutral, Builder-agnostic brief for a Designer Job.
 *
 * Deliberately does NOT import src/lib/builder/design-system.ts
 * (DESIGN_PRESETS) or src/lib/builder/registry.ts. Those encode Builder's
 * own visual system -- specific palette hex/oklch values, named hero
 * treatments ("image-overlay", "split-editorial"), a fixed section plan --
 * and this brief is exactly the thing that must never carry that into the
 * Designer Worker's prompt (see prompt.ts's HARD VISUAL ISOLATION RULE).
 *
 * This brief only ever carries job-specific facts: the category, and which
 * fact categories are and are not available. All durable design direction
 * (visual principles, anti-generic rules, claim safety, imagery provenance,
 * Google Maps, SEO) lives in the static DESIGNER_WORKER_SYSTEM_PROMPT in
 * prompt.ts instead, shared unchanged across every job.
 */
export type DesignerBriefRequest = {
  industry: string;
  exampleBusiness?: {
    name: string;
    city: string | null;
    region: string | null;
    hasPhone: boolean;
    hasAddress: boolean;
    hasRating: boolean;
    hasHours: boolean;
  } | null;
};

export type DesignerBrief = {
  industry: string;
  markdown: string;
};

export function buildDesignerBrief(request: DesignerBriefRequest): DesignerBrief {
  const industry = request.industry.trim() || "local service business";
  const example = request.exampleBusiness ?? null;

  const sections = [
    `# Design brief: ${industry}`,
    "",
    `A single-location ${industry} business in a US metro area, being evaluated for one premium, category-specific candidate website.`,
    "",
  ];

  if (example) {
    const available = [
      "business name",
      "industry",
      example.city || example.region ? "city or region" : null,
      example.hasPhone ? "phone" : null,
      example.hasAddress ? "street address" : null,
      example.hasRating ? "public rating and review count" : null,
      example.hasHours ? "opening hours" : null,
    ].filter((value): value is string => Boolean(value));
    const missing = [
      example.hasPhone ? null : "phone",
      example.hasAddress ? null : "street address",
      example.hasRating ? null : "public rating",
      example.hasHours ? null : "opening hours",
    ].filter((value): value is string => Boolean(value));

    sections.push(
      "## Facts available for this job",
      "",
      `- Business: ${example.name}`,
      `- Location: ${example.city ?? example.region ?? "not sourced"}`,
      `- Facts available: ${available.join(", ") || "name and industry only"}`,
      `- Facts NOT available: ${missing.length ? missing.join(", ") : "none"}`,
      "",
      "Design so the facts marked unavailable above are simply absent -- never implied, never invented.",
      "",
    );
  }

  sections.push(
    "## Establish before coding",
    "",
    "Before writing any markup, decide -- and briefly record in workspace/report.json's visualNotes:",
    "",
    "- this business's personality and target customer",
    "- the primary conversion goal for this category",
    "- a visual personality specific to THIS category (a landscaper should not look like an accountant; a restaurant should not look like an HVAC company)",
    "- typography strategy, color strategy, imagery strategy",
    "- hero concept, section hierarchy and rhythm, CTA hierarchy",
    "- a mobile-specific strategy, not a shrunk desktop layout",
    "- how trust will be presented without any fabricated claim",
    "- one distinctive visual moment the page is built around",
    "",
    "This brief only carries this job's category and known/unknown facts. Full design direction -- visual principles, anti-generic rules, imagery provenance, factual-claim limits, Google Maps handling, and local SEO requirements -- is in your system prompt, not here.",
    "",
  );

  return { industry, markdown: sections.join("\n") };
}
