/** Public (unauthenticated) Checkout success/cancel confirmation pages -- mirrors src/lib/previews/routes.ts's pattern. */
export function isPublicCheckoutStatusPath(pathname: string): boolean {
  return pathname === "/checkout/success" || pathname === "/checkout/cancel";
}
