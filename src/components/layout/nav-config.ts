import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Globe,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  ReceiptText,
  Settings,
  ShieldCheck,
  Store,
  Users,
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

export const navSections: NavSection[] = [
  {
    items: [{ href: "/", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/leads", label: "Leads", icon: Users },
      { href: "/websites", label: "Websites", icon: Globe },
      { href: "/outreach", label: "Outreach", icon: Mail },
      { href: "/offers", label: "Offers", icon: ReceiptText },
      { href: "/customers", label: "Customers", icon: Store },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/approvals", label: "Approvals", icon: ShieldCheck },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/templates", label: "Templates", icon: LayoutTemplate },
    ],
  },
  {
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
