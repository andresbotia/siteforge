/**
 * Deterministic template QA.
 *
 * Runs over a composed `WebsiteSpec` before a human review and answers: would
 * this draft embarrass us in front of a prospect, and does it claim anything we
 * cannot source? No network, no paid AI, no rendering. Safe for a bot to run on
 * every draft.
 *
 * QA reports; it does not mutate drafts or gate approvals on its own.
 */

import { contrastPairs, contrastRatio, DESIGN_PRESETS } from "./design-system";
import { canRenderImage } from "./images";
import { TEMPLATE_REGISTRY, type TemplateDefinition } from "./registry";
import type { Section, SiteCta, WebsiteSpec } from "./types";

export type QaSeverity = "blocker" | "warning" | "note";

export type QaFinding = {
  code: string;
  severity: QaSeverity;
  message: string;
  /** Where the reviewer should look. */
  location: string;
};

export type TemplateQaReport = {
  template: string;
  templateId: string;
  passed: boolean;
  blockers: number;
  warnings: number;
  findings: QaFinding[];
};

/**
 * Marketing language that asserts something we have not sourced. Deterministic
 * copy should never produce these; the check exists so operator edits and any
 * future generated copy cannot smuggle unsupported claims into a prospect site.
 */
const UNSUPPORTED_CLAIM_PATTERNS: Array<[code: string, pattern: RegExp, label: string]> = [
  ["claim_superlative", /\b(#1|number one|best in (?:town|the area|the state)|top[- ]rated)\b/i, "unverifiable ranking claim"],
  ["claim_experience", /\b(?:over|more than)\s+\d+\+?\s+years?\b/i, "years-in-business claim"],
  ["claim_volume", /\b\d[\d,]{2,}\+?\s+(?:customers|clients|jobs|projects|homes)\b/i, "customer-volume claim"],
  ["claim_award", /\b(award[- ]winning|voted best|certified best|nationally recognized)\b/i, "award claim"],
  ["claim_guarantee", /\b(?:100%\s+)?(?:satisfaction\s+)?guarantee(?:d)?\b/i, "guarantee claim"],
  ["claim_price", /\$\s?\d/, "price claim"],
  ["claim_licensing", /\b(licensed and insured|fully insured|bonded)\b/i, "licensing or insurance claim"],
  ["claim_free", /\bfree estimates?\b/i, "free-estimate offer"],
];

/** Internal vocabulary that must never reach prospect-facing copy. */
const INTERNAL_LEAK_PATTERNS: Array<[code: string, pattern: RegExp, label: string]> = [
  ["leak_internal_term", /\b(siteforge|lovable|placeholder|lorem ipsum|todo|tbd|draft only)\b/i, "internal or placeholder term"],
  ["leak_audit_language", /\b(redesign opportunity|audit score|prospect|outreach)\b/i, "internal funnel language"],
];

export function runTemplateQa(spec: WebsiteSpec): TemplateQaReport {
  const definition: TemplateDefinition | undefined = TEMPLATE_REGISTRY[spec.template];
  const findings: QaFinding[] = [];

  if (!definition) {
    return {
      template: spec.template,
      templateId: "unknown",
      passed: false,
      blockers: 1,
      warnings: 0,
      findings: [
        {
          code: "unknown_template",
          severity: "blocker",
          message: `Template "${spec.template}" is not in the registry.`,
          location: "spec.template",
        },
      ],
    };
  }

  findings.push(...checkTemplateStatus(definition));
  findings.push(...checkRequiredFacts(spec, definition));
  findings.push(...checkStructure(spec));
  findings.push(...checkCopy(spec));
  findings.push(...checkLinks(spec));
  findings.push(...checkImages(spec, definition));
  findings.push(...checkConversionPaths(spec, definition));
  findings.push(...checkContrast(definition));

  const blockers = findings.filter((finding) => finding.severity === "blocker").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;

  return {
    template: definition.label,
    templateId: definition.id,
    passed: blockers === 0,
    blockers,
    warnings,
    findings,
  };
}

function checkTemplateStatus(definition: TemplateDefinition): QaFinding[] {
  if (definition.status === "deprecated") {
    return [
      {
        code: "deprecated_template",
        severity: "warning",
        message: `${definition.label} is deprecated. Rebuild on an active template before outreach.`,
        location: "registry",
      },
    ];
  }
  return [];
}

function checkRequiredFacts(spec: WebsiteSpec, definition: TemplateDefinition): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const fact of definition.requiredFacts) {
    const value = (spec.business as Record<string, unknown>)[fact];
    const missing =
      value === null || value === undefined || (typeof value === "string" && value.trim() === "");
    if (missing) {
      findings.push({
        code: "missing_required_fact",
        severity: "blocker",
        message: `${definition.label} requires "${fact}" and the draft has no sourced value.`,
        location: `business.${fact}`,
      });
    }
  }
  return findings;
}

