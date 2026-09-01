import type { InspectionResult, NormalizedBusiness } from "./types";

/**
 * Deterministic contactability model. Every channel here is either data a
 * discovery source explicitly and directly provided, or something Scout's
 * own website inspection directly observed (a real tel:/mailto: link or
 * <form> on the page) -- never a guessed address (firstname@domain,
 * info@domain) and never a social match inferred from name similarity.
 */
export const CONTACT_CHANNEL_TYPES = ["phone", "email", "instagram", "facebook", "contact_form"] as const;
export type ContactChannelType = (typeof CONTACT_CHANNEL_TYPES)[number];

export type ContactChannel = {
  type: ContactChannelType;
  value: string;
  source: string;
};

export type ContactabilityAssessment = {
  channels: ContactChannel[];
  score: number;
  verified: boolean;
};

const CHANNEL_POINTS: Record<ContactChannelType, number> = {
  phone: 35,
  contact_form: 25,
  email: 25,
  instagram: 10,
  facebook: 10,
};

export function assessContactability(business: NormalizedBusiness, inspection: InspectionResult): ContactabilityAssessment {
  const channels: ContactChannel[] = [];

  if (business.phone) {
    channels.push({ type: "phone", value: business.phone, source: `discovery:${business.source}` });
  } else if (inspection.homepage?.hasPhoneLink) {
    channels.push({ type: "phone", value: "tel: link found on the business's own website", source: "website_inspection" });
  }

  if (business.email) {
    channels.push({ type: "email", value: business.email, source: `discovery:${business.source}` });
  } else if (inspection.homepage?.hasMailto) {
    channels.push({ type: "email", value: "mailto: link found on the business's own website", source: "website_inspection" });
  }

  if (business.instagramUrl) {
    channels.push({ type: "instagram", value: business.instagramUrl, source: `discovery:${business.source}` });
  }
  if (business.facebookUrl) {
    channels.push({ type: "facebook", value: business.facebookUrl, source: `discovery:${business.source}` });
  }
  if (inspection.homepage?.hasForm) {
    channels.push({ type: "contact_form", value: "contact form found on the business's own website", source: "website_inspection" });
  }

  const score = Math.max(
    0,
    Math.min(100, channels.reduce((sum, channel) => sum + CHANNEL_POINTS[channel.type], 0)),
  );
  return { channels, score, verified: channels.length > 0 };
}
