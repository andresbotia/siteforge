import { normalizeBusinessName, normalizeDomain, normalizePhone } from "./normalize";
import { leadPipelineRank } from "./status";
import type { ExistingLeadRecord, NormalizedBusiness, PersistDecision } from "./types";

export function findDuplicate(
  business: NormalizedBusiness,
  existing: ExistingLeadRecord[],
): ExistingLeadRecord | null {
  const domain = business.normalizedDomain;
  const phone = business.normalizedPhone;
  const name = business.normalizedName;

  if (domain) {
    const byDomain = existing.find((lead) => {
      const leadDomain = lead.normalizedDomain ?? normalizeDomain(lead.websiteUrl);
      return leadDomain && leadDomain === domain;
    });
    if (byDomain) return byDomain;
  }

  if (phone) {
    const byPhone = existing.find((lead) => {
      const leadPhone = lead.normalizedPhone ?? normalizePhone(lead.phone);
      return leadPhone && leadPhone === phone;
    });
    if (byPhone) return byPhone;
  }

  const byName = existing.find((lead) => {
    const leadName = normalizeBusinessName(lead.businessName);
    const city = (lead.city ?? "").trim().toLowerCase();
    return leadName === name && (!city || city === business.city.trim().toLowerCase());
  });
  return byName ?? null;
}

export function decidePersistence(
  business: NormalizedBusiness,
  existing: ExistingLeadRecord[],
): PersistDecision {
  const match = findDuplicate(business, existing);
  if (!match) {
    return { action: "insert", reason: "no_existing_match" };
  }
  const rank = leadPipelineRank(match.status);
  return {
    action: "update",
    existingId: match.id,
    reason:
      rank !== null && rank >= 1
        ? "enrich_without_status_regression"
        : "update_existing_lead",
  };
}
