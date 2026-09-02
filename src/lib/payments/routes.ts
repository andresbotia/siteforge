/** Public (unauthenticated) Checkout success/cancel confirmation pages -- mirrors src/lib/previews/routes.ts's pattern. */
export function isPublicCheckoutStatusPath(pathname: string): boolean {
  return pathname === "/checkout/success" || pathname === "/checkout/cancel";
}

/** Public (unauthenticated) customer purchase page -- mirrors /p/[token] and /o/[token]'s pattern. */
export function isPublicPurchasePath(pathname: string): boolean {
  return /^\/buy\/[^/]+$/.test(pathname);
}