function checkStructure(spec: WebsiteSpec): QaFinding[] {
  const findings: QaFinding[] = [];
  const home = spec.pages.find((page) => page.id === "home");
  if (!home) {
    findings.push({
      code: "missing_home_page",
      severity: "blocker",
      message: "The draft has no home page.",
      location: "pages",
    });
    return findings;
  }

  const types = new Set(home.sections.map((section) => section.type));
  for (const required of ["header", "hero", "footer"] as const) {
    if (!types.has(required)) {
      findings.push({
        code: `missing_${required}`,
        severity: "blocker",
        message: `Home page has no ${required} section.`,
        location: "pages.home.sections",
      });
    }
  }

  for (const page of spec.pages) {
    const contentSections = page.sections.filter(
      (section) => section.type !== "header" && section.type !== "footer" && section.type !== "announcement",
    );
    if (contentSections.length === 0) {
      findings.push({
        code: "empty_page",
        severity: "blocker",
        message: `Page "${page.id}" has chrome but no content. Omit the page instead of shipping an empty one.`,
        location: `pages.${page.id}`,
      });
    }
    if (!page.title.trim() || !page.description.trim()) {
      findings.push({
        code: "missing_page_metadata",
        severity: "warning",
        message: `Page "${page.id}" is missing an SEO title or description.`,
        location: `pages.${page.id}`,
      });
    }
    const navTargets = new Set(spec.navigation.map((item) => item.id));
    if (!navTargets.has(page.id)) {
      findings.push({
        code: "unreachable_page",
        severity: "warning",
        message: `Page "${page.id}" is not in the navigation and cannot be reached.`,
        location: "navigation",
      });
    }
  }

  for (const item of spec.navigation) {
    if (!spec.pages.some((page) => page.id === item.id)) {
      findings.push({
        code: "broken_nav_target",
        severity: "blocker",
        message: `Navigation links to "${item.id}", which has no page.`,
        location: "navigation",
      });
    }
  }

  return findings;
}

function checkCopy(spec: WebsiteSpec): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const { text, location } of copyStrings(spec)) {
    for (const [code, pattern, label] of UNSUPPORTED_CLAIM_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({
          code,
          severity: "blocker",
          message: `Copy contains an ${label} we cannot source: "${truncate(text)}".`,
          location,
        });
      }
    }
    for (const [code, pattern, label] of INTERNAL_LEAK_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({
          code,
          severity: "blocker",
          message: `Copy leaks an ${label}: "${truncate(text)}".`,
          location,
        });
      }
    }
  }
  return findings;
}

function checkLinks(spec: WebsiteSpec): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const { cta, location } of allCtas(spec)) {
    const href = cta.href.trim();
    if (!href) {
      findings.push({
        code: "empty_cta_href",
        severity: "blocker",
        message: `CTA "${cta.label}" has no destination.`,
        location,
      });
      continue;
    }
    if (/^javascript:/i.test(href) || /^data:/i.test(href) || /^vbscript:/i.test(href)) {
      findings.push({
        code: "unsafe_cta_href",
        severity: "blocker",
        message: `CTA "${cta.label}" uses an unsafe scheme.`,
        location,
      });
      continue;
    }
    const internal = href.startsWith("/") && !href.startsWith("//");
    if (internal) {
      const target = href.slice(1) || "home";
      if (!spec.pages.some((page) => page.id === target)) {
        findings.push({
          code: "broken_cta_target",
          severity: "blocker",
          message: `CTA "${cta.label}" points at "${href}", which is not a page in this draft.`,
          location,
        });
      }
      continue;
    }
    if (!/^(https?:|tel:|mailto:)/i.test(href)) {
      findings.push({
        code: "unsupported_cta_scheme",
        severity: "blocker",
        message: `CTA "${cta.label}" uses an unsupported destination.`,
        location,
      });
    }
  }
  return findings;
}

function checkImages(spec: WebsiteSpec, definition: TemplateDefinition): QaFinding[] {
  const findings: QaFinding[] = [];
  const images = spec.assets?.images ?? [];

  for (const [index, image] of images.entries()) {
    const location = `assets.images[${index}]`;
    if (!canRenderImage(image)) {
      findings.push({
        code: "unrenderable_image",
        severity: "blocker",
        message: "Image is not approved, not rights-approved, or not an allowlisted local asset.",
        location,
      });
      continue;
    }
    if (!image.alt.trim()) {
      findings.push({
        code: "missing_alt_text",
        severity: "blocker",
        message: "Image has no alt text.",
        location,
      });
    }
    if (!definition.imageRoles.includes(image.role)) {
      findings.push({
        code: "unsupported_image_role",
        severity: "warning",
        message: `${definition.label} has no designed slot for the "${image.role}" role; the image will not render.`,
        location,
      });
    }
    if (image.sourceType === "template_illustrative" && !/illustration|illustrative/i.test(image.alt)) {
      findings.push({
        code: "illustrative_image_alt",
        severity: "warning",
        message:
          "Template illustration should read as illustrative in its alt text so it is not mistaken for a photo of this business.",
        location,
      });
    }
  }

  if (!images.some((image) => image.role === "hero")) {
    findings.push({
      code: "no_hero_image",
      severity: "note",
      message:
        "No approved hero image. The designed CSS hero ground will render, but a real photo converts better; ask the operator or business for one.",
      location: "assets.images",
    });
  }

  return findings;
}

