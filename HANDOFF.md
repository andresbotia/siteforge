# SiteForge Handoff

For the next session. Milestone 9 Stripe Checkout + customer conversion is implemented locally, migrated to hosted Supabase, and hosted-smoke-validated. It is NOT committed, pushed, deployed, or advanced to Milestone 10.

## Project

- SiteForge: AI-assisted local-business website operations
- Next.js App Router, TypeScript, Tailwind
- Supabase with server-only `SUPABASE_SECRET_KEY`, RLS on, and no anon/authenticated table grants
- Vercel production admin app deployment
- Temporary single-admin cookie auth (`SITEFORGE_ADMIN_*`)
- xAI provider infrastructure exists; live inference remains disabled (`XAI_ALLOW_LIVE_INFERENCE` not `true`)

Repo: `https://github.com/andresbotia/siteforge`
Branch: `main`

## Completed

| Milestone | SHA | Notes |
| --- | --- | --- |
| 1 Application foundation | `1801f1df8f6feb9ad05e7107f10104b8c3b5a1f2` | Dashboard shell |
| Temporary admin auth | `1d902ea5cb830b228bc352e49bb7b45b7a11d6ba` | HttpOnly session cookie |
| 2 Supabase persistence | `c2c04f4bb8e470ff6a30208c6e3a1e564dd1f899` | Seeded fictional South Florida data |
| 2.1 Security hardening | `6fa4d85bdb8cd985df8f7f979aaa6690cc2ce172` | Revoke public table reads |
| 3 Paid-AI approval/cost controls | `48c703baeb7e263b6bad21816dcc1495baa63947` | Approval + tick accounting + reservations |
| 4 Scout | `7eeef31386d07af0d88493b1eb7b7543c3cd7b8b` | Manual $0 lead discovery |
| 5 Auditor | `68ad58761ca00863970c9cd650e4f66a431532df` | Manual $0 deterministic website audit |
| 6 Builder | `cf7f1c59f4924202cdfab0b55720299521e95557` | Manual $0 deterministic website drafts |
| 7 Preview deployments | `7c0aaee36a72568db43348b7f0f734e0ce40c918` | Hosted migration applied, smoke-tested, and validated |
| 8 Sales Agent + email approval | `42e3752c25deabe6464a318b7ae1cbbaadcf9815` | Hosted migration applied, smoke-validated, committed, and pushed |
| 9 Stripe Checkout + customer conversion | local only | Hosted migration applied and smoke-validated; ready to lock |

## Milestone 9 Summary

- Adds migration `20260830142525_stripe_customer_conversion.sql`; applied remotely.
- Adds `commercial_offers`, `stripe_checkout_sessions`, and `stripe_webhook_events` with RLS enabled and public/anon/authenticated access revoked.
- Extends `customers` and `subscriptions` for offer/Stripe conversion metadata.
- Adds `/offers`, `/offers/[id]`, lead-detail offer creation, outreach-detail offer creation, and customer detail.
- Offer approval uses existing `payment_action` approvals and binds exact offer terms, content version, and SHA-256 content hash.
- Material offer edits reset approval. Paid and checkout-created offers are locked from material edits.
- Mock Stripe provider is the default and creates deterministic `cs_mock_*` sessions without external network calls.
- Live Stripe fails closed unless explicitly enabled with server-side Stripe secrets; live checkout creation remains disabled in M9 code.
- `/api/stripe/webhook` uses raw request body, separates mock test events, requires Stripe HMAC verification for live events, and records event IDs idempotently.
- `checkout.session.completed` updates checkout status, creates or updates one customer per lead/Stripe customer, creates managed subscription rows only when selected, preserves production deployment isolation, and advances leads to `customer`.
- Hosted schema/RLS verified after migration: new payment tables exist, additive customer/subscription columns exist, RLS is enabled, and `anon`/`authenticated`/`public` grants are revoked.
- Hosted smoke used existing test-safe lead `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` and generated website `29ca4d70-a474-44d0-8470-347adba511bc`.
- Smoke offer `f19d2198-c137-4fb8-afeb-5284b1f7c067` used setup `12345` cents and managed monthly `4500` cents.
- Smoke approval `dc3e9488-36f3-4844-ae7c-d258a1d8ec00` verified exact content hash/fingerprint binding.
- Mock checkout session `cs_mock_e1bb593aafac01d716ee3ddd` was created with the mock provider only.
- Mock completion processed one webhook event, converted the lead to customer, created one customer, and created one active managed subscription.
- Duplicate webhook event processing was idempotent through the unique Stripe event ID constraint.
- `generated_websites.production_url` stayed `null`; payment did not trigger production deployment.
- No real Stripe API call, charge, email, Resend call, paid AI/API call, push, deploy, domain/DNS action, refund, or cancellation action was made.
- M10 was not started.

Validation before lock:

