import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyBot,
  classifyBrowser,
  classifyDevice,
  createVisitorKey,
  isPreviewEventType,
  sanitizePreviewPath,
  sanitizeReferrer,
} from "./events";

describe("preview event utilities", () => {
  it("classifies scanners separately from likely humans", () => {
    assert.equal(
      classifyBot({ method: "GET", userAgent: "Mozilla/5.0 Chrome/140.0" }),
      "human_likely",
    );
    assert.equal(
      classifyBot({ method: "GET", userAgent: "Googlebot/2.1" }),
      "bot_likely",
    );
    assert.equal(classifyBot({ method: "HEAD", userAgent: "Mozilla/5.0" }), "bot_likely");
    assert.equal(classifyBot({ method: "GET", userAgent: null }), "unknown");
  });

  it("classifies browser and device from user-agent without storing raw IP", () => {
    assert.equal(classifyDevice("Mozilla/5.0 iPhone Mobile Safari/605.1"), "mobile");
    assert.equal(classifyDevice("Mozilla/5.0 iPad Safari/605.1"), "tablet");
    assert.equal(classifyDevice("Mozilla/5.0 Chrome/140.0"), "desktop");
    assert.equal(classifyBrowser("Mozilla/5.0 Edg/140.0"), "edge");
    assert.equal(classifyBrowser("Mozilla/5.0 Firefox/140.0"), "firefox");
    assert.equal(classifyBrowser("Googlebot/2.1"), "bot");
  });

  it("rotates visitor keys daily and scopes them to a preview", () => {
    const request = {
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0 Chrome/140.0",
      acceptLanguage: "en-US",
    };
    const first = createVisitorKey({
      previewDeploymentId: "preview-a",
      occurredAt: new Date("2026-08-29T12:00:00Z"),
      request,
    });
    const sameDay = createVisitorKey({
      previewDeploymentId: "preview-a",
      occurredAt: new Date("2026-08-29T20:00:00Z"),
      request,
    });
    const nextDay = createVisitorKey({
      previewDeploymentId: "preview-a",
      occurredAt: new Date("2026-08-30T00:00:00Z"),
      request,
    });

    assert.equal(first, sameDay);
    assert.notEqual(first, nextDay);
    assert.equal(first.includes(request.ip), false);
  });

  it("allows only known event types and bounds public strings", () => {
    assert.equal(isPreviewEventType("preview_viewed"), true);
    assert.equal(isPreviewEventType("form_submitted"), false);
    assert.equal(sanitizePreviewPath("x".repeat(250))?.length, 200);
    assert.equal(sanitizeReferrer("x".repeat(350))?.length, 300);
  });
});
