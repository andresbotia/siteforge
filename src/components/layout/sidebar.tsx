"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  isActivePath,
  navSections,
  toolsNavItems,
  toolsSections,
} from "@/components/layout/nav-config";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

function NavLink({
  href,
  label,
  Icon,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent-muted text-accent"
          : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden={true} />
      {label}
    </Link>
  );
}

export function Sidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const toolsActive = toolsNavItems.some((item) => isActivePath(pathname, item.href));
  const [toolsOpen, setToolsOpen] = useState(toolsActive);

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="border-b border-border px-4 py-4">
        <Link href="/today" onClick={onNavigate} className="block">
          <p className="text-sm font-semibold tracking-tight">SiteForge</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            AI Website Operations
          </p>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Primary">
        {navSections.map((section, index) => (
          <div key={section.label ?? `section-${index}`} className="mb-4">
            {section.label ? (
              <p className="px-2 pb-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    Icon={item.icon}
                    active={isActivePath(pathname, item.href)}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="mb-4">
          <button
            type="button"
            aria-expanded={toolsOpen}
            aria-controls="sidebar-tools"
            onClick={() => setToolsOpen((open) => !open)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <ChevronRight
              className={cn("size-3 transition-transform", toolsOpen && "rotate-90")}
              aria-hidden={true}
            />
            Tools
          </button>
          {toolsOpen ? (
            <div id="sidebar-tools" className="mt-1 space-y-3">
              {toolsSections.map((section) => (
                <div key={section.label}>
                  {section.label ? (
                    <p className="px-2 pb-1 text-[10px] tracking-wide text-muted-foreground/70 uppercase">
                      {section.label}
                    </p>
                  ) : null}
                  <ul className="space-y-0.5">
                    {section.items.map((item) => (
                      <li key={item.href}>
                        <NavLink
                          href={item.href}
                          label={item.label}
                          Icon={item.icon}
                          active={isActivePath(pathname, item.href)}
                          onNavigate={onNavigate}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">M10 · Operator Console</p>
        <p className="text-[11px] text-muted-foreground">
          Mock payment &amp; email providers
        </p>
        <form action={logout} className="mt-2">
          <button
            type="submit"
            className="text-[11px] text-muted transition-colors hover:text-foreground"
          >
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