- `npx tsc --noEmit`
- `npm test` (182/182)
- `npm run lint`
- `npm run build`
- `git diff --check`

Before accepting real payments:

- Configure the Stripe account separately outside agent context.
- Use Stripe test/sandbox credentials first.
- Store Stripe secrets securely in server-only environment variables.
- Configure and verify the Stripe webhook secret securely.
- Validate real Stripe test-mode checkout and webhook delivery end to end.
- Keep live payments disabled until explicit human approval for the exact action.

## Milestone 8 Summary

- Adds migration `20260830100000_sales_outreach_approvals.sql` (applied remotely)
- Adds manual Sales Agent UI at `/agents/sales`, outreach list/detail UI at `/outreach`, and public outreach preview route `/o/[token]`
- Sales drafting is deterministic and $0. It does not call paid AI and does not invent contact names, emails, unsupported claims, testimonials, pricing, or outcomes.
- Missing recipient email can produce a draft, but backend approval/send paths block until a valid recipient is present.
- Outreach links use separate `sfo_` attribution tokens. The database stores only SHA-256 hash plus short hint; raw M7 preview tokens and M7 token hints are never reused to build outreach URLs.
- `/o/[token]` resolves by hashing the token, verifies active preview state and trusted `WebsiteSpec`, hides admin chrome, sets `robots: noindex,nofollow`, and fails closed.
- Preview events can be attributed to `outreach_id`; raw IP is not stored and daily visitor keys remain pseudonymous.
- Send approvals bind the exact recipient, subject, body, preview deployment, content version, and attribution token hash. Editing recipient/subject/body invalidates pending or approved send approval.
- Email provider abstraction is present, but only the deterministic mock provider is wired. Mock sends create fake `msg_mock_*` IDs and make no external network calls.
- No Resend integration, real email delivery, production deployment, DNS/domain change, payments, or paid AI call is included in this local M8 implementation.
- Hosted smoke exposed and fixed an attribution timestamp bug: token derivation now canonicalizes `attribution_token_created_at`, so Supabase `timestamptz` serialization cannot break mock send/token reconstruction.

Hosted smoke validation:

- Lead: `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` / Atlantic Drain Plumbing
- Generated website: `29ca4d70-a474-44d0-8470-347adba511bc`
- Source audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Preview approval: `b982b2b3-f7b2-45a2-a1f3-2e9abb5a5df1` (`website_deployment`, executed)
- Smoke preview deployment: `0eec95fb-c736-4930-bd75-90e88ad18989` (created active, validated, then revoked)
- Sales run: `bbf4951b-384b-4915-b998-a9ce1c8642a2`
- Outreach: `9f867b34-d43b-47ff-aa49-c35240ee5b6e`
- Initial send approval invalidated after edit: `6d9d6fe6-b58f-44d7-94af-5e1d2c817adb`
- Final send approval: `0b2ff684-6ffe-465a-afd7-f2cf2a5245c8`
- Mock provider message ID: `msg_mock_8eb9e069a80e0efc`
- Active M7 preview required before Sales drafting.
- Separate opaque `sfo_` outreach attribution verified; only hash plus hint persisted.
- Recipient email was absent from the public URL and public page.
- `/o/[token]` returned 200 while active, had no admin chrome, used the trusted Builder renderer, and included `noindex,nofollow`.
- Invalid token and revoked token returned 404.
- Outreach-attributed preview tracking validated: human view, repeated human views sharing a visitor key, bot-likely view, and `phone_cta_clicked`.
- Coarse geo was null in local smoke; no browser GPS or paid geo service was used.
- Raw IP was not persisted.
- Approval binding to exact recipient, subject, body, preview deployment, content version, and attribution token hash was validated.
- Editing body invalidated the initial approval; fresh approval was required before mock send.
- Mock send recorded `send_attempted` and `sent`, blocked duplicate send, and did not create delivered/opened/replied events.
- Smoke preview was revoked afterward. Historical outreach and preview events remain. `generated_websites.production_url` remains `null`.
- No real email was sent. No Resend call was made. No paid AI/API call was made.

Validation passed:

- `npx tsc --noEmit`
- `npm test` (154/154)
- `npm run lint`
- `npm run build`
- `git diff --check`

Stop point: review the local M8 diff, then commit/push only after human approval. Do not start Milestone 9 until M8 is explicitly locked.

## Milestone 7 Summary

