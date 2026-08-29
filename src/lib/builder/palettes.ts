import type { PaletteKey } from "./limits";

export const PALETTE_STYLES: Record<
  PaletteKey,
  {
    wrap: string;
    header: string;
    hero: string;
    accent: string;
    accentText: string;
    band: string;
    footer: string;
    muted: string;
  }
> = {
  "navy-amber": {
    wrap: "bg-[#f4efe6] text-slate-900",
    header: "bg-[#102a43] text-white",
    hero: "bg-[#102a43] text-white",
    accent: "bg-amber-600 text-white hover:bg-amber-500",
    accentText: "text-amber-700",
    band: "bg-amber-50",
    footer: "bg-[#102a43] text-white",
    muted: "text-slate-600",
  },
  "ink-cream": {
    wrap: "bg-[#faf6f1] text-stone-900",
    header: "bg-[#1c1917] text-[#faf6f1]",
    hero: "bg-[#1c1917] text-[#faf6f1]",
    accent: "bg-rose-800 text-white hover:bg-rose-700",
    accentText: "text-rose-800",
    band: "bg-orange-50",
    footer: "bg-[#1c1917] text-[#faf6f1]",
    muted: "text-stone-600",
  },
  "slate-teal": {
    wrap: "bg-slate-50 text-slate-900",
    header: "bg-slate-900 text-white",
    hero: "bg-slate-900 text-white",
    accent: "bg-teal-700 text-white hover:bg-teal-600",
    accentText: "text-teal-800",
    band: "bg-teal-50",
    footer: "bg-slate-900 text-white",
    muted: "text-slate-600",
  },
};
