# SiteForge Agents

Specialized agent packages. Execution lives under `src/lib/*` and `src/data/*`, not in these placeholder directories.

## Agents

| Agent | Status | Purpose |
| --- | --- | --- |
| Scout | Manual | Discover strong local businesses with poor websites |
| Auditor | Manual | Analyze existing websites and produce structured findings |
| Builder | Manual | Generate improved website drafts from audited leads |
| Sales | Disabled | Draft personalized outreach |
| Manager | Disabled | Handle requested updates for paying managed customers |

## Credential rule

Agents must never directly receive privileged infrastructure credentials.

That includes credentials for Supabase, Vercel, Resend, Stripe, GitHub, and similar systems.

Agents request actions through backend-controlled tools. The backend validates input, checks approval when required, performs the action with server-held credentials, logs the result, and returns a structured response.

Milestone 7 public preview publication follows this rule: Builder drafts can be shared only after a human approves a `website_deployment` request. The public token is minted by server code, stored only as a hash, and previews remain separate from production deployments.

## Approval rule

- Read actions may become autonomous.
- Internal writes may become autonomous depending on scope.
- External side effects require human approval initially: email, production deploys, customer site changes, charges, refunds, destructive infrastructure changes, and paid AI usage.