function checkConversionPaths(spec: WebsiteSpec, definition: TemplateDefinition): QaFinding[] {
  const findings: QaFinding[] = [];
  const ctas = allCtas(spec).map((entry) => entry.cta);

  if (ctas.length === 0) {
    findings.push({
      code: "no_cta",
      severity: "blocker",
      message: "The draft has no call to action. A prospect site with no conversion path is not worth sending.",
      location: "pages",
    });
  }

  for (const cta of ctas) {
    if (!definition.ctaCapabilities.includes(cta.kind)) {
      findings.push({
        code: "unsupported_cta_kind",
        severity: "warning",
        message: `${definition.label} does not declare support for "${cta.kind}" CTAs.`,
        location: "registry.ctaCapabilities",
      });
    }
  }

  const hasContactPath =
    Boolean(spec.business.phone) ||
    Boolean(spec.business.email) ||
    ctas.some((cta) => cta.href.startsWith("tel:") || cta.href.startsWith("mailto:"));
  if (!hasContactPath) {
    findings.push({
      code: "no_contact_path",
      severity: "blocker",
      message: "No sourced phone or email. A visitor cannot reach this business from the site.",
      location: "business",
    });
  }

  const home = spec.pages.find((page) => page.id === "home");
  const heroCtas = home?.sections.find((section) => section.type === "hero");
  if (heroCtas?.type === "hero" && heroCtas.ctas.length === 0) {
    findings.push({
      code: "hero_without_cta",
      severity: "warning",
      message: "The hero has no call to action, which is the highest-converting position on the page.",
      location: "pages.home.hero",
    });
  }

  return findings;
}

function checkContrast(definition: TemplateDefinition): QaFinding[] {
  const preset = DESIGN_PRESETS[definition.designPreset];
  const findings: QaFinding[] = [];
  for (const pair of contrastPairs(preset)) {
    const ratio = contrastRatio(pair.foreground, pair.background);
    if (ratio === null) {
      findings.push({
        code: "uncheckable_contrast",
        severity: "warning",
        message: `Could not compute contrast for ${pair.label}; preset colors must be 6-digit hex.`,
        location: `preset.${preset.key}`,
      });
      continue;
    }
    if (ratio < pair.minimum) {
      findings.push({
        code: "insufficient_contrast",
        severity: "blocker",
        message: `Preset "${preset.key}" fails contrast for ${pair.label}: ${ratio.toFixed(2)}:1 against a ${pair.minimum}:1 minimum.`,
        location: `preset.${preset.key}`,
      });
    }
  }
  return findings;
}

function copyStrings(spec: WebsiteSpec): Array<{ text: string; location: string }> {
  const entries: Array<{ text: string; location: string }> = [];
  const push = (value: string | null | undefined, location: string) => {
    if (typeof value === "string" && value.trim()) entries.push({ text: value, location });
  };

  push(spec.seo.title, "seo.title");
  push(spec.seo.description, "seo.description");
  push(spec.business.description, "business.description");
  for (const highlight of spec.business.highlights ?? []) push(highlight, "business.highlights");

  for (const page of spec.pages) {
    push(page.title, `pages.${page.id}.title`);
    push(page.description, `pages.${page.id}.description`);
    for (const section of page.sections) {
      const location = `pages.${page.id}.${section.type}`;
      for (const text of sectionCopy(section)) push(text, location);
    }
  }
  return entries;
}

function sectionCopy(section: Section): string[] {
  switch (section.type) {
    case "announcement":
      return [section.text];
    case "hero":
      return [section.eyebrow ?? "", section.headline, section.lede, ...section.ctas.map((cta) => cta.label)];
    case "trust":
      return [section.note ?? ""];
    case "services":
      return [section.heading, ...section.items.flatMap((item) => [item.name, item.summary])];
    case "about":
    case "serviceArea":
      return [section.heading, section.body];
    case "menuPreview":
      return [section.heading, section.body, section.label ?? ""];
    case "hoursLocation":
      return [section.heading, section.location ?? "", section.hours ?? ""];
    case "cta":
      return [section.heading, section.body, ...section.ctas.map((cta) => cta.label)];
    case "contact":
      return [section.heading];
    case "header":
      return section.ctas.map((cta) => cta.label);
    case "footer":
      return [section.note];
    default:
      return [];
  }
}

function allCtas(spec: WebsiteSpec): Array<{ cta: SiteCta; location: string }> {
  const entries: Array<{ cta: SiteCta; location: string }> = [];
  for (const page of spec.pages) {
    for (const section of page.sections) {
      if (section.type === "hero" || section.type === "cta" || section.type === "header") {
        for (const cta of section.ctas) {
          entries.push({ cta, location: `pages.${page.id}.${section.type}` });
        }
      }
    }
  }
  return entries;
}

function truncate(value: string): string {
  return value.length > 80 ? `${value.slice(0, 77)}...` : value;
}
