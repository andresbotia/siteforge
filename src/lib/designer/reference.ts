import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reference-driven design architecture for the Designer Worker.
 *
 * Four reference kinds:
 *   - gold_standard: a single hardcoded, principles-only reference derived
 *     from the human-approved Antojitos Lovable source (see HANDOFF.md's
 *     M9.5D Antojitos import checkpoint for provenance). Its content lives
 *     in the static DESIGNER_WORKER_SYSTEM_PROMPT's APPROVED VISUAL
 *     PRINCIPLES section (prompt.ts), not as a DESIGN.md file -- it
 *     predates this contract and was approved narratively.
 *   - category_reference: a SiteForge-authored DESIGN.md scoped to one
 *     business category, source-controlled next to a metadata.json that
 *     records its approval state. See CATEGORY_REFERENCE_SLUGS below and
 *     src/lib/designer/references/<slug>/.
 *   - approved_master: a human-approved prior Designer output, promoted via
 *     promoteDesignerJobToMaster() (src/data/designer.ts). Materializing an
 *     actual DESIGN.md/metadata.json package for a promoted job is DEFERRED
 *     -- see DesignerMasterPackageMetadata below -- so this kind currently
 *     never resolves to real content. Not implemented is not the same as
 *     silently faked: resolveDesignerReference() simply never selects it.
 *   - prior_revision: the same job's own earlier attempt. Handled
 *     separately by the revision loop (visual_review_required -> queued in
 *     state-machine.ts, revisionNotes in prompt.ts), not by this resolver,
 *     since it is workspace-local, not a shared reference asset.
 *
 * The Designer Worker never reads Antojitos's or another business's real
 * source files -- its filesystem access is confined to its own job
 * workspace -- so "reference" always means curated prose/markdown reaching
 * the prompt from a trusted SiteForge-controlled source, never raw file
 * access to someone else's project.
 */
export const DESIGNER_REFERENCE_KINDS = ["gold_standard", "approved_master", "category_reference", "prior_revision"] as const;
export type DesignerReferenceKind = (typeof DESIGNER_REFERENCE_KINDS)[number];

export type DesignerReferenceApproval = {
  reviewedBy: string;
  approvedAt: string;
};

/**
 * DESIGN.md contract: a bounded, SiteForge-authored statement of design
 * PRINCIPLES an approved reference may carry into a Designer Job's prompt.
 * It describes intent, hierarchy, typography/color roles, rhythm,
 * composition, imagery strategy, CTA architecture, component treatment,
 * responsiveness, and anti-patterns -- never a rigid section schema, and
 * NEVER business data. See prompt.ts's "DESIGN REFERENCE VS. VERIFIED
 * BUSINESS FACTS" section for the rule the worker itself follows, and
 * security.ts's fenceDesignReference() for how it is wrapped before
 * reaching the model.
 */
export type DesignerReference = {
  kind: DesignerReferenceKind;
  id: string;
  title: string;
  category: string | null;
  /** Human-readable one-liner, safe to drop straight into the prompt. */
  label: string;
  designMarkdown: string | null;
  approval: DesignerReferenceApproval | null;
};

export const DESIGN_MARKDOWN_MAX_CHARS = 6_000;

