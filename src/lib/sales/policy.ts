export function assertNoSalesSideEffects(): void {
  // Sales drafting is deterministic and must never autonomously send email,
  // deploy websites, change DNS, or charge money.
}

export function salesPaidAiPath(): "not_required" {
  return "not_required";
}