- Adds migration `20260830000000_preview_deployments_tracking.sql` (applied remotely)
- Tables: `preview_deployments`, `preview_events` with RLS enabled and `anon`/`authenticated`/`public` access revoked
- Public preview publishing requires explicit `website_deployment` approval
- Approval execution mints a one-time visible `sfp_` token; only SHA-256 hash and token hint are stored
- Public route `/p/[token]` renders trusted Builder specs without admin chrome (`robots: noindex, nofollow`)
- Invalid, expired, revoked, or missing-token previews return 404 (safe fail-closed)
- `/api/preview-events` accepts bounded beacon events and returns 204 without leaking token validity
- View and CTA events classify likely humans, bots, browser, and device
- Visitor keys are preview-scoped and daily rotating; raw IP is never persisted
- Admin website detail shows preview status, token hint, analytics, request approval, and revoke controls
- Internal preview `/websites/[id]/preview` remains authenticated
- TypeScript passed: `npx tsc --noEmit`
- Lint passed: `npm run lint`
- Tests passed: 134/134 (`npm test`)
- Production build passed: `npm run build`
- No production deployment, email, DNS/domain, payments, or paid AI/API calls were added ($0.00 cost)

### Milestone 7 Hosted Smoke Test Validation

- Lead: `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` / Atlantic Drain Plumbing
- Website: `29ca4d70-a474-44d0-8470-347adba511bc`
- Source audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Builder run: `f831dfde-9312-422c-be3d-a2f4ad15f34c`
- Approval request: `91cb4e0c-8257-487f-9ebd-6182b047faa7` (`website_deployment`, status `pending` -> `executed`)
- Preview deployment: `d20631cc-3963-4625-b151-ca2fb673542f` (status `active` -> `revoked`)
- Token Hint: `KY0rJhyc` (SHA-256 hash stored, raw token not persisted)
- Public route resolution: Active token resolved HTTP 200 with structured `WebsiteSpec`
- Tracking validation: 2 views (human-likely, desktop, chrome) + 1 CTA click (`phone_cta_clicked`). Coarse geo parsing was validated using synthetic request headers. No paid geo service or browser geolocation was used. Real deployed requests may provide platform-derived coarse geo or null values.
- Daily pseudonym: `visitor_key` matched across repeat visits without storing raw IP
- Aggregated analytics verified: 3 total events, 2 human views, 1 CTA click, 1 unique visitor
- Revocation verified: Deployment status `revoked`, `revoked_at` set, public token immediately returns 404 (fails closed)
- Historical events preserved: 3 `preview_events` remain intact post-revocation
- Production isolation: `generated_websites.production_url` remained `null` throughout
- Final smoke preview state: **REVOKED**

M8 must connect outreach emails to unique tracked preview links so SiteForge can measure the funnel:

sent -> delivered -> opened (low-confidence) -> preview clicked/viewed -> return visit -> CTA interaction -> replied -> interested -> customer

Preview analytics should continue to support approximate location, approximate visitors/repeat visits, likely-human vs likely-bot/scanner activity, and attribution to the outreach link. Do not store raw IP addresses long term.

## Milestone 6 Summary

- Deterministic/manual Builder
- $0 build path
- No xAI required
- Template-first architecture
- `WebsiteSpec` structured trusted data
- No arbitrary executable JSX/JS/HTML
- Allowlisted templates: `home-services-modern`, `restaurant-modern`, `professional-services-modern`
- Factual integrity and provenance
- Provenance states: `sourced`, `derived`, `placeholder`, `omitted`
- Auditor findings mapped to Builder fixes
- Trusted renderer validates persisted specs before rendering
- Internal authenticated preview only
- No public prospect preview yet
- Insert-only generated website history
- Monotonic `audited` to `website_built` progression
- `agent_runs` / `agent_tool_calls` audit trail
- Migration `20260829230000_builder_generated_websites.sql` applied remotely
- Authenticated Builder smoke test completed

Builder smoke artifact:

- Lead: `ee0aa3e0-78f9-478a-bdba-f5db6e7db1d3` / Atlantic Drain Plumbing
- Source audit: `d1c6b82e-2d85-43b1-952c-ccd32affc4a9`
- Builder run: `f831dfde-9312-422c-be3d-a2f4ad15f34c`
- Generated website: `29ca4d70-a474-44d0-8470-347adba511bc`
- Template: `home-services-modern`
- Build version: `builder.v1`
- `production_url`: `null`

Validation:

- `WebsiteSpec` passed trusted validation
- Factual-integrity verification passed
- Internal preview verified
- Preview remains behind admin auth
- 124 tests passed
- Zero paid AI/API calls
- Zero external monetary cost

## Current Safety State

- `XAI_ALLOW_LIVE_INFERENCE` remains disabled
- Scout deterministic path remains $0
- Auditor deterministic path remains $0
- Builder deterministic path remains $0
- Sales deterministic draft path remains $0
- Public prospect previews exist only after human approval and only as tokenized previews
- Outreach send execution is mock-only; no real email is sent
- No payments
- No domain/DNS automation
- Supabase public application-table access remains revoked

## Next Milestone

Milestone 9 is not started. Do not start it unless explicitly asked after M8 is reviewed, remotely migrated, smoke-tested, and locked.
