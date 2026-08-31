import type {
  ManualPublicProspectInput,
  ManualPublicProspectValidation,
} from "./manual-public";

export type ManualPublicProspectFormState = {
  ok: boolean;
  error?: string;
  values?: ManualPublicProspectInput;
  fieldErrors?: Partial<Record<keyof ManualPublicProspectInput, string>>;
};

export function readManualPublicProspectFormValues(formData: FormData): ManualPublicProspectInput {
  return {
    businessName: String(formData.get("businessName") ?? ""),
    websiteUrl: String(formData.get("websiteUrl") ?? ""),
    location: String(formData.get("location") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    noStandaloneWebsite: formData.get("noStandaloneWebsite") === "on",
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    sourceNote: String(formData.get("sourceNote") ?? ""),
  };
}

export function buildManualPublicProspectFailureState(
  result: Extract<ManualPublicProspectValidation, { ok: false }>,
  values: ManualPublicProspectInput,
): ManualPublicProspectFormState {
  return {
    ok: false,
    error: result.error,
    values,
    fieldErrors: result.field ? { [result.field]: result.error } : undefined,
  };
}
