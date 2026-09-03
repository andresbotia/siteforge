export const SESSION_COOKIE_NAME = "siteforge_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const LOGIN_PATH = "/login";
export const POST_LOGIN_PATH = "/today";

const MIN_SECRET_LENGTH = 16;

export type AuthConfig = {
  adminEmail: string;
  adminPassword: string;
  authSecret: string;
};

export type SessionPayload = {
  sub: "admin";
  email: string;
  exp: number;
};

export function getAuthConfig(): AuthConfig | null {
  const adminEmail = process.env.SITEFORGE_ADMIN_EMAIL?.trim() ?? "";
  const adminPassword = process.env.SITEFORGE_ADMIN_PASSWORD ?? "";
  const authSecret = process.env.SITEFORGE_AUTH_SECRET?.trim() ?? "";

  if (!adminEmail || !adminPassword || authSecret.length < MIN_SECRET_LENGTH) {
    return null;
  }

  return { adminEmail, adminPassword, authSecret };
}

export function getSessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function isLoginPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`);
}
