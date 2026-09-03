import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  CalendarCheck,
  GitBranch,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Map,
  Palette,
  ReceiptText,
  ScanSearch,
  Settings,
  ShieldCheck,
  Store,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

/**
 * M10 Task 1. Primary navigation is what the operator DOES, not how the
 * system was built. Five items only:
 *
 *   Today     -- the work queue and the post-login landing page
 *   Pipeline  -- every business, at whatever stage; business detail is reached
 *                from here and from Today, never from nav
 *   Customers -- businesses that have paid
 *   Roadmap   -- where the product is going
 *   Settings  -- configuration, plus the Tools drawer for per-agent debug UIs
 *
 * The old per-agent screens (/agents/*, /templates, /visual-qa, /audits,
 * /websites, /outreach, /offers, /approvals, /analytics, the old Overview)
 * all keep their routes and keep working -- they are the right screens for
 * their own detail views and for debugging -- but they are demoted to the
 * collapsed "Tools" group (see `toolsSections`), not primary nav.
 */
export const navSections: NavSection[] = [
  {
    items: [
      { href: "/today", label: "Today", icon: CalendarCheck },
      { href: "/leads", label: "Pipeline", icon: GitBranch },
      { href: "/customers", label: "Customers", icon: Store },
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

/**
 * Secondary "Tools" navigation: the build-time / per-agent / debug surfaces.
 * Rendered inside a collapsed group in the sidebar and linked from Settings.
 * Nothing here was deleted; it is simply not part of the daily operating path.
 */
export const toolsSections: NavSection[] = [
  {
    label: "Overview & queues",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Agents",
    items: [
      { href: "/agents", label: "All agents", icon: Bot },
      { href: "/agents/scout", label: "Scout", icon: ScanSearch },
      { href: "/agents/auditor", label: "Auditor", icon: ShieldCheck },
      { href: "/agents/builder", label: "Builder", icon: LayoutTemplate },
      { href: "/agents/designer", label: "Designer", icon: Palette },
      { href: "/agents/sales", label: "Sales", icon: Mail },
    ],
  },
  {
    label: "Artifacts",
    items: [
      { href: "/audits", label: "Audits", icon: ShieldCheck },
      { href: "/websites", label: "Websites", icon: Globe },
      { href: "/outreach", label: "Outreach", icon: Mail },
      { href: "/offers", label: "Offers", icon: ReceiptText },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
    ],
  },
];

export const toolsNavItems: NavItem[] = toolsSections.flatMap((section) => section.items);

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
