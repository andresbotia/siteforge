"use client";

import type { PreviewEventType } from "@/types";

export function TrackedCtaLink({
  href,
  label,
  className,
  token,
  eventType,
}: {
  href: string;
  label: string;
  className: string;
  token: string;
  eventType: PreviewEventType;
}) {
  function trackClick() {
    const payload = JSON.stringify({
      token,
      eventType,
      path: window.location.pathname + window.location.search,
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/preview-events",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    void fetch("/api/preview-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    });
  }

  return (
    <a href={href} className={className} onClick={trackClick}>
      {label}
    </a>
  );
}
