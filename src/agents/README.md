# SiteForge Agents

This directory is a placeholder for future specialized agents.

No agent is implemented in Milestone 1. Directories exist so later work has a stable home without mixing agent logic into UI components.

## Planned agents

| Agent | Purpose |
| --- | --- |
| Scout | Discover strong local businesses with poor websites |
| Auditor | Analyze websites, SEO, mobile usability, and conversion quality |
| Builder | Generate improved websites from qualified leads |
| Sales | Draft personalized outreach |
| Manager | Handle requested updates for paying managed customers |

## Future contents of each agent

Each agent directory should eventually contain:

- system prompt
- role definition
- allowed tools
- restrictions
- permissions
- execution logic
- structured output schema
- cost tracking
- audit logging

## Credential rule

Agents must never directly receive privileged infrastructure credentials.

That includes credentials for Supabase, Vercel, Resend, Stripe, GitHub, and similar systems.

Agents will request actions through backend-controlled tools. The backend validates input, checks approval when required, performs the action with server-held credentials, logs the result, and returns a structured response.

## Approval rule

- Read actions may become autonomous.
- Internal writes may become autonomous depending on scope.
- External side effects require human approval initially: email, production deploys, customer site changes, charges, refunds, and destructive infrastructure changes.

## Current status

All agents are **not configured**. The dashboard shows sample activity and empty spend so the operating UI can be reviewed without implying live execution.
