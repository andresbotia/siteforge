/**
 * Visual QA fixtures for the shared local-business renderer.
 *
 * These run the real Builder pipeline over fictional leads, so what an operator
 * reviews is exactly what Builder produces rather than a hand-tuned mockup. The
 * businesses are invented for QA only and must never enter the lead pipeline.
 */

import { runBuilderPipeline } from "./run";
import type { BuilderAuditInput, BuilderLeadInput, WebsiteSpec } from "./types";

export const VISUAL_QA_VARIANTS = [
  "home-services",
  "home-services-minimal",
  "professional",
  "professional-minimal",
] as const;

export type VisualQaVariant = (typeof VISUAL_QA_VARIANTS)[number];

export function isVisualQaVariant(value: string): value is VisualQaVariant {
  return (VISUAL_QA_VARIANTS as readonly string[]).includes(value);
}

const EMPTY_AUDIT: BuilderAuditInput = {
  id: null,
  overallScore: null,
  redesignOpportunityScore: null,
  findings: [],
};

const FULL_HOME_SERVICES: BuilderLeadInput = {
  id: "visual-qa-home-services",
  businessName: "Redfern Air & Heating",
  industry: "Air Conditioning & Heating",
  city: "Coral Springs",
  state: "FL",
  address: "4180 NW 88th Avenue, Coral Springs, FL",
  phone: "(954) 555-0114",
  email: null,
  websiteUrl: null,
  rating: 4.8,
  reviewCount: 412,
  status: "audited",
  inspectionSummary: {
    verified_public_facts: {
      public_description:
        "Family-run cooling and heating company serving single-family homes and small commercial properties across northwest Broward County.",
      public_hours: "Monday-Friday 7:30 AM - 6:00 PM\nSaturday 8:00 AM - 2:00 PM\nSunday Closed",
    },
    emergency_service: true,
  },
};

const MINIMAL_HOME_SERVICES: BuilderLeadInput = {
  id: "visual-qa-home-services-minimal",
  businessName: "Palm Ridge Landscaping",
  industry: "Landscaping",
  city: null,
  state: null,
  address: null,
  phone: "(561) 555-0178",
  email: null,
  websiteUrl: null,
  rating: null,
  reviewCount: 0,
  status: "audited",
  inspectionSummary: null,
};

const FULL_PROFESSIONAL: BuilderLeadInput = {
  id: "visual-qa-professional",
  businessName: "Weatherby Dental Studio",
  industry: "Dentistry",
  city: "Delray Beach",
  state: "FL",
  address: "220 East Atlantic Avenue, Delray Beach, FL",
  phone: "(561) 555-0133",
  email: "front.desk@weatherby.example.test",
  websiteUrl: null,
  rating: 4.9,
  reviewCount: 186,
  status: "audited",
  inspectionSummary: {
    verified_public_facts: {
      public_description:
        "General and cosmetic dental practice accepting new patients, with evening appointments available on weekdays.",
      public_hours: "Monday-Thursday 8:00 AM - 5:00 PM\nFriday 8:00 AM - 1:00 PM",
    },
  },
};

const MINIMAL_PROFESSIONAL: BuilderLeadInput = {
  id: "visual-qa-professional-minimal",
  businessName: "Calder & Roe Accounting",
  industry: "Accounting",
  city: null,
  state: null,
  address: null,
  phone: null,
  email: "hello@calderroe.example.test",
  websiteUrl: null,
  rating: null,
  reviewCount: 0,
  status: "audited",
  inspectionSummary: null,
};

const LEADS: Record<VisualQaVariant, BuilderLeadInput> = {
  "home-services": FULL_HOME_SERVICES,
  "home-services-minimal": MINIMAL_HOME_SERVICES,
  professional: FULL_PROFESSIONAL,
  "professional-minimal": MINIMAL_PROFESSIONAL,
};

export const VISUAL_QA_LABELS: Record<VisualQaVariant, string> = {
  "home-services": "Home Services Pro - full facts",
  "home-services-minimal": "Home Services Pro - name, industry, phone only",
  professional: "Professional Authority - full facts",
  "professional-minimal": "Professional Authority - no phone, no location",
};

export function visualQaSpec(variant: VisualQaVariant): WebsiteSpec {
  return runBuilderPipeline(LEADS[variant], EMPTY_AUDIT).spec;
}
