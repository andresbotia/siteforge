import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { getEmailProviderStatus, isSafeInternalTestRecipient } from "./config-core";
import {
  hasUnsubscribeLanguage,
  isRecipientSuppressed,
  liveEmailAllowed,
  verifyApprovedOutreachContent,
} from "./delivery-policy";
import { MockEmailProvider } from "./mock";
import { createResendEmailProvider } from "./resend";
import { parseResendWebhookEvent, verifyResendWebhookSignature } from "./webhook";
import { computeOutreachContentHash } from "@/lib/sales/content-hash";

const originalEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...originalEnv };
}

describe("email provider configuration", () => {
  test("live email gate defaults off", () => {
    restoreEnv();
    delete process.env.SITEFORGE_ALLOW_LIVE_EMAIL;
    delete process.env.RESEND_API_KEY;

    const config = {
      provider: "mock" as const,
      resendApiKey: null,
      from: null,
      replyTo: null,
      allowLiveEmail: process.env.SITEFORGE_ALLOW_LIVE_EMAIL === "true",
      internalTestRecipient: null,
      webhookSecret: null,
    };
    const status = getEmailProviderStatus(config);

    assert.equal(config.allowLiveEmail, false);
    assert.equal(config.provider, "mock");
    assert.equal(status.readyForProspectSend, false);
  });

  test("missing provider config fails closed", () => {
    const result = liveEmailAllowed({
      allowLiveEmail: true,
      providerKeyPresent: false,
      fromConfigured: true,
      replyToConfigured: true,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /RESEND_API_KEY/);
  });

  test("internal test recipients are allowlisted", () => {
    const config = {
      provider: "resend" as const,
      resendApiKey: "re_test",
      from: "SiteForge <sender@example.com>",
      replyTo: "reply@example.com",
      allowLiveEmail: true,
      internalTestRecipient: "operator@example.com",
      webhookSecret: null,
    };

    assert.equal(isSafeInternalTestRecipient("operator@example.com", config), true);
    assert.equal(isSafeInternalTestRecipient("prospect@example.com", config), false);
  });

  test("provider credentials are not referenced by client components", () => {
    const clientFiles = [
      "src/components/settings/settings-view.tsx",
      "src/components/sales/outreach-detail-view.tsx",
    ];
    for (const file of clientFiles) {
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("RESEND_API_KEY"), false, file);
      assert.equal(text.includes("process.env"), false, file);
    }
  });
});

