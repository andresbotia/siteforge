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
    improvement = fix.builderAction
      ? `adds ${fix.builderAction.toLowerCase()}`
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
  const subject = `Quick website concept for ${businessName}`;
  evidence.push({
    type: "preview_link",
    text: `Active preview ending ${preview.tokenHint}; outreach link ending ${preview.attributionTokenHint}`,
    source: "preview_deployments",
  });

  const body = [
    `Hi ${businessName} team,`,
    "",
    newWebsiteOpportunity
      ? `I was researching ${lead.industry.toLowerCase()} businesses in ${lead.city} and came across ${businessName}. ${observation}.`
      : `I was researching ${lead.industry.toLowerCase()} businesses in ${lead.city} and came across ${businessName}. While inspecting your current website, ${observation}.`,
    "",
    newWebsiteOpportunity
      ? `To show what a standalone site could look like, we drafted a clean concept that ${improvement}.`
      : `To show what an updated version could look like, we drafted a clean replacement that ${improvement}.`,
    "",
    `You can view the live interactive preview here:`,
    "{{OUTREACH_PREVIEW_LINK}}",
    "",
    `If you like the direction or have any questions about how it works, just reply directly to this email.`,
    "",
    `Best,`,
    `${senderName}`,
    `SiteForge`,
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
