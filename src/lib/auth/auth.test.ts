import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getAuthConfig,
  getSessionCookieOptions,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/config";
import {
  createSessionToken,
  credentialsMatch,
  verifySessionToken,
} from "@/lib/auth/session";

function withEnv<T>(patch: NodeJS.ProcessEnv, fn: () => T): T {
  const previous = { ...process.env };
  try {
    process.env = { ...previous, ...patch };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete process.env[key];
    }
    return fn();
  } finally {
    process.env = previous;
  }
}

describe("temporary admin auth configuration", () => {
  it("fails closed when required auth environment is missing", () => {
    withEnv(
      {
        SITEFORGE_ADMIN_EMAIL: "",
        SITEFORGE_ADMIN_PASSWORD: "",
        SITEFORGE_AUTH_SECRET: "",
      },
      () => {
        assert.equal(getAuthConfig(), null);
      },
    );
  });

  it("fails closed when the auth signing secret is too short", () => {
    withEnv(
      {
        SITEFORGE_ADMIN_EMAIL: "admin@example.com",
        SITEFORGE_ADMIN_PASSWORD: "password",
        SITEFORGE_AUTH_SECRET: "short",
      },
      () => {
        assert.equal(getAuthConfig(), null);
      },
    );
  });

  it("sets secure http-only session cookies in production", () => {
    withEnv({ NODE_ENV: "production" }, () => {
      assert.deepEqual(getSessionCookieOptions(), {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    });
  });
});

describe("temporary admin session tokens", () => {
  it("accepts a signed unexpired admin token", async () => {
    const secret = "test-secret-with-enough-length";
    const token = await createSessionToken("admin@example.com", secret);
    const session = await verifySessionToken(token, secret);
    assert.equal(session?.sub, "admin");
    assert.equal(session?.email, "admin@example.com");
  });

  it("rejects a tampered token", async () => {
    const secret = "test-secret-with-enough-length";
    const token = await createSessionToken("admin@example.com", secret);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(await verifySessionToken(tampered, secret), null);
  });

  it("matches credentials without accepting case-sensitive email mismatches", () => {
    assert.equal(
      credentialsMatch(" ADMIN@example.com ", "password", {
        adminEmail: "admin@example.com",
        adminPassword: "password",
      }),
      true,
    );
    assert.equal(
      credentialsMatch("admin@example.com", "wrong", {
        adminEmail: "admin@example.com",
        adminPassword: "password",
      }),
      false,
    );
  });
});
