import "server-only";

import { cookies } from "next/headers";
import {
  getAuthConfig,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/config";
import {
  createSessionToken,
  timingSafeEqual,
  verifySessionToken,
} from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/config";

export async function createSession(email: string): Promise<boolean> {
  const config = getAuthConfig();
  if (!config) return false;

  const token = await createSessionToken(email, config.authSecret);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return true;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const config = getAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token, config.authSecret);
  if (!payload) return null;

  if (!timingSafeEqual(payload.email, config.adminEmail)) {
    return null;
  }

  return payload;
}
