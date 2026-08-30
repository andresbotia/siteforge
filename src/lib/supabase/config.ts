import "server-only";

import {
  getSupabaseServerConfigFromEnv,
  getSupabaseServerConfigIssueFromEnv,
  type SupabaseServerConfig,
  type SupabaseServerConfigIssue,
} from "@/lib/supabase/config-core";

export function getSupabaseServerConfigIssue(): {
  code: SupabaseServerConfigIssue;
  message: string;
} | null {
  return getSupabaseServerConfigIssueFromEnv(process.env);
}

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  return getSupabaseServerConfigFromEnv(process.env);
}
