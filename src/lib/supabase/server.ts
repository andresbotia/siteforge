import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export function createServerSupabaseClient(): SupabaseClient<Database> | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  return createClient<Database>(config.url, config.publishableKey, {
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
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data, error } = await query(client);
  if (error) {
    console.error("Supabase read failed", error.code ?? "unknown");
    return null;
  }

  return data;
}
