import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bodyStatesCommercialTerms, commercialTermsLines } from "@/lib/sales/commercial-terms";
import {
  buildWelcomeEmailSentPatch,
  canSendWelcomeEmail,
  composeWelcomeCustomerEmail,
} from "./welcome-email";

describe("canSendWelcomeEmail", () => {
  it("only succeeds when active and not already sent", () => {
    assert.equal(canSendWelcomeEmail("active", false).ok, true);
  });

  it("refuses (explicit error, not a silent no-op) from any non-active status", () => {
    for (const status of ["pending_setup", "cancelled", "", "draft", "unknown"]) {
      const result = canSendWelcomeEmail(status, false);
      assert.equal(result.ok, false, status);
      if (!result.ok) {
        assert.match(result.error, /not "active"/);
        assert.match(result.error, new RegExp(`"${status}"`));
      }
    }
  });

  it("refuses (explicit error, not a silent no-op) a second send even while active", () => {
    const result = canSendWelcomeEmail("active", true);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /already been sent/);
    }
  });
});

describe("buildWelcomeEmailSentPatch", () => {
  it("records the exact fields the update writes, with a real timestamp", () => {
    const now = new Date("2026-09-06T12:00:00.000Z");
    const patch = buildWelcomeEmailSentPatch("https://reefpoolcare.example.test", now);
    assert.deepEqual(patch, {
      production_url: "https://reefpoolcare.example.test",
      welcome_email_sent_at: "2026-09-06T12:00:00.000Z",
    });
  });

  it("defaults to the current time when no date is given", () => {
    const before = Date.now();
    const patch = buildWelcomeEmailSentPatch("https://reefpoolcare.example.test");
    const after = Date.now();
    const recorded = new Date(patch.welcome_email_sent_at).getTime();
    assert.ok(recorded >= before && recorded <= after);
  });
});

describe("composeWelcomeCustomerEmail", () => {
  it("states the site is live, at the given link, personalized with the business name", () => {
    const { subject, body } = composeWelcomeCustomerEmail({
      businessName: "Reef Pool Care",
      siteUrl: "https://reefpoolcare.com",
    });
    assert.equal(subject, "your site is live");
    assert.match(body, /Hi Reef Pool Care team,/);
    assert.match(body, /Your site is live: https:\/\/reefpoolcare\.com/);
  });

  it("embeds the exact same commercial-terms clauses as the cold and follow-up emails -- same source of truth, byte-for-byte", () => {
    const { body } = composeWelcomeCustomerEmail({
      businessName: "Reef Pool Care",
      siteUrl: "https://reefpoolcare.com",
    });
    for (const line of commercialTermsLines("Reef Pool Care")) {
      assert.ok(body.includes(line), `expected the welcome email to contain: ${line}`);
    }
    assert.equal(bodyStatesCommercialTerms(body), true);
  });

  it("tells the customer how to reach the founder directly, without inventing a phone number or contact details not in evidence", () => {
    const { body } = composeWelcomeCustomerEmail({
      businessName: "Reef Pool Care",
      siteUrl: "https://reefpoolcare.com",
    });
    assert.match(body, /just reply to this email/);
    // "on your phone" (viewing the site) is legitimate; a fabricated phone
    // number or "call/text me" claim -- contact info not in evidence -- is not.
    assert.doesNotMatch(body, /call me|text me|\(\d{3}\)|\d{3}-\d{3}-\d{4}/i);
  });

  it("reads like a peer, not corporate boilerplate -- no AI-cliche or salesy openers", () => {
    const { body } = composeWelcomeCustomerEmail({
      businessName: "Reef Pool Care",
      siteUrl: "https://reefpoolcare.com",
    });
    assert.doesNotMatch(body, /I hope this email finds you well/i);
    assert.doesNotMatch(body, /leverage|synergy|best-in-class/i);
  });
});
