"use client";

import { useActionState, useState } from "react";
import { sendInternalTestEmailAction, type EmailActionState } from "@/app/actions/email";
import { CostControlsPanel } from "@/components/ai/cost-controls-panel";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { ConnectionBadge } from "@/components/shared/status-badge";
import { settingsDefaults } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { StripeConfigStatus } from "@/lib/payments/config";
import type {
  AiCostControlsView,
  EmailProviderStatus,
  IntegrationStatus,
  ReadinessIndicator,
} from "@/types";

const tabs = [
  "General",
  "Agents",
  "AI Cost Controls",
  "Integrations",
  "Email",
  "Billing",
  "Safety",
] as const;

type Tab = (typeof tabs)[number];

export function SettingsView({
  integrations,
  costControls,
  readiness,
  emailStatus,
  stripeStatus,
}: {
  integrations: IntegrationStatus[];
  costControls: AiCostControlsView;
  readiness: ReadinessIndicator[];
  emailStatus: EmailProviderStatus;
  stripeStatus: StripeConfigStatus;
}) {
  const [tab, setTab] = useState<Tab>("General");
  const [settings, setSettings] = useState(settingsDefaults);
  const [emailTestState, emailTestAction, emailTestPending] = useActionState<
    EmailActionState,
    FormData
  >(sendInternalTestEmailAction, null);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Integration cards are read from Supabase. Form controls remain local UI state and are not persisted."
      />

      <div
        role="tablist"
        aria-label="Settings sections"
        className="mb-6 flex gap-1 overflow-x-auto border-b border-border"
      >
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
              tab === item
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "General" ? (
        <Card>
          <CardHeader
            title="General"
            description="Application defaults for the South Florida home-services market."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Application name" htmlFor="app-name">
              <TextInput
                id="app-name"
                value={settings.general.applicationName}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      applicationName: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Default market" htmlFor="default-market">
              <TextInput
                id="default-market"
                value={settings.general.defaultMarket}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      defaultMarket: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Default industry" htmlFor="default-industry">
              <TextInput
                id="default-industry"
                value={settings.general.defaultIndustry}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      defaultIndustry: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Default currency" htmlFor="default-currency">
              <SelectInput
                id="default-currency"
                value={settings.general.defaultCurrency}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    general: {
                      ...settings.general,
                      defaultCurrency: event.target.value,
                    },
                  })
                }
              >
                <option value="USD">USD</option>
              </SelectInput>
            </Field>
          </CardBody>
        </Card>
      ) : null}

      {tab === "Agents" ? (
        <Card>
          <CardHeader
            title="Agents"
            description="Global agent execution is disabled until later milestones."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Global agent status" htmlFor="agent-status">
              <SelectInput
                id="agent-status"
                value={settings.agents.globalStatus}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    agents: {
                      ...settings.agents,
                      globalStatus: event.target.value as "disabled",
                    },
                  })
                }
              >
                <option value="disabled">Disabled</option>
              </SelectInput>
            </Field>
            <Field
              label="Require approval for external actions"
              htmlFor="agent-approval"
            >
              <SelectInput
                id="agent-approval"
                value={
                  settings.agents.requireApprovalForExternalActions
                    ? "required"
                    : "optional"
                }
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    agents: {
                      ...settings.agents,
                      requireApprovalForExternalActions:
                        event.target.value === "required",
                    },
                  })
                }
              >
                <option value="required">Required</option>
              </SelectInput>
            </Field>
            <p className="sm:col-span-2 text-sm text-muted">
              Daily and monthly hard caps are enforced in AI Cost Controls. This
              form does not change spend limits. Agents cannot execute yet.
            </p>
          </CardBody>
        </Card>
      ) : null}

      {tab === "AI Cost Controls" ? (
        <CostControlsPanel snapshot={costControls} />
      ) : null}

      {tab === "Integrations" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {integrations.map((integration) => (
            <Card key={integration.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-medium">{integration.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {integration.purpose}
                    </p>
                  </div>
                  <ConnectionBadge status={integration.status} />
                </div>
                <Button className="mt-4" size="sm" disabled>
                  Connect
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {tab === "Email" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader
              title="Real email status"
              description="Server-derived configuration presence only. Secret values are never sent to the browser."
            />
            <CardBody className="space-y-2">
              <EmailStatusRow label="Provider key" ready={emailStatus.providerKeyPresent} />
              <EmailStatusRow label="Live-email gate" ready={emailStatus.liveEmailGateEnabled} />
              <EmailStatusRow label="From address" ready={emailStatus.fromConfigured} />
              <EmailStatusRow label="Reply-to address" ready={emailStatus.replyToConfigured} />
              <EmailStatusRow
                label="Internal test recipient"
                ready={emailStatus.internalTestRecipientConfigured}
              />
              <EmailStatusRow label="Webhook signing secret" ready={emailStatus.webhookSecretPresent} />
              <div className="pt-2 text-xs text-muted">
                Prospect sending remains approval-gated, suppression-checked, and limited to the M9.5D controlled campaign.
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Internal delivery test"
              description="Operator-only TEST send. This does not touch lead funnel state."
            />
            <CardBody>
              <form action={emailTestAction} className="grid gap-4">
                <Field label="Internal recipient" htmlFor="internal-test-recipient">
                  <TextInput
                    id="internal-test-recipient"
                    name="recipient"
                    type="email"
                    placeholder="operator@example.com"
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={emailTestPending || !emailStatus.readyForInternalTest}
                >
                  {emailTestPending ? "Sending test..." : "Send TEST Email"}
                </Button>
                {emailTestState?.ok ? (
                  <p className="text-xs text-success">
                    Test send recorded{emailTestState.messageId ? ` (${emailTestState.messageId})` : ""}.
                  </p>
                ) : emailTestState?.error ? (
                  <p className="text-xs text-danger" role="alert">
                    {emailTestState.error}
                  </p>
                ) : null}
              </form>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "Billing" ? (
        <div className="grid gap-4">
          <Card>
            <CardHeader
              title="Stripe status"
              description="Server-derived configuration presence and mode only. Secret values are never sent to the browser."
            />
            <CardBody className="space-y-3">
              <div
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold uppercase tracking-wide",
                  stripeStatus.mode === "live"
                    ? "border-danger bg-danger/10 text-danger"
                    : stripeStatus.mode === "test"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted",
                )}
              >
                {stripeStatus.mode === "live"
                  ? "LIVE -- real charges will occur"
                  : stripeStatus.mode === "test"
                    ? stripeStatus.ready
                      ? "TEST -- Ready"
                      : "TEST -- Not Ready"
                    : "MOCK"}
              </div>
              <StripeStatusRow label="Ready" ready={stripeStatus.ready} />
              <StripeStatusRow label="Secret key present" ready={stripeStatus.secretKeyPresent} />
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                <span>Key mode</span>
                <span className="text-right text-xs font-medium text-muted">
                  {stripeStatus.secretKeyMode ?? "—"}
                </span>
              </div>
              <StripeStatusRow label="Webhook secret present" ready={stripeStatus.webhookSecretPresent} />
              <StripeStatusRow label="Setup price ID present" ready={stripeStatus.setupPriceIdPresent} />
              <StripeStatusRow
                label="Managed monthly price ID present"
                ready={stripeStatus.managedMonthlyPriceIdPresent}
              />
            </CardBody>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader title="Website setup" description="$99.00 one-time price (locked)." />
              <CardBody>
                <p className="text-2xl font-semibold tabular-nums">
                  ${settings.billing.websiteSetup}
                </p>
                <p className="mt-1 text-sm text-muted">One time</p>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Managed plan" description="$39.00/month optional recurring price (locked)." />
              <CardBody>
                <p className="text-2xl font-semibold tabular-nums">
                  ${settings.billing.managedPlan}
                  <span className="text-sm font-normal text-muted">/month</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  Optional -- a customer can buy the website without subscribing.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "Safety" ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader
              title="Readiness"
              description="Server-derived configuration presence only. Secret values are never sent to the browser."
            />
            <CardBody className="space-y-2">
              {readiness.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      "text-right text-xs font-medium",
                      item.severity === "ok"
                        ? "text-success"
                        : item.severity === "attention"
                          ? "text-warning"
                          : "text-danger",
                    )}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Approval policy"
              description="These switches default to required. They do not enforce backend policy yet."
            />
            <CardBody className="space-y-3">
              {(
                [
                  [
                    "requireApprovalBeforeExternalEmail",
                    "Require approval before external email",
                  ],
                  [
                    "requireApprovalBeforeProductionDeployment",
                    "Require approval before production deployment",
                  ],
                  [
                    "requireApprovalBeforeModifyingCustomerWebsite",
                    "Require approval before modifying a customer website",
                  ],
                  [
                    "requireApprovalBeforePaymentActions",
                    "Require approval before payment or refund actions",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={settings.safety[key]}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        safety: {
                          ...settings.safety,
                          [key]: event.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-accent"
                  />
                </label>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function EmailStatusRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={cn("text-xs font-medium", ready ? "text-success" : "text-muted")}>
        {ready ? "Configured" : "Not configured"}
      </span>
    </div>
  );
}

function StripeStatusRow({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
      <span>{label}</span>
      <span className={cn("text-xs font-medium", ready ? "text-success" : "text-muted")}>
        {ready ? "Yes" : "No"}
      </span>
    </div>
  );
}
