import { canApproveExternalGeneratedSite } from "@/lib/builder/external-sites";
import { validateWebsiteSpec } from "@/lib/builder/validate";
import type { GeneratedWebsite } from "@/types";

export type PreviewPublicationPolicyResult =
  | { ok: true }
  | { ok: false; error: string };

export function assertPreviewPublicationAllowed(input: {
  site: Pick<GeneratedWebsite, "status" | "spec" | "externalGeneratedSite"> | null;
  hasActiveDeployment: boolean;
  hasPendingApproval: boolean;
}): PreviewPublicationPolicyResult {
  if (!input.site) return { ok: false, error: "Website draft was not found." };
  if (!input.site.spec) {
    return { ok: false, error: "Website draft has no structured spec to publish." };
  }
  const validation = validateWebsiteSpec(input.site.spec);
  if (!validation.ok) {
    return { ok: false, error: `Website spec is not renderable: ${validation.error}.` };
  }
  if (input.site.status === "failed" || input.site.status === "building") {
    return { ok: false, error: "Only completed Builder drafts can be published." };
  }
  const externalPolicy = canApproveExternalGeneratedSite(input.site.externalGeneratedSite);
  if (!externalPolicy.ok) return externalPolicy;
  if (input.hasActiveDeployment) {
    return { ok: false, error: "This website already has an active public preview." };
  }
  if (input.hasPendingApproval) {
    return { ok: false, error: "A preview publication approval is already pending." };
  }
  return { ok: true };
}
