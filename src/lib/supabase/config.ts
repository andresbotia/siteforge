import "server-only";

export type SupabaseServerConfig = {
  url: string;
  secretKey: string;
};

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";

  if (!url || !secretKey) {
    return null;
  }

  if (secretKey.startsWith("sb_publishable_")) {
    return null;
  }

  return { url, secretKey };
}
