export const approvalPhilosophy = {
  read: "Read actions can generally operate autonomously.",
  internalWrite:
    "Internal writes may operate autonomously depending on scope.",
  external: "External side effects require human approval initially.",
} as const;

export const privilegedActions = [
  "sending external email",
  "production website deployment",
  "customer website modification",
  "charges",
  "refunds",
  "destructive infrastructure changes",
] as const;
