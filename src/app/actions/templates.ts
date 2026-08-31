"use server";

import { requireAdminSession } from "@/lib/auth/guard";
import { buildDesignBrief } from "@/lib/builder/design-brief";

export type DesignBriefActionState =
  | {
      ok: true;
      industry: string;
      newTemplateNeeded: boolean;
      suggestedTemplateKey: string;
      selectionReason: string;
      markdown: string;
    }
  | { ok: false; error: string }
  | null;

/**
 * Generate a provider-neutral master-template brief.
 *
 * This is a pure local text transformation: no network call, no paid AI, no
 * design-tool invocation, and no database write. It produces a brief an
 * operator can hand to a designer or design tool themselves.
 */
export async function generateDesignBriefAction(
  _prev: DesignBriefActionState,
  formData: FormData,
): Promise<DesignBriefActionState> {
  await requireAdminSession();

  const industry = String(formData.get("industry") ?? "").trim();
  if (!industry) return { ok: false, error: "Enter an industry." };
  if (industry.length > 80) return { ok: false, error: "Industry must be 80 characters or fewer." };

  const objectiveRaw = String(formData.get("conversionObjective") ?? "").trim();
  if (objectiveRaw.length > 300) {
    return { ok: false, error: "Conversion objective must be 300 characters or fewer." };
  }

  const brief = buildDesignBrief({
    industry,
    conversionObjective: objectiveRaw || undefined,
  });

  return {
    ok: true,
    industry: brief.industry,
    newTemplateNeeded: brief.newTemplateNeeded,
    suggestedTemplateKey: brief.suggestedTemplateKey,
    selectionReason: brief.selectionReason,
    markdown: brief.markdown,
  };
}
