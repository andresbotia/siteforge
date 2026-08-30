import type { LeadStatus } from "@/types";

export function resolveCustomerPlan(input: {
  managedPlanSelected: boolean;
}): "website_only" | "managed" {
  return input.managedPlanSelected ? "managed" : "website_only";
}

export function shouldCreateManagedSubscription(input: {
  managedPlanSelected: boolean;
  managedMonthlyAmountCents: number | null;
}): boolean {
  return input.managedPlanSelected && input.managedMonthlyAmountCents !== null;
}

export function nextLeadStatusAfterCheckout(current: LeadStatus): LeadStatus {
  if (current === "rejected") return current;
  return "customer";
}
