"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/shared/button";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (
    pathname === "/login" ||
    /^\/visual-qa\/restaurant-v2(?:\/no-image)?$/.test(pathname) ||
    /^\/websites\/[^/]+\/preview$/.test(pathname) ||
    /^\/p\/[^/]+$/.test(pathname) ||
    /^\/o\/[^/]+$/.test(pathname) ||
    /^\/buy\/[^/]+$/.test(pathname) ||
    pathname === "/checkout/success"
  ) {
    return <div className="min-h-full bg-background">{children}</div>;
  }

  return (
    <div className="min-h-full bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 border-r border-border lg:block">
        <Sidebar />
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-64 border-r border-border bg-background">
            <div className="absolute top-3 right-3">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">SiteForge</p>
            <p className="text-[11px] text-muted-foreground">
              AI Website Operations
            </p>
          </div>
        </header>
        <main id="main-content" className="px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
