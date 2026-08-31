export function isPublicResendWebhookPath(pathname: string): boolean {
  return pathname === "/api/resend/webhook";
}
