import { createHash } from "node:crypto";

import type {
  BotClassification,
  BrowserClass,
  DeviceClass,
  PreviewEventType,
} from "@/types";

const EVENT_TYPES = new Set<PreviewEventType>([
  "preview_viewed",
  "cta_clicked",
  "phone_cta_clicked",
  "contact_cta_clicked",
]);

const BOT_PATTERN =
  /bot|crawler|spider|preview|slurp|bing|google|yandex|duckduck|baidu|semrush|ahrefs|uptime|monitor|scanner|security|curl|wget|python-requests/i;

export type PreviewRequestFacts = {
  userAgent: string | null;
  method: string;
  ip: string | null;
  acceptLanguage: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  referrer: string | null;
  path: string | null;
};

export function isPreviewEventType(value: string): value is PreviewEventType {
  return EVENT_TYPES.has(value as PreviewEventType);
}

export function classifyBot(input: Pick<PreviewRequestFacts, "userAgent" | "method">): BotClassification {
  if (input.method === "HEAD") return "bot_likely";
  if (!input.userAgent) return "unknown";
  return BOT_PATTERN.test(input.userAgent) ? "bot_likely" : "human_likely";
}

export function classifyDevice(userAgent: string | null): DeviceClass {
  if (!userAgent) return "unknown";
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "tablet";
  if (/mobile|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

export function classifyBrowser(userAgent: string | null): BrowserClass {
  if (!userAgent) return "unknown";
  if (BOT_PATTERN.test(userAgent)) return "bot";
  if (/edg\//i.test(userAgent)) return "edge";
  if (/firefox\//i.test(userAgent)) return "firefox";
  if (/chrome\//i.test(userAgent) || /crios\//i.test(userAgent)) return "chrome";
  if (/safari\//i.test(userAgent)) return "safari";
  return "unknown";
}

export function createVisitorKey(input: {
  previewDeploymentId: string;
  occurredAt: Date;
  request: Pick<PreviewRequestFacts, "ip" | "userAgent" | "acceptLanguage">;
}): string {
  const day = input.occurredAt.toISOString().slice(0, 10);
  const userAgent = input.request.userAgent?.slice(0, 120) ?? "";
  const acceptLanguage = input.request.acceptLanguage?.slice(0, 80) ?? "";
  return createHash("sha256")
    .update(
      [
        input.previewDeploymentId,
        day,
        input.request.ip ?? "",
        userAgent,
        acceptLanguage,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 32);
}

export function sanitizePreviewPath(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 200);
}

export function sanitizeReferrer(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 300);
}