/** Bounds DESIGN.md content before it can reach a prompt. Never send an unbounded reference. */
export function boundDesignMarkdown(markdown: string): string {
  const trimmed = markdown.trim();
  if (trimmed.length <= DESIGN_MARKDOWN_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, DESIGN_MARKDOWN_MAX_CHARS)}\n\n...[truncated -- DESIGN.md exceeded the ${DESIGN_MARKDOWN_MAX_CHARS}-character bound]`;
}

const GOLD_STANDARD_REFERENCE: DesignerReference = {
  kind: "gold_standard",
  id: "gold-standard-v1",
  title: "Approved commercial-design principles (generalized from Antojitos)",
  category: null,
  label: "Approved commercial-design principles reference (generalized from the Antojitos Lovable source; see APPROVED VISUAL PRINCIPLES in your system prompt)",
  designMarkdown: null,
  approval: null,
};

/**
 * Curated, SiteForge-authored category references. Each entry's DESIGN.md
 * lives on disk next to a metadata.json recording its approval state -- see
 * src/lib/designer/references/<slug>/. Filesystem + git are the approval
 * record for this kind of curated, source-controlled content: a human
 * "approves" one by editing approvalStatus and committing the change, which
 * is itself an auditable review record. No database migration was added or
 * is needed for this.
 *
 * IMPORTANT: an entry existing in this table does NOT mean it is live. Only
 * approvalStatus === "approved" in its metadata.json makes
 * resolveDesignerReference() select it -- an agent authoring a new
 * DESIGN.md (as this session did for professional-services-editorial)
 * cannot make it a live reference on its own. AI cannot approve or promote
 * its own design.
 */
const CATEGORY_REFERENCE_SLUGS: Record<string, string> = {
  professional_services: "professional-services-editorial",
};

type CategoryReferenceMetadata = {
  id: string;
  title: string;
  category: string;
  approvalStatus: "pending_human_review" | "approved" | "rejected";
  reviewedBy: string | null;
  approvedAt: string | null;
};

const categoryReferenceCache = new Map<string, DesignerReference | null>();

const DEFAULT_REFERENCES_DIR = join(process.cwd(), "src", "lib", "designer", "references");

function loadCategoryReference(categoryKey: string): DesignerReference | null {
  const slug = CATEGORY_REFERENCE_SLUGS[categoryKey];
  if (!slug) return null;
  if (categoryReferenceCache.has(slug)) return categoryReferenceCache.get(slug) ?? null;

  const resolved = readCategoryReferenceFromDisk(slug, DEFAULT_REFERENCES_DIR);
  categoryReferenceCache.set(slug, resolved);
  return resolved;
}

/**
 * Exported so tests can point at a scratch directory (a controlled
 * metadata.json/DESIGN.md pair) without touching or temporarily mutating
 * the real, currently-pending-review professional-services-editorial
 * files. Production code always calls this through loadCategoryReference()
 * with DEFAULT_REFERENCES_DIR; this function itself has no cache.
 */
export function readCategoryReferenceFromDisk(slug: string, referencesDir: string = DEFAULT_REFERENCES_DIR): DesignerReference | null {
  try {
    const dir = join(referencesDir, slug);
    const metadata = JSON.parse(readFileSync(join(dir, "metadata.json"), "utf8")) as CategoryReferenceMetadata;
    if (metadata.approvalStatus !== "approved") return null;
    const markdown = readFileSync(join(dir, "DESIGN.md"), "utf8");
    return {
      kind: "category_reference",
      id: metadata.id,
      title: metadata.title,
      category: metadata.category,
      label: `Category reference: ${metadata.title} (SiteForge-authored, human-approved; see DESIGN REFERENCE in your prompt)`,
      designMarkdown: boundDesignMarkdown(markdown),
      approval: metadata.reviewedBy && metadata.approvedAt ? { reviewedBy: metadata.reviewedBy, approvedAt: metadata.approvedAt } : null,
    };
  } catch {
    // Missing/unreadable/malformed metadata never breaks a Designer job --
    // it just means no category reference is available; gold_standard is
    // always a safe fallback.
    return null;
  }
}

/**
 * Resolves which reference informs a job's prompt. Prefers an approved
 * category_reference for the job's category when one has been explicitly
 * approved; otherwise falls back to the single gold-standard reference --
 * the same fallback behavior this resolver always had. As of this session
 * zero category references are approved, so real job behavior is
 * unchanged until a human flips one to "approved".
 */
export function resolveDesignerReference(input?: { category?: string | null }): DesignerReference {
  const category = input?.category ?? null;
  if (category) {
    const categoryReference = loadCategoryReference(category);
    if (categoryReference) return categoryReference;
  }
  return GOLD_STANDARD_REFERENCE;
}

export function fingerprintDesignMarkdown(markdown: string): string {
  return createHash("sha256").update(markdown.trim()).digest("hex");
}

/**
 * Future approved-master package contract. NOT implemented this session --
 * promotion (src/data/designer.ts's promoteDesignerJobToMaster) still only
 * sets designer_jobs.promoted_to_master/master_template_key; it does not
 * yet materialize any of these files, and resolveDesignerReference() has no
 * approved_master code path. Defined here so a later session has an exact
 * target shape (and can extend this same module) rather than inventing one
 * ad hoc. A fixture job can never reach this shape: promoteDesignerJobToMaster
 * already rejects any job with is_fixture === true before promotion.
 */
export const DESIGNER_MASTERS_DIR = ".siteforge/designer-masters";

export type DesignerMasterPackageMetadata = {
  masterId: string;
  title: string;
  category: string;
  sourceDesignerJobId: string;
  reviewedBy: string;
  approvedAt: string;
  designMarkdownFingerprint: string;
  sourceFingerprint: string;
  screenshots: { desktop: string | null; mobile: string | null } | null;
};
