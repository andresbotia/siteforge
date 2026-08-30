import "server-only";

import { getEmailConfig } from "./config";
import { mockEmailProvider } from "./mock";
import { createResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";
import { isValidEmail } from "./validation";

export const DEFAULT_SENDER_NAME = "Andres Botia";
export const DEFAULT_SENDER_EMAIL = "outreach@siteforge.agency";

export function getEmailProvider(): EmailProvider {
  const config = getEmailConfig();
  if (config.allowLiveEmail) {
    return createResendEmailProvider(config);
  }
  return mockEmailProvider;
}

export { isValidEmail };