describe("email delivery policy", () => {
  const outreach = {
    subject: "Subject",
    body: "Body",
    recipient_email: "owner@example.com",
    preview_deployment_id: "preview-1",
    attribution_token_hash: "hash-1",
    content_version: "v1",
  };
  const contentHash = computeOutreachContentHash({
    subject: outreach.subject,
    body: outreach.body,
    recipient: outreach.recipient_email,
    previewDeploymentId: outreach.preview_deployment_id,
    attributionTokenHash: outreach.attribution_token_hash,
  });

  test("unapproved outreach cannot send", () => {
    const result = verifyApprovedOutreachContent(outreach, null);

    assert.equal(result.ok, false);
    assert.match(result.error, /approved state/);
  });

  test("stale approval cannot send", () => {
    const result = verifyApprovedOutreachContent(outreach, {
      status: "executed",
      approval_type: "external_email",
      payload: {
        action: "send_outreach_email",
        content_hash: "old",
        attribution_token_hash: "hash-1",
        preview_deployment_id: "preview-1",
        content_version: "v1",
      },
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /no longer matches/);
  });

  test("edited content invalidates send approval", () => {
    const approved = verifyApprovedOutreachContent(outreach, {
      status: "executed",
      approval_type: "external_email",
      payload: {
        action: "send_outreach_email",
        content_hash: contentHash,
        attribution_token_hash: "hash-1",
        preview_deployment_id: "preview-1",
        content_version: "v1",
      },
    });
    const edited = verifyApprovedOutreachContent({ ...outreach, subject: "Changed" }, {
      status: "executed",
      approval_type: "external_email",
      payload: {
        action: "send_outreach_email",
        content_hash: contentHash,
        attribution_token_hash: "hash-1",
        preview_deployment_id: "preview-1",
        content_version: "v1",
      },
    });

    assert.equal(approved.ok, true);
    assert.equal(edited.ok, false);
  });

  test("suppressed recipient is blocked", () => {
    assert.equal(
      isRecipientSuppressed("owner@example.com", [
        {
          event_type: "email.bounced",
          payload: { recipient_email: "owner@example.com" },
        },
      ]),
      true,
    );
  });

  test("real prospect sends require unsubscribe language", () => {
    assert.equal(hasUnsubscribeLanguage("Reply unsubscribe if this is not relevant."), true);
    assert.equal(hasUnsubscribeLanguage("Reply opt out if this is not relevant."), true);
    assert.equal(hasUnsubscribeLanguage("Here is the approved outreach body."), false);
  });

  test("duplicate real send remains blocked in the data boundary", () => {
    const source = readFileSync("src/data/outreach.ts", "utf8");
    assert.match(source, /outreach\.status === "sent"/);
    assert.match(source, /already been sent/);
  });

  test("internal test path does not mutate lead or prospect funnel state", () => {
    const source = readFileSync("src/data/email.ts", "utf8");
    assert.equal(source.includes('.from("leads")'), false);
    assert.equal(source.includes("contacted"), false);
    assert.match(source, /internal_email_test_/);
  });
});

describe("email providers", () => {
  test("mock provider still works in tests", async () => {
    const provider = new MockEmailProvider();
    const result = await provider.sendEmail({
      to: "owner@example.com",
      from: "sender@example.com",
      subject: "Subject",
      text: "Body",
    });

    assert.equal(result.ok, true);
    assert.equal(result.provider, "mock");
    assert.equal(result.simulated, true);
  });

  test("real provider adapter is deterministic at boundary with mocked network", async () => {
    const requests: RequestInit[] = [];
    const provider = createResendEmailProvider(
      {
        provider: "resend",
        resendApiKey: "re_test",
        from: "sender@example.com",
        replyTo: "reply@example.com",
        allowLiveEmail: true,
        internalTestRecipient: "operator@example.com",
        webhookSecret: null,
      },
      async (_url, init) => {
        requests.push(init);
        return { ok: true, status: 200, async json() { return { id: "email_123" }; } };
      },
    );

    const result = await provider.sendEmail({
      to: "owner@example.com",
      from: "sender@example.com",
      replyTo: "reply@example.com",
      subject: "Subject",
      text: "Body",
      metadata: { outreach_id: "outreach-1", idempotency_key: "outreach/outreach-1/hash" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.messageId, "email_123");
    assert.equal((requests[0].headers as Record<string, string>)["Idempotency-Key"], "outreach/outreach-1/hash");
    assert.match(String((requests[0].headers as Record<string, string>).Authorization), /^Bearer /);
  });
});

describe("Resend webhook verification", () => {
  test("verifies Svix-style webhook signatures and rejects tampering", () => {
    const secret = `whsec_${Buffer.from("test-secret").toString("base64")}`;
    const payload = JSON.stringify({ id: "evt_1", type: "email.delivered", data: { id: "email_1" } });
    const timestamp = "1800000000";
    const signature = createHmac("sha256", Buffer.from("test-secret"))
      .update(`msg_1.${timestamp}.${payload}`)
      .digest("base64");

    assert.equal(
      verifyResendWebhookSignature({
        payload,
        headers: {
          "svix-id": "msg_1",
          "svix-timestamp": timestamp,
          "svix-signature": `v1,${signature}`,
        },
        secret,
        nowSeconds: 1800000000,
      }),
      true,
    );
    assert.equal(
      verifyResendWebhookSignature({
        payload: `${payload} `,
        headers: {
          "svix-id": "msg_1",
          "svix-timestamp": timestamp,
          "svix-signature": `v1,${signature}`,
        },
        secret,
        nowSeconds: 1800000000,
      }),
      false,
    );
  });

  test("parses supported delivery, bounce, complaint, and suppression events", () => {
    for (const type of ["email.delivered", "email.bounced", "email.complained", "email.suppressed"]) {
      const event = parseResendWebhookEvent({
        id: `evt_${type}`,
        type,
        created_at: "2026-08-30T00:00:00.000Z",
        data: { id: "email_1", to: ["owner@example.com"] },
      });

      assert.equal(event?.type, type);
      assert.equal(event?.emailId, "email_1");
      assert.equal(event?.to, "owner@example.com");
    }
  });
});
