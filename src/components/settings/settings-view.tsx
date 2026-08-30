"use client";

import { useState } from "react";
import { CostControlsPanel } from "@/components/ai/cost-controls-panel";
import { Button } from "@/components/shared/button";
import { Card, CardBody, CardHeader } from "@/components/shared/card";
import { Field, SelectInput, TextInput } from "@/components/shared/field";
import { PageHeader } from "@/components/shared/page-header";
import { ConnectionBadge } from "@/components/shared/status-badge";
import { settingsDefaults } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { AiCostControlsView, IntegrationStatus, ReadinessIndicator } from "@/types";

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
}: {
  integrations: IntegrationStatus[];
  costControls: AiCostControlsView;
  readiness: ReadinessIndicator[];
}) {
  const [tab, setTab] = useState<Tab>("General");
  const [settings, setSettings] = useState(settingsDefaults);

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
        <Card>
          <CardHeader
            title="Email"
            description="These addresses are placeholders. They do not exist and email is not implemented."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Future sender domain" htmlFor="sender-domain">
              <TextInput
                id="sender-domain"
                value={settings.email.senderDomain}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    email: {
                      ...settings.email,
                      senderDomain: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Sales sender" htmlFor="sales-sender">
              <TextInput
                id="sales-sender"
                value={settings.email.salesSender}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    email: {
                      ...settings.email,
                      salesSender: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Support sender" htmlFor="support-sender">
              <TextInput
                id="support-sender"
                value={settings.email.supportSender}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    email: {
                      ...settings.email,
                      supportSender: event.target.value,
                    },
                  })
                }
              />
            </Field>
          </CardBody>
        </Card>
      ) : null}

      {tab === "Billing" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardHeader title="Website setup" description="Mock one-time price." />
            <CardBody>
              <p className="text-2xl font-semibold tabular-nums">
                ${settings.billing.websiteSetup}
              </p>
              <p className="mt-1 text-sm text-muted">One time · UI only</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Managed plan" description="Mock monthly price." />
            <CardBody>
              <p className="text-2xl font-semibold tabular-nums">
                ${settings.billing.managedPlan}
                <span className="text-sm font-normal text-muted">/month</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Payments are not implemented.
              </p>
            </CardBody>
          </Card>
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
