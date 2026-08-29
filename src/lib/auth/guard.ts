import "server-only";

import { redirect } from "next/navigation";
import { LOGIN_PATH, type SessionPayload } from "@/lib/auth/config";
import { getSession } from "@/lib/auth/cookies";

export async function requireAdminSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    redirect(LOGIN_PATH);
  }
  return session;
}
