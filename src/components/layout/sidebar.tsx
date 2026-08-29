"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, navSections } from "@/components/layout/nav-config";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

export function Sidebar({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div className={cn("flex h-full flex-col bg-background", className)}>
      <div className="border-b border-border px-4 py-4">
        <Link href="/" onClick={onNavigate} className="block">
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
              {section.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "bg-accent-muted text-accent"
                          : "text-muted hover:bg-surface-hover hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-[11px] text-muted-foreground">Milestone 1</p>
        <p className="text-[11px] text-muted-foreground">Mock data only</p>
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
