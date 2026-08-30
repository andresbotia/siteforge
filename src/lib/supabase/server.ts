import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/auth/guard";
import {
  getSupabaseServerConfig,
  getSupabaseServerConfigIssue,
} from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export function createServerSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabaseServerConfig();
  if (!config) {
    return null;
  }

  return createClient<Database>(config.url, config.secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function readTable<T>(
  query: (
    client: SupabaseClient<Database>,
  ) => PromiseLike<{ data: T | null; error: { code?: string } | null }>,
): Promise<T | null> {
  await requireAdminSession();

  const client = createServerSupabaseClient();
  if (!client) {
    const issue = getSupabaseServerConfigIssue();
    console.error("Supabase read unavailable", issue?.code ?? "unknown_config");
    return null;
  }

  const { data, error } = await query(client);
  if (error) {
    console.error("Supabase read failed", error.code ?? "unknown");
    return null;
  }

  return data;
}

export async function mutateTable<T>(
  query: (
    client: SupabaseClient<Database>,
  ) => PromiseLike<{ data: T | null; error: { code?: string; message?: string } | null }>,
): Promise<T | null> {
  await requireAdminSession();

  const client = createServerSupabaseClient();
  if (!client) {
    const issue = getSupabaseServerConfigIssue();
    console.error("Supabase write unavailable", issue?.code ?? "unknown_config");
    return null;
  }

  const { data, error } = await query(client);
  if (error) {
    console.error("Supabase write failed", {
      code: error.code ?? "unknown",
      message: error.message ?? "unknown",
    });
    return null;
  }

  return data;
}
