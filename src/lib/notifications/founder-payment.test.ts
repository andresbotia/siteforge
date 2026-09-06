import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFounderPaymentNotificationEmail } from "./founder-payment";

describe("buildFounderPaymentNotificationEmail", () => {
  it("includes the business name, amount, and a direct lead link", () => {
    const message = buildFounderPaymentNotificationEmail(
      {
        businessName: "Atlantic Drain Plumbing",
        amountTotalCents: 9900,
        currency: "usd",
        leadId: "lead-123",
        leadUrl: "https://app.example.test/leads/lead-123",
      },
      { to: "founder@example.test", from: "outreach@siteforge.agency" },
    );

    assert.equal(message.to, "founder@example.test");
    assert.equal(message.from, "outreach@siteforge.agency");
    assert.match(message.subject, /Atlantic Drain Plumbing/);
    assert.match(message.subject, /\$99 USD/);
    assert.match(message.text, /Atlantic Drain Plumbing/);
    assert.match(message.text, /\$99 USD/);
    assert.match(message.text, /https:\/\/app\.example\.test\/leads\/lead-123/);
  });

  it("formats a non-whole-dollar amount to two decimal places", () => {
    const message = buildFounderPaymentNotificationEmail(
      {
        businessName: "Reef Pool Care",
        amountTotalCents: 4950,
        currency: "usd",
        leadId: "lead-9",
        leadUrl: "https://app.example.test/leads/lead-9",
      },
      { to: "founder@example.test", from: "outreach@siteforge.agency" },
    );
    assert.match(message.subject, /\$49\.50 USD/);
  });

  it("never invents an amount when one is not known", () => {
    const message = buildFounderPaymentNotificationEmail(
      {
        businessName: "Reef Pool Care",
        amountTotalCents: null,
        currency: null,
        leadId: "lead-9",
        leadUrl: "https://app.example.test/leads/lead-9",
      },
      { to: "founder@example.test", from: "outreach@siteforge.agency" },
    );
    assert.match(message.text, /an unknown amount/);
    assert.doesNotMatch(message.text, /\$/);
  });

  it("tags the message with metadata identifying it as a founder payment notification", () => {
    const message = buildFounderPaymentNotificationEmail(
      {
        businessName: "Reef Pool Care",
        amountTotalCents: 9900,
        currency: "usd",
        leadId: "lead-9",
        leadUrl: "https://app.example.test/leads/lead-9",
      },
      { to: "founder@example.test", from: "outreach@siteforge.agency" },
    );
    assert.equal(message.metadata?.notification, "founder_payment_success");
    assert.equal(message.metadata?.lead_id, "lead-9");
  });
});
