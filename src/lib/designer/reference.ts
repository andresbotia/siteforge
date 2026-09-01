/**
 * Reference-driven design architecture for the Designer Worker.
 *
 * V1 implements exactly one reference kind: `gold_standard`, a single
 * hardcoded, principles-only reference derived from the human-approved
 * Antojitos Lovable source (see HANDOFF.md's M9.5D Antojitos import
 * checkpoint for provenance, and prompt.ts's APPROVED VISUAL PRINCIPLES
 * section for the actual generalized text). The Designer Worker never reads
 * Antojitos's real source files or business content -- its filesystem
 * access is confined to its own job workspace -- so "reference" here means
 * curated prose principles reaching the prompt, not raw file access.
 *
 * This module exists to name the seam for future reference kinds without
 * building them now, per the instruction to build only the architecture
 * required to support them later:
 *   - approved_master: a human-approved prior Designer output, promoted via
 *     promoteDesignerJobToMaster() (src/data/designer.ts), later reused as a
 *     reference for adaptations in the same category.
 *   - category_reference: a second gold-standard scoped to one business
 *     category (e.g. a professional-services reference distinct from
 *     Antojitos's restaurant lens), added only after a human approves it.
 *   - prior_revision: the same job's own earlier attempt. Already handled
 *     structurally by the revision loop (visual_review_required -> queued in
 *     state-machine.ts, revisionNotes in prompt.ts) rather than through this
 *     resolver, since it is workspace-local, not a shared reference asset.
 *
 * Do not add new reference content here without a human first reviewing and
 * approving it the way Antojitos was approved -- this resolver is not a
 * place for an agent to author its own "gold standard."
 */
export const DESIGNER_REFERENCE_KINDS = ["gold_standard", "approved_master", "category_reference", "prior_revision"] as const;
export type DesignerReferenceKind = (typeof DESIGNER_REFERENCE_KINDS)[number];

export type DesignerReference = {
  kind: DesignerReferenceKind;
  label: string;
};

/**
 * Resolves which reference informs a job's prompt. V1 always resolves to
 * the single approved gold-standard reference regardless of category or
 * job history; category_reference/approved_master selection is
 * intentionally not implemented until a human has approved at least one
 * master or category reference for this resolver to choose between.
 */
export function resolveDesignerReference(): DesignerReference {
  return {
    kind: "gold_standard",
    label: "Approved commercial-design principles reference (generalized from the Antojitos Lovable source; see APPROVED VISUAL PRINCIPLES in your system prompt)",
  };
}
