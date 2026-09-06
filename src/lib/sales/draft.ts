import {
  DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS,
  DEFAULT_SETUP_AMOUNT_CENTS,
} from "@/lib/payments/limits";
import { centsToUsd } from "@/lib/payments/money";
import {
  COMMERCIAL_TERMS_HEADING,
  commercialTermsLines,
} from "./commercial-terms";
import { computeOutreachContentHash } from "./content-hash";
import type {
  SalesAuditInput,
  SalesDraft,
  SalesEvidenceItem,
  SalesLeadInput,
  SalesPreviewInput,
  SalesWebsiteInput,
} from "./types";

export type DraftOptions = {
  senderName?: string;
  senderEmail?: string;
  recipientEmailOverride?: string;
};

function money(cents: number): string {
  const usd = centsToUsd(cents);
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

export function composeSalesDraft(
  lead: SalesLeadInput,
  audit: SalesAuditInput,
  website: SalesWebsiteInput,
  preview: SalesPreviewInput,
  options: DraftOptions = {},
): SalesDraft {
  const businessName = lead.businessName.trim();
  const senderName = options.senderName || "Andres Botia";
  const senderEmail = options.senderEmail || "outreach@siteforge.agency";
  const recipientEmail = (options.recipientEmailOverride || lead.email || "").trim();

  const evidence: SalesEvidenceItem[] = [
    {
      type: "business_fact",
      text: `Target business: ${businessName} in ${lead.city}${lead.state ? `, ${lead.state}` : ""} (${lead.industry})`,
      source: "lead_profile",
    },
  ];

  const newWebsiteOpportunity =
    lead.websiteStatus === "no_standalone_website" ||
    audit.opportunityType === "new_website";

  // 1. Determine key audit or website-status observation
  let observation = "";
  if (newWebsiteOpportunity) {
    observation = "I noticed there does not appear to be a standalone website for your business";
    evidence.push({
      type: "website_status",
      text: "Operator-verified no standalone business website",
      source: "lead.inspection_summary",
    });
  } else if (audit.findings && audit.findings.length > 0) {
    const finding = audit.findings[0];
    observation = `I noticed ${finding.title.toLowerCase()}`;
    evidence.push({
      type: "audit_finding",
      text: `Audit finding: ${finding.title} (${finding.code})`,
      source: "website_audit",
    });
  } else if (audit.issues && audit.issues.length > 0) {
    observation = `I noticed ${audit.issues[0].toLowerCase()}`;
    evidence.push({
      type: "audit_finding",
      text: `Audit issue: ${audit.issues[0]}`,
      source: "website_audit",
    });
  } else {
    observation = `I noticed opportunities to improve mobile conversion and service clarity on your current website`;
    evidence.push({
      type: "audit_finding",
      text: "General website audit: modernization & conversion opportunity",
      source: "website_audit",
    });
  }

  // 2. Determine key builder improvement
  let improvement = "";
  const addressedFixes = (website.auditFixes || []).filter((f) => f.addressed);
  if (addressedFixes.length > 0) {
    const fix = addressedFixes[0];
    // builderAction is already written as a verb-first action phrase
    // ("Adds...", "Replaces...", "Embeds..."); prepending another verb here
    // produced a doubled verb ("adds adds...", "adds replaces...").
    improvement = fix.builderAction
      ? fix.builderAction.toLowerCase()
      : "improves mobile navigation and primary call-to-action layout";
    evidence.push({
      type: "builder_fix",
      text: `${newWebsiteOpportunity ? "New website step" : "Redesign fix"}: ${fix.builderAction || fix.findingCode}`,
      source: "builder_spec",
    });
  } else {
    improvement = newWebsiteOpportunity
      ? "creates a standalone mobile-first web presence with clear contact paths"
      : "features a modern mobile-first layout, prominent contact actions, and clean service pages";
    evidence.push({
      type: "builder_fix",
      text: `Template: ${website.template}`,
      source: "builder_spec",
    });
  }

  // 3. Construct Subject & Body
  // Short, lowercase, non-salesy subject (cold-email skill: 2-4 words,
  // internal-looking beats a pitch in the subject line).
  const subject = newWebsiteOpportunity ? "no website found" : "quick site note";
  evidence.push({
    type: "preview_link",
    text: `Active preview ending ${preview.tokenHint}; outreach link ending ${preview.attributionTokenHint}`,
    source: "preview_deployments",
  });

  // M9.9: an operator-supplied example domain. SiteForge performs no
  // availability check anywhere, so the copy must never assert or imply the
  // domain is free -- it is phrased strictly as an example, and the operator
  // is responsible for having checked before entering it.
  const suggestedDomain = (lead.suggestedDomain ?? "").trim();
  if (suggestedDomain) {
    evidence.push({
      type: "business_fact",
      text: `Operator-supplied example domain: ${suggestedDomain} (availability not checked by SiteForge)`,
      source: "leads.suggested_domain",
    });
  }

  // M9.9: pricing is stated from the same locked constants the offer and the
  // Stripe Price IDs use -- never a number invented by the draft.
  evidence.push({
    type: "business_fact",
    text: `Pricing: ${money(DEFAULT_SETUP_AMOUNT_CENTS)} setup, optional ${money(DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS)}/month managed plan`,
    source: "lib/payments/limits",
  });

  // Problem: what the observation actually costs them. Tied to the same
  // evidence branch as the observation itself -- never a decorative detail
  // (cold-email skill: "if your personalization has nothing to do with the
  // problem you solve, it's just an attention hack").
  let costLine = "";
  if (newWebsiteOpportunity) {
    costLine =
      "When someone searches for you and finds nothing, they call the next place instead.";
  } else if (audit.findings && audit.findings.length > 0 && audit.findings[0].category === "seo") {
    costLine = "That usually means fewer people find you when they search nearby.";
  } else {
    costLine =
      "That's the kind of thing that quietly costs you calls or reservations before anyone complains.";
  }

  const body = [
    `Hi ${businessName} team,`,
    "",
    newWebsiteOpportunity
      ? `${observation}. ${costLine}`
      : `Looking at ${businessName}'s website, ${observation}. ${costLine}`,
    "",
    newWebsiteOpportunity
      ? `To show what that could look like, we built a standalone site that ${improvement}.`
      : `To show what that could look like, we built a site that ${improvement}.`,
    "",
    `Here's the live preview -- take a look and let me know what you think, good or bad:`,
    "{{OUTREACH_PREVIEW_LINK}}",
    ...(suggestedDomain
      ? [
          "",
          `A site like this would sit on its own domain — something along the lines of ${suggestedDomain}, just as an example of the kind of address that would suit you. We have not registered or reserved anything, and you would choose the final domain yourself.`,
        ]
      : []),
    "",
    COMMERCIAL_TERMS_HEADING,
    ...commercialTermsLines(businessName),
    "",
    `No pressure either way -- just reply and let me know what you think.`,
    "",
    `Best,`,
    `${senderName}`,
    `SiteForge`,
    "",
    `If you would prefer not to hear from us, reply with "unsubscribe" and we will not contact you again.`,
  ].join("\n");

  const contentHash = computeOutreachContentHash({
    subject,
    body,
    recipient: recipientEmail,
    previewDeploymentId: preview.id,
    attributionTokenHash: preview.attributionTokenHash,
  });

  return {
    subject,
    body,
    recipientEmail,
    senderName,
    senderEmail,
    contentHash,
    attributionTokenHash: preview.attributionTokenHash,
    attributionTokenHint: preview.attributionTokenHint,
    evidence,
  };
}
