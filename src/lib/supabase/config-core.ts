export type SupabaseServerConfig = {
  url: string;
  secretKey: string;
};

export type SupabaseServerConfigIssue =
  | "missing_url"
  | "missing_secret_key"
  | "public_prefixed_secret_key"
  | "publishable_key_used_as_secret";

export function getSupabaseServerConfigIssueFromEnv(env: NodeJS.ProcessEnv): {
  code: SupabaseServerConfigIssue;
  message: string;
} | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() ?? "";
  const publicPrefixedSecret =
    env.NEXT_PUBLIC_SUPABASE_SECRET_KEY?.trim() ?? "";

  if (!url || !secretKey) {
    if (!url) {
      return {
        code: "missing_url",
        message: "NEXT_PUBLIC_SUPABASE_URL is not configured.",
      };
    }
    if (publicPrefixedSecret) {
      return {
        code: "public_prefixed_secret_key",
        message:
          "SUPABASE_SECRET_KEY is missing; remove NEXT_PUBLIC_SUPABASE_SECRET_KEY and configure the server-only SUPABASE_SECRET_KEY variable.",
      };
    }
    return {
      code: "missing_secret_key",
      message: "SUPABASE_SECRET_KEY is not configured.",
    };
  }

  if (secretKey.startsWith("sb_publishable_")) {
    return {
      code: "publishable_key_used_as_secret",
      message:
        "SUPABASE_SECRET_KEY must be a server-only secret/service key, not a publishable key.",
    };
  }

  return null;
}

export function getSupabaseServerConfigFromEnv(
  env: NodeJS.ProcessEnv,
): SupabaseServerConfig | null {
  const issue = getSupabaseServerConfigIssueFromEnv(env);
  if (issue) return null;

  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() ?? "";

  return { url, secretKey };
}
