import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSupabaseServerConfigFromEnv,
  getSupabaseServerConfigIssueFromEnv,
} from "./config-core";

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

describe("Supabase server configuration", () => {
  it("rejects a public-prefixed secret key instead of using it server-side", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: "server-secret-in-wrong-place",
        SUPABASE_SECRET_KEY: undefined,
      },
      () => {
        const issue = getSupabaseServerConfigIssueFromEnv(process.env);
        assert.equal(issue?.code, "public_prefixed_secret_key");
        assert.match(issue?.message ?? "", /SUPABASE_SECRET_KEY/);
        assert.equal(getSupabaseServerConfigFromEnv(process.env), null);
      },
    );
  });

  it("rejects publishable keys configured as server secrets", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SECRET_KEY: "sb_publishable_example",
      },
      () => {
        const issue = getSupabaseServerConfigIssueFromEnv(process.env);
        assert.equal(issue?.code, "publishable_key_used_as_secret");
        assert.equal(getSupabaseServerConfigFromEnv(process.env), null);
      },
    );
  });

  it("accepts a server-only Supabase secret", () => {
    withEnv(
      {
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_SECRET_KEY: undefined,
        SUPABASE_SECRET_KEY: "sb_secret_example",
      },
      () => {
        assert.equal(getSupabaseServerConfigIssueFromEnv(process.env), null);
        assert.deepEqual(getSupabaseServerConfigFromEnv(process.env), {
          url: "https://project.supabase.co",
          secretKey: "sb_secret_example",
        });
      },
    );
  });
});
