import { isHomeServiceIndustry, isRestaurantIndustry } from "@/lib/auditor/industry";
import { PALETTE_KEYS, TEMPLATE_KEYS, type PaletteKey, type TemplateKey } from "./limits";

export const TEMPLATE_CATALOG: Record<
  TemplateKey,
  { label: string; palette: PaletteKey; family: "home_services" | "restaurant" | "professional" }
> = {
  "home-services-modern": {
    label: "Home Services Modern",
    palette: "navy-amber",
    family: "home_services",
  },
  "restaurant-modern": {
    label: "Restaurant Modern",
    palette: "ink-cream",
    family: "restaurant",
  },
  "professional-services-modern": {
    label: "Professional Services Modern",
    palette: "slate-teal",
    family: "professional",
  },
};

const TEMPLATE_SET = new Set<string>(TEMPLATE_KEYS);
const PALETTE_SET = new Set<string>(PALETTE_KEYS);

export function isTemplateKey(value: string): value is TemplateKey {
  return TEMPLATE_SET.has(value);
}

export function isPaletteKey(value: string): value is PaletteKey {
  return PALETTE_SET.has(value);
}

export function selectTemplate(industry: string): TemplateKey {
  if (isRestaurantIndustry(industry)) return "restaurant-modern";
  if (isHomeServiceIndustry(industry)) return "home-services-modern";
  return "professional-services-modern";
}

export function templateLabel(key: TemplateKey): string {
  return TEMPLATE_CATALOG[key].label;
}
