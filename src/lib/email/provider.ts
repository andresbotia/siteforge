import "server-only";

import { mockEmailProvider } from "./mock";
import type { EmailProvider } from "./types";

export const DEFAULT_SENDER_NAME = "Andres Botia";
export const DEFAULT_SENDER_EMAIL = "outreach@siteforge.agency";

export function getEmailProvider(): EmailProvider {
  // In Milestone 8, always use the safe mock provider
  return mockEmailProvider;
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}
