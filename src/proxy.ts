import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthConfig,
  isLoginPath,
  LOGIN_PATH,
  POST_LOGIN_PATH,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/config";
import { timingSafeEqual, verifySessionToken } from "@/lib/auth/session";
import { isPublicResendWebhookPath } from "@/lib/email/routes";
import { isPublicCheckoutStatusPath, isPublicPurchasePath } from "@/lib/payments/routes";
import {
  isPreviewEventPath,
  isPublicOutreachPreviewPath,
  isPublicPreviewPath,
} from "@/lib/previews/routes";

function isPublicStripeWebhookPath(pathname: string): boolean {
  return pathname === "/api/stripe/webhook";
}

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

  if (
    isPublicPreviewPath(pathname) ||
    isPublicOutreachPreviewPath(pathname) ||
    isPreviewEventPath(pathname) ||
    isPublicResendWebhookPath(pathname) ||
    isPublicStripeWebhookPath(pathname) ||
    isPublicCheckoutStatusPath(pathname) ||
    isPublicPurchasePath(pathname)
  ) {
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
