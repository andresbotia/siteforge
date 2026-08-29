import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthConfig,
  isLoginPath,
  LOGIN_PATH,
  POST_LOGIN_PATH,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/config";
import { timingSafeEqual, verifySessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const config = getAuthConfig();
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session =
    config && token ? await verifySessionToken(token, config.authSecret) : null;
  const authenticated = Boolean(
    session && config && timingSafeEqual(session.email, config.adminEmail),
  );

  if (isLoginPath(pathname)) {
    if (authenticated) {
      return NextResponse.redirect(new URL(POST_LOGIN_PATH, request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL(LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
