"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importExternalGeneratedSite, requestExternalPreviewDeployment } from "@/data/external-sites";
import { asRecord } from "@/lib/json";

export type ExternalSiteImportActionState =
  | { ok: boolean; error?: string; field?: string }
  | null;

export async function importExternalGeneratedSiteAction(
  _prev: ExternalSiteImportActionState,
  formData: FormData,
): Promise<ExternalSiteImportActionState> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const manifestText = String(formData.get("manifest") ?? "").trim();
  const archive = formData.get("archive");
  if (!leadId) return { ok: false, error: "Choose a lead.", field: "leadId" };
  const archiveFile = archive instanceof File && archive.size > 0 ? archive : null;
  if (!archiveFile && !manifestText) return { ok: false, error: "Upload a ZIP archive or paste a JSON source manifest.", field: "archive" };

  let manifest: Record<string, unknown> | null = null;
  let files: Array<{ path: string; content: string }> = [];
  if (!archiveFile) {
    try {
      manifest = asRecord(JSON.parse(manifestText));
    } catch {
      return { ok: false, error: "Manifest must be valid JSON.", field: "manifest" };
    }

    files = Array.isArray(manifest.files)
      ? manifest.files.flatMap((item) => {
          const row = asRecord(item);
          if (typeof row.path !== "string" || typeof row.content !== "string") return [];
          return [{ path: row.path, content: row.content }];
        })
      : [];
  }

  const result = await importExternalGeneratedSite({
    leadId,
    provider,
    providerProjectId: stringValue(formData.get("providerProjectId")),
    providerCommitSha: stringValue(formData.get("providerCommitSha")),
    providerPreviewUrl: stringValue(formData.get("providerPreviewUrl")),
    generationCostCredits: stringValue(formData.get("generationCostCredits")),
    generationCostUsdEstimate: stringValue(formData.get("generationCostUsdEstimate")),
    providerCostNotes: stringValue(formData.get("providerCostNotes")),
    archive: archiveFile
      ? {
          fileName: archiveFile.name,
          contentType: archiveFile.type,
          bytes: Buffer.from(await archiveFile.arrayBuffer()),
        }
      : undefined,
    manifest: manifest
      ? {
          leadId: typeof manifest.leadId === "string" ? manifest.leadId : undefined,
          packageJson:
            manifest.packageJson && typeof manifest.packageJson === "object" && !Array.isArray(manifest.packageJson)
              ? asRecord(manifest.packageJson)
              : null,
          files,
        }
      : undefined,
  });

  if (!result.ok) return result;
  revalidatePath("/agents/builder");
  revalidatePath("/websites");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/websites/${result.websiteId}`);
  redirect(`/websites/${result.websiteId}`);
}

function stringValue(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function requestExternalPreviewDeploymentAction(
  _prev: ExternalSiteImportActionState,
  formData: FormData,
): Promise<ExternalSiteImportActionState> {
  const websiteId = String(formData.get("websiteId") ?? "").trim();
  if (!websiteId) return { ok: false, error: "Missing website." };
  const result = await requestExternalPreviewDeployment(websiteId);
  if (!result.ok) return result;
  revalidatePath(`/websites/${websiteId}`);
  revalidatePath("/approvals");
  redirect("/approvals");
}
