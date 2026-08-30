import "server-only";

import {
  createPaymentProviderFromEnv,
  type PaymentProvider,
} from "@/lib/payments/provider-core";

export function getPaymentProvider(): PaymentProvider {
  return createPaymentProviderFromEnv(process.env);
}
