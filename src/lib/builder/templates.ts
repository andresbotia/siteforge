import { PALETTE_KEYS, TEMPLATE_KEYS, type PaletteKey, type TemplateKey } from "./limits";
import { TEMPLATE_REGISTRY, selectTemplateForIndustry } from "./registry";

export const TEMPLATE_CATALOG: Record<
  TemplateKey,
  { label: string; palette: PaletteKey; family: "home_services" | "restaurant" | "professional" }
> = Object.fromEntries(
  Object.values(TEMPLATE_REGISTRY).map((definition) => [
    definition.key,
    { label: definition.label, palette: definition.palette, family: definition.family },
  ]),
) as Record<TemplateKey, { label: string; palette: PaletteKey; family: "home_services" | "restaurant" | "professional" }>;

const TEMPLATE_SET = new Set<string>(TEMPLATE_KEYS);
const PALETTE_SET = new Set<string>(PALETTE_KEYS);

export function isTemplateKey(value: string): value is TemplateKey {
  return TEMPLATE_SET.has(value);
}

export function isPaletteKey(value: string): value is PaletteKey {
  return PALETTE_SET.has(value);
}

export function selectTemplate(industry: string): TemplateKey {
  return selectTemplateForIndustry(industry).template;
}

export function templateLabel(key: TemplateKey): string {
  return TEMPLATE_CATALOG[key].label;
}
