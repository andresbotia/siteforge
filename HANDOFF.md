# SiteForge Handoff

For the next session. Milestones 1 through 9 are locked, with the latest M9.5A readiness lock at `bfbf41181fb8c1c1ba3ba56ab38f5c2606b8f007`. M9.5B real-prospect preparation and Auditor calibration are locked, with the M9.5B Auditor Calibration lock at `1358caad47c46b9832f875ec1e62d5834043906b`. M9.5C guarded real email integration/internal send is complete: Resend is configured server-side, the sending domain was verified externally, the live-email gate was exercised for one operator-only test, and the test delivered without prospect/customer funnel mutation. M9.5D first controlled prospect campaign preparation is current. The operator deferred credential rotation for now; credential rotation is still required before sensitive customer/payment data, live payment use, or broader production operation. This is NOT M10.

## Session: M9.9 -- lifecycle states and the payment follow-up email

Session start commit `918ea4e` (M9.7 customer purchase links, prior session). One additive-only migration created (`supabase/migrations/20260902000000_lead_lifecycle_and_follow_up_outreach.sql`), **not applied** to the hosted project by this session -- the Supabase CLI is not installed in this environment and applying schema to the shared hosted database is an operator action. No live Stripe call, no live email send, no paid AI, no deployment, no DNS, no prospect contacted. Mock providers only.

### Task 1 -- lead lifecycle states

The transition rules now live in exactly one place, `src/lib/leads/lifecycle.ts`, as an explicit `LEAD_LIFECYCLE_TRANSITIONS` table rather than scattered guards. `src/lib/scout/status.ts` keeps its public API (`resolveMonotonicLeadStatus`/`resolveScoutLeadStatus`/`isLeadStatus`) but now delegates to that table, so Scout, Auditor, the outreach send path and the Stripe webhook all resolve through the same rules. Every pre-M9.9 behavior is preserved and directly asserted by tests (forward jumps that skip stages still work -- the send path moves `audited` straight to `contacted`, the webhook moves `contacted` straight to `customer`).

Monotonicity is broken deliberately in exactly two places: `archived` is reachable from every state (including `customer` and `rejected`) and always requires a non-null reason, and `interested -> contacted` is allowed for a prospect who went quiet. `rejected` was deliberately **not** widened -- it stays reachable only from `discovered`, exactly as Scout always treated it; `archived` is the new general-purpose exit that covers later stages. `archived` is terminal: nothing transitions out of it. That is a literal reading of "every other transition stays monotonic," and it means an accidental archive cannot be undone from the console -- see "Open questions" below.

`interested` needed no schema or type change; it was already an allowed lead status before this milestone. Only `archived` is genuinely new. Operator UI is a small Lifecycle card on `/leads/[id]` that offers exactly the table's allowed targets and requires a reason when archiving; the server action re-checks the table independently, and `leads_archived_reason_check` enforces the reason in Postgres as well.

### Task 2 -- offer amount lock

`/offers/[id]` and the create-offer form no longer accept a typed cent amount. Both submit a plan KEY, and `src/app/actions/offers.ts` re-derives amounts and the managed-plan flag server-side from `src/lib/payments/plans.ts` (`website_only` = $99 setup; `website_plus_managed` = $99 setup + $39/month). An unrecognized key falls back to a configured plan, never to a client number, so no request shape can create the drift that would hard-fail at checkout. `LiveStripeProvider`'s own price-lock check is **untouched** and remains the last line of defense; `offerAmountsMatchConfiguredPrices()` mirrors its predicate (without importing the Stripe SDK) so an operator is warned before an email goes out rather than after a customer clicks a dead link. An existing offer whose amounts already drifted renders an explicit warning on the offer page.

### Task 3 -- payment follow-up outreach kind

`outreach.kind` (`cold_outreach` | `follow_up`, default `cold_outreach`) plus `commercial_offer_id` and `purchase_token_hash`, with a CHECK that a follow-up carries both bindings and a cold email carries neither. There is **no second send path**: `requestOutreachSendApproval`, `approveOutreachSendApproval` and `sendApprovedOutreach` are kind-aware, and `verifyApprovedOutreachContent` is one verifier for both kinds. `computeOutreachContentHash` is byte-identical for cold outreach, so hashes already stored on existing rows and inside already-granted approvals stay valid; `computeFollowUpContentHash` uses a domain-separated input so the two kinds can never collide or be swapped past each other's approval.

A follow_up approval binds recipient, subject, body, commercial offer id, purchase token hash, content version, and a distinct payload action (`send_follow_up_email`). Editing any bound field recomputes the hash and invalidates the approval, exactly as on the cold path.

The raw `sfb_` purchase link is still never persisted. The draft body carries a `{{PURCHASE_LINK}}` placeholder (mirroring the cold path's `{{OUTREACH_PREVIEW_LINK}}`), the approval binds only the token HASH, and the operator pastes the real link at send time -- the backend verifies `hashPurchaseToken(pasted)` against the bound hash before substituting it. This keeps the M9.7 invariant intact at the cost of one extra operator paste.

Duplicate-send blocking generalized the previous implicit "one outreach per lead" assumption instead of bypassing it: `isDuplicateSendBlocked()` blocks the row's own re-send and any sibling of the SAME kind already sent to that lead, so an earlier cold email never blocks a follow-up but a second follow-up is blocked.

One real bug this surfaced: the post-send lead advance (`resolveMonotonicLeadStatus(lead.status, "contacted")`) is now scoped to cold outreach only. A follow-up goes to a lead that is already `interested`, and the new table legitimately allows `interested -> contacted`, so leaving it unscoped would have silently walked leads backwards after every follow-up send.

### Task 4 -- cold email additions

`leads.suggested_domain`, filled manually by an operator on the lead detail page and shape-validated (`src/lib/prospects/suggested-domain.ts` -- bare domain only, no scheme/path/port; a malformed value is rejected rather than silently cleaned). SiteForge performs no registry/WHOIS/DNS lookup anywhere, and the cold copy phrases the domain strictly as an example ("just as an example... We have not registered or reserved anything"), asserted by a test that the word "available" never appears in the body. Cold copy now also states the $99 setup and optional $39/month plan, read from the same locked constants the offer and Stripe Prices use.

Also added (beyond the literal ask, flagged deliberately): opt-out language in the cold body. `hasUnsubscribeLanguage()` has always been a hard gate on real sends, but `composeSalesDraft` never emitted any -- every cold draft would have failed that check at send time. Task 4 asks the follow-up to carry "the same unsubscribe/opt-out language the cold path requires," which only means something if the cold path actually emits it.

### Task 5 -- roadmap surface

`src/lib/roadmap/roadmap.ts` exports a typed `ROADMAP` array (id, title, status, goal, exit criteria, notes) covering M1-M9.7 as done, M9.8/M9.9 current, M10 Operator Console and M10.5 Visual System Pass next, then M11 Live Payment Rehearsal, M12 First Campaign, M13 First Customer, plus a backlog section (Manager agent, production deployment and DNS, Scout scaling, reply detection, refund handling, design master materialization, Supabase Auth). Rendered read-only at `/roadmap` behind the existing admin session. No table, no CRUD -- git history is the audit trail. One nav item was added; navigation was otherwise untouched, and no dashboard or styling work was done (that is M10/M10.5).

### Validation

`npx tsc --noEmit`, `npm test` (622/622, up from 565), `npm run lint`, `npm run build`, `git diff --check` all clean. 57 new tests: the transition table (coverage of every status, archived-from-anywhere, archive-requires-reason, the single backward edge, no other backward edge, forward jumps, archived terminal, rejected unchanged, no-op transitions, and Scout-behavior preservation), follow-up approval binding and per-field invalidation, cross-kind approval refusal and hash-domain separation, per-kind duplicate-send blocking, follow-up send-eligibility refusal for each condition including a non-interested lead, the offer plan lock's agreement with the provider price lock, and the cold email's domain/pricing/opt-out copy.

### Operator action required

- Apply `supabase/migrations/20260902000000_lead_lifecycle_and_follow_up_outreach.sql` with the normal `supabase db push` flow before using lifecycle states or drafting a follow-up. It is additive only (two new lead columns, `suggested_domain`, three new outreach columns, widened `leads_status_check`, three new CHECK constraints, two indexes); nothing is renamed, dropped, or rewritten.
- Sending a payment follow-up requires pasting the customer purchase link at send time. Copy it when you publish the link -- if it is lost, revoke and republish, which correctly invalidates any follow-up approval bound to the old hash.

### Open questions / deliberately not done

- **Archived is terminal.** An accidental archive cannot be reversed in the console. That follows the instruction literally, but it conflicts with the repo's "prefer reversible actions" rule. Un-archiving would need one more explicit table edge (e.g. `archived -> contacted`, or restoring to the pre-archive status recorded at archive time) and an operator decision about which.
- Lead status is still set entirely by hand; reply detection (backlog) is what would make `interested` a real signal rather than operator bookkeeping.
- No live payment rehearsal was performed, so the follow-up path has not been exercised against real Stripe behavior end to end. That is M11.

## Session: M9.6 -- real Stripe integration (test/live mode, still not credentialed)

Session start commit `4b363f8` (prior session, above). One commit, pushed. One additive-only migration created and committed but **not applied** to the hosted Supabase project (no destructive/renaming change; safe to apply whenever the operator is ready). No paid Stripe API call occurred -- `STRIPE_SECRET_KEY` was not present in this environment.

**NO real prospect outreach should be sent until this is live-validated.** M9.5D outreach remains paused for that reason, unchanged by this session.

### What this session did

Converted the M9 mock-only Stripe seam into a real provider path, without rewriting it. `MockStripeProvider` is untouched and remains the default. `LiveStripeProvider` (`src/lib/payments/provider-core.ts`) now actually calls the official `stripe` npm SDK (`^22.6.1`) instead of throwing `live_stripe_checkout_not_enabled_for_milestone_9`.

- **Mode**: `STRIPE_ALLOW_LIVE_PAYMENTS=true` (the existing, AGENTS.md-documented gate) is unchanged -- unset/not `"true"` always means MOCK, everywhere, with no live Stripe SDK call. Within "live enabled," TEST vs LIVE is read from the Stripe secret key's own prefix (`sk_test_`/`sk_live_`) rather than a second, independently-settable env var, so the displayed mode can never drift from what the key actually authorizes (`src/lib/payments/config.ts`).
- **Pricing stays locked at $99 one-time / $39 optional monthly** (`DEFAULT_SETUP_AMOUNT_CENTS`/`DEFAULT_MANAGED_MONTHLY_AMOUNT_CENTS`, unchanged from M9). `LiveStripeProvider` never sends a client- or offer-typed dollar amount to Stripe -- it always references two fixed, configured Stripe Price IDs, and it now also **refuses to create a live/test session at all** if the calling offer's own recorded amounts have drifted from that locked price. This matters because the existing offer-drafting UI (`/offers/[id]`) still lets an admin type an arbitrary amount for internal drafting/messaging purposes; that flexibility is preserved, but the money-moving path enforces the lock independently as a last checkpoint.
- **Checkout modeling**: website-only uses `mode: "payment"` with one line item (the setup Price). Website+managed uses `mode: "subscription"` with **both** the one-time setup Price and the recurring monthly Price as line items in the same Checkout Session -- Stripe's own documented pattern for adding a one-time fee to a new subscription (the one-time price bills once on the first invoice; only the recurring price renews). No staged/multi-session flow was needed or built.
- **Success/cancel URLs** are now real and SiteForge-controlled (`src/lib/payments/checkout-urls.ts`): built from a trusted app origin (`SITEFORGE_APP_URL`, or Vercel's own `VERCEL_URL`, or `localhost:3000` locally) plus the fixed `/checkout/success` or `/checkout/cancel` path and the offer's own UUID -- never a client-supplied redirect target. New public (unauthenticated) pages at those paths (`src/app/checkout/success|cancel/page.tsx`, allowlisted in `src/proxy.ts` the same way `/p/[token]`/`/o/[token]` already are) read `commercial_offers.status` fresh on every render and explicitly do **not** treat Stripe's `session_id` query parameter as proof of payment -- only the verified webhook-updated offer status is authoritative, exactly per this session's brief.
- **Webhook verification**: the real (non-mock) path in `src/app/api/stripe/webhook/route.ts` now uses the official SDK's `Stripe.webhooks.constructEventAsync()` against the raw request body (`request.text()`, never a JSON re-serialize) instead of the hand-rolled HMAC check. That hand-rolled check (`verifyStripeWebhookSignature`, `src/lib/payments/webhook.ts`) is kept, unchanged and still tested, for the mock-mode test path.
- **Webhook events handled**: `checkout.session.completed` (unchanged logic) plus five new kinds -- `checkout.session.async_payment_succeeded` (treated identically to completed), `checkout.session.async_payment_failed` (marks the session `failed`), `customer.subscription.updated` (syncs status via `mapStripeSubscriptionStatus`), `customer.subscription.deleted` (marks `cancelled`), `invoice.paid` (marks `active`, updates `current_period_start/end` from the invoice's own stable fields), `invoice.payment_failed` (logs an activity event; does not itself force a status change, since Stripe also emits `customer.subscription.updated` with `past_due`/`unpaid` for the same failure). `customer.subscription.created` and every other Stripe event type are safely acknowledged (200) without further action. `normalizeStripeWebhookEvent()` now returns a discriminated union (`NormalizedStripeWebhookEvent`) instead of a single nullable shape; the old exported type name is preserved as an alias.
- **Idempotency**: unchanged mechanism, now shared across all new event kinds -- every handler inserts into `stripe_webhook_events` keyed by Stripe's own event ID first; the table's pre-existing unique constraint is the real guard, a Postgres unique-violation on that insert is treated as "already processed," not an error, and nothing relies on in-memory state.
- **Subscription status migration**: `subscriptions.status`'s CHECK constraint only allowed `active/pending/cancelled` (the M9 mock flow's values). A small, additive-only migration (`supabase/migrations/20260901020000_stripe_subscription_status.sql`) widens it to also allow `trialing/past_due/unpaid/inactive` so real Stripe subscription lifecycle states can be recorded -- nothing renamed, nothing removed, no data rewritten. **Not yet applied to the hosted project** (no live/test key exists in this environment to exercise it against yet, and applying a migration to the shared hosted database is exactly the kind of action this session chose not to take without it being load-bearing for anything the operator asked for right now). Apply with the normal `supabase db push` flow before the first real subscription webhook is expected.
- **Fulfillment stays gated**: payment confirmation only ever marks a `customers` row `pending_setup` (unchanged from M9) and logs an activity event -- nothing in this session deploys a site, touches DNS, or triggers any other irreversible customer action from a webhook.
- **Deferred, as instructed**: refunds (none existed to gate -- confirmed no refund-creating code exists anywhere in the payments module), Stripe Customer Portal, Stripe Tax, and a redundant payment-confirmation email system (Stripe's own receipt/email settings, configured in the Stripe Dashboard, are the intended mechanism; SiteForge's outreach email infrastructure was not touched).

### Mode visibility (admin UI)

`/offers/[id]` and its checkout-gate card now show MOCK/TEST/LIVE explicitly (LIVE is styled as a clear warning), and the "Create Checkout" button label includes the current mode so an admin can never mistake which one they are about to trigger. `/settings`'s existing Stripe readiness indicator was changed from a bare "live payments enabled/disabled" boolean to the same MOCK/TEST/LIVE + configuration-readiness status. No secret value is ever displayed anywhere.

### Configuration required before test-mode validation (operator action, not done by this session)

- In the Stripe Dashboard (test mode): create/confirm a **$99.00 USD one-time** Price for "SiteForge Website Setup" and a **$39.00 USD monthly recurring** Price for "SiteForge Managed Website."
- Configure a test-mode webhook endpoint pointing at `<your test/staging origin>/api/stripe/webhook`, subscribed to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- Server-only env vars (local `.env.local` and Vercel's server environment -- never `NEXT_PUBLIC_`): `STRIPE_SECRET_KEY` (test key, `sk_test_...`), `STRIPE_WEBHOOK_SECRET` (from the webhook endpoint's signing secret), `STRIPE_SITE_SETUP_PRICE_ID`, `STRIPE_MANAGED_MONTHLY_PRICE_ID`, `STRIPE_ALLOW_LIVE_PAYMENTS=true` (this is what actually turns on the real -- test-mode -- provider; despite the name, with a `sk_test_...` key this stays in Stripe TEST mode, never live). Optionally `SITEFORGE_APP_URL` if not relying on Vercel's automatic `VERCEL_URL`.
- Apply the pending migration (`supabase db push`) before relying on real subscription-status webhooks.
- Validate: create an offer, approve it, create checkout, pay with a Stripe test card, confirm the webhook updates `commercial_offers.status` to `paid` and `/checkout/success` reflects it. Stripe CLI (`stripe listen --forward-to localhost:3000/api/stripe/webhook`) is the standard way to receive test webhooks locally if not using a public staging URL; it was not installed or required by this session.
- Switching to live mode later: repeat the above in Stripe's live dashboard, use `sk_live_...`/live Price IDs/a live webhook endpoint, keep `STRIPE_ALLOW_LIVE_PAYMENTS=true`. The mode label will read LIVE automatically the moment a `sk_live_` key is present -- no separate flag to remember to flip.

### Validation

`npx tsc --noEmit`, `npm test` (553/553, up from 513), `npm run lint`, `npm run build`, `git diff --check` all clean. The build succeeds with `STRIPE_SECRET_KEY` absent, as required. 40 new/adapted tests in `src/lib/payments/payments.test.ts` cover mode resolution, price-lock enforcement (a mismatched offer amount makes `LiveStripeProvider` refuse to call Stripe at all), Checkout-modeling line items for both purchase options, URL construction, the new webhook event normalization (including malformed-payload fail-soft cases), and source-scan checks that Scout/Sales cannot reach payments code and that the webhook route/success page never trust unverified input. The webhook route's own DB-persistence dispatch (`src/data/payments.ts`, `server-only`) is not directly unit-tested, consistent with how the rest of the `src/data/` layer in this repo is tested (via the hosted M9 smoke test, not plain unit tests) -- this is an existing pattern, not a gap newly introduced here.

### Live/test Stripe validation status: **PENDING OPERATOR SETUP**

No `STRIPE_SECRET_KEY` was present in this environment. No live or test Stripe network call was made. Nothing above was faked -- every behavior is covered by mocked/injected tests instead.

## Session: Scout V1.1 -- Google Places discovery + business-strength qualification

Session start commit `2021d10` (prior session, above). One commit, pushed. No migration -- Google Place ID/business status/rating tiers all persist into the existing `leads.inspection_summary` JSON column, and the monthly usage guard reuses the existing `agent_tool_calls` table. `GOOGLE_PLACES_API_KEY` was **not configured** in this environment during this session -- see "Live validation status" below.

### Why

Real Scout V1 validation (prior session) ran Broward County landscaping through the $0 OpenStreetMap Overpass provider and returned three candidates -- Verdant Lyfe, The Time Is Now Design & Build, Perfect Choice Nursery -- as if their missing website field were meaningful "no website" opportunity evidence. Manual verification found all three have real, working, professionally-adequate websites; OSM simply had no website tag for them (OSM is community-maintained and frequently incomplete, not a business-controlled record). Scout was about to recommend spending Designer capacity on businesses that did not need it. This session fixes the root cause: OSM data quality, not Scout's scoring math.

### Google Places' role vs. OSM's role

Google Places API (New) -- Text Search -- becomes the **preferred** discovery provider when `GOOGLE_PLACES_API_KEY` is configured server-side, because Google Business Profile data is business-controlled (owners actively manage rating, review count, and website fields) where OSM is community-maintained and often stale/incomplete. OSM Overpass remains the **$0 fallback**: used automatically when Google is unconfigured, or when the monthly Google request ceiling has been reached this month. Neither provider was deleted or weakened; `src/lib/scout/run.ts`, `scoring.ts`'s point thresholds, and the existing SSRF/inspection stack are all unchanged in this session -- only the businessStrength reason labels and one new opportunity-input case were added.

### Google fields used (exact field mask)

`places.id, places.displayName, places.formattedAddress, places.businessStatus, places.rating, places.userRatingCount, places.websiteUri, places.nationalPhoneNumber, places.location, places.primaryType` -- never a wildcard mask. No review text, photos, generative summaries, or opening hours are requested (`src/lib/scout/providers/google-places.ts`).

### Review/rating tiers (`src/lib/scout/rating-tiers.ts`)

Review-volume: 0-24 EMERGING, 25-99 ESTABLISHED, 100-499 STRONG, 500-999 VERY_STRONG, 1000+ MAJOR_LOCAL_PRESENCE. Rating: 4.5-5.0 EXCELLENT, 4.0-4.49 STRONG, 3.5-3.99 VIABLE, 3.0-3.49 LOWER_PRIORITY, below 3.0 WEAK. Missing rating/review count is always `UNKNOWN`, never coerced to zero -- an explicit `0` review count is a real EMERGING fact, distinct from unknown. These tiers are a labeling layer on top of `scoring.ts`'s existing, unmodified point thresholds, which already produce the correct qualitative ordering (a 4.6-star/487-review business outranks a 4.9-star/11-review one) once real numbers are supplied -- the math didn't need to change, only the input quality did.

### Website-resolution semantics -- the actual fix

`src/lib/scout/website-status.ts` now has five statuses, not four: `working_standalone_website`, `website_unreachable`, `social_or_directory_only`, **`website_not_listed_by_provider`** (new), `no_standalone_website_unverified`. The split between the last two is by source confidence: Google explicitly having no `websiteUri` is real, moderately-trustworthy evidence (business-controlled data); OpenStreetMap silence proves nothing. In the commercial-score composite (`commercial-score.ts`), `website_not_listed_by_provider` gets a conservative opportunity input of 65 (well below `social_or_directory_only`'s 85, and never the previous behavior of treating provider silence as maximal opportunity); `no_standalone_website_unverified` still uses Scout's raw, unboosted opportunity score. A working `websiteUri` from Google flows into the exact same `inspectWebsite()` call OSM-sourced URLs already used -- SSRF protections are untouched and apply identically regardless of source (directly tested: a Google-sourced URL pointing at the AWS metadata IP is blocked before any fetch).

### Business-strength scoring

`scoreBusinessStrength()` (`scoring.ts`) no longer coerces a missing rating/review count to zero internally -- both are checked explicitly so "unknown" and "a real zero" are never conflated, and reasons now include the tier name (e.g. "327 reviews (STRONG tier)..."). A new, additive signal: Google's `businessStatus`. `OPERATIONAL`/absent is never penalized; `CLOSED_TEMPORARILY` halves the score; `CLOSED_PERMANENTLY` hard-caps the score at 10 and also overrides the commercial recommendation straight to SKIP regardless of an otherwise-strong weighted score (`commercial-score.ts`). The point thresholds/weights themselves are unchanged -- Google just supplies more reliable inputs than OSM ever could.

### Place ID, dedupe, and provenance

`DiscoveredBusiness`/`NormalizedBusiness` gained `placeId` and `businessStatus`. `findDuplicate()` (`dedupe.ts`) now checks Google Place ID first (read back from a prior lead's `inspection_summary.google_place_id`, via a new `ExistingLeadRecord.googlePlaceId` -- no new column) before falling back to the existing domain/phone/name matching. `inspection_summary` now also carries `business_status`, `rating_tier`, `review_volume_tier`, and each source's own provenance (`provider`, `query`, `retrievedAt`) -- never raw Google response bodies, never review text.

### Cost / quota safety

Exactly one Text Search request per Scout run (no pagination, no retries -- enforced by construction, not just documented). A `checkGoogleMonthlyUsageGuard()` in `src/data/scout.ts` reuses the existing `agent_tool_calls` table (already recording every Scout discovery call) to count this UTC month's `provider = 'google_places'` calls against a default ceiling of 300/month, operator-overridable via `GOOGLE_PLACES_MONTHLY_REQUEST_CEILING`; exceeding it falls back to Overpass for the rest of the month. The existing hard candidate max (50) and per-run external-request ceiling (300, from the prior Scout V1 session) are unchanged and apply identically regardless of provider.

### Configuration required (operator action, not done by this session)

- Enable the **Places API (New)** in the relevant Google Cloud project.
- Set the server-only environment variable `GOOGLE_PLACES_API_KEY` (never `NEXT_PUBLIC_`-prefixed) locally and in Vercel's server environment.
- Billing must be attached to the Google Cloud project -- Places API (New) requires it even within the free monthly allowance.
- Recommended key restriction: an API-restricted key limited to the Places API only (not an unrestricted key). Application restriction (IP or none, since calls originate server-side from Vercel/local, not a browser) is an operator/Google-Cloud-console decision outside this repo.
- No key was created, requested, fabricated, committed, or printed by this session.

### Live validation status: **PENDING OPERATOR SETUP**

`GOOGLE_PLACES_API_KEY` was not present in this environment's `.env.local` during this session. No live Google API call was made -- confirmed by design (the provider fails closed to "not configured" before ever constructing a request) and by the absence of the key. All behavior above is covered by mocked-response tests, including regression fixtures for the three real businesses that exposed the original failure (their names/URLs appear only as mock test data, never in production logic -- directly asserted by a test reading the provider's own source). The next real action is the operator configuring the key per above, after which one bounded real run (e.g. Broward County landscaping, limit 10) should be performed to confirm live behavior before broader use.

### Dashboard

`/agents/scout` shows whether Google Places is configured and which provider is preferred; the run list shows each run's provider. `/agents/scout/[runId]` gained a provider-selection note banner, a Provider column, a Rating/Reviews column (with tier labels), a business-status flag for a closed business, and four new filters (3.0+ stars, 4.0+ stars, 100+ reviews, 500+ reviews) alongside the existing BUILD/REVIEW/SKIP/no-website/weak-website filters. `/leads/[id]`'s existing "Commercial potential (Scout)" card is unchanged and continues to work with either provider's data.

### Human gates (unchanged)

Scout still only ever writes to `leads`; it has no import of Designer's job-creation/prompt/worker code anywhere under `src/lib/scout/` (directly tested). BUILD means "a human should consider spending Designer capacity," never permission to spend it automatically. No paid AI call occurs anywhere in this session's code.

### Validation

`npx tsc --noEmit`, `npm test` (513/513, up from 460), `npm run lint`, `npm run build`, `git diff --check` all clean. The build and full test suite pass with `GOOGLE_PLACES_API_KEY` absent, as required.

### Next milestone

Stripe work is the next milestone after Scout V1.1 is live-validated with a real Google Places key -- explicitly out of scope for this session and untouched.

## Designer Job / local Claude Code worker session (current, parallel to M9.5D)

This session implemented a new, parallel architecture track the operator requested directly (not part of the M9.5A-D roadmap text above, and does not change M9.5D's status or advance the first controlled prospect campaign). It does not touch real prospect/customer/payment data and made no external side effect. See "Session: Designer Job system" below for the full detail; this paragraph is the one-line pointer for a session that only reads the top of this file.

Summary: added a `designer_jobs` table/state machine, a local worker (`npm run designer:worker`) that invokes the operator's already-authenticated Claude Code CLI (subscription auth only, never API billing) in a sandboxed subprocess, and admin UI at `/agents/designer` and `/designer-jobs/[id]`. Ran one real, honest smoke test (`npm run designer:smoke-test`) against a synthetic fixture business: a real ~100s Claude Code session produced a static HTML+CSS page, which surfaced and led to fixing a real false-positive in the existing M9.5D external-site validator (JSON-LD structured data was being flagged as a dangerous inline script).

**Update: the migration blocker below is resolved.** The two "unknown" remote migrations were confirmed, via a read-only `supabase db query --linked` comparison of the full applied SQL text against the local files, to be byte-for-byte identical to `external_source_artifacts` and `external_source_archive_storage` -- pure timestamp drift, nothing else. The two local files were renamed (content untouched, confirmed as pure renames by `git`) to match the already-applied remote versions: `20260830230000_external_source_artifacts.sql` -> `20260831113741_external_source_artifacts.sql`, `20260831150000_external_source_archive_storage.sql` -> `20260831125533_external_source_archive_storage.sql`. `supabase migration list` then showed all 12 pre-existing versions matched local=remote with nothing else pending. `designer_jobs` and the widened `external_site_artifacts.provider` check were then applied to the hosted project and independently verified read-only: `designer_jobs` exists, `siteforge_claim_designer_job` exists with `prosecdef=true` (SECURITY DEFINER) and EXECUTE granted only to `service_role`/`postgres`, RLS is enabled (`relrowsecurity=true`, not forced) with zero grants to `anon`/`authenticated`/`public` on the table, and `external_site_artifacts_provider_check` now allows `claude_code_worker`/`grok_worker`. Full test suite (366/366), tsc, lint, build, and `git diff --check` all clean after applying. The Designer schema now exists in production; the worker has not yet been run against it with a real (non-fixture) job.

## Session: DESIGN.md reference architecture

Session start commit `655a1a6` (prior session, above). One commit, pushed. No migration -- the contract is filesystem + git, not a database table. No paid AI, no external cash cost.

Why: Designer's reference resolver (`src/lib/designer/reference.ts`) has always named four reference kinds -- `gold_standard`, `approved_master`, `category_reference`, `prior_revision` -- but only `gold_standard` ever carried real content (hardcoded principles baked into the system prompt). This session gives `category_reference` (and, contractually, a future `approved_master`) a real, bounded, reusable content shape: a DESIGN.md. The architectural idea is adopted from the public "DESIGN.md" concept (https://getdesign.md) -- a structured design-direction document an AI coding agent can consume -- but no third-party DESIGN.md content, analysis, or website was copied, scraped, or reproduced. Every word in SiteForge's DESIGN.md is SiteForge-authored.

- **The contract**: a DESIGN.md describes design PRINCIPLES only -- intent, emotional target, audience, hierarchy, typography/color roles, spacing/rhythm, composition, hero strategy, section rhythm, imagery strategy, CTA architecture, component treatment, navigation, responsive/accessibility expectations, category information priorities, trust presentation, density rules, anti-patterns, adaptation guidance. It must never prescribe a fixed section schema and must never be, or become, business data.
- `src/lib/designer/reference.ts`: `DesignerReference` now carries `id`, `title`, `category`, `label`, `designMarkdown` (bounded to 6,000 chars via `boundDesignMarkdown()`), and an `approval` record. `resolveDesignerReference({ category })` prefers an *approved* category reference for that category, falling back to the unchanged `gold_standard` behavior -- which is what every real job still gets today, since zero category references are currently approved.
- **Where the example lives**: `src/lib/designer/references/professional-services-editorial/DESIGN.md` plus a sibling `metadata.json`. This pairing is the whole approval mechanism: `metadata.json.approvalStatus` starts at `"pending_human_review"` (`reviewedBy`/`approvedAt` both `null`), and `resolveDesignerReference()` only selects an entry whose `approvalStatus === "approved"`. A human approves one by editing that field and committing the change -- an ordinary, auditable git commit is the review record; no database migration was needed or added. An AI agent authoring a DESIGN.md (as this session did) cannot flip its own approval state.
- The example DESIGN.md is informed by the Sabal Point Designer proof (editorial restraint, minimal cards, one honest illustrative motif standing in for PHOTO_ABSENT) but contains zero Sabal Point-specific facts, addresses, phone numbers, or literal palette values -- a test (`reference.test.ts`) asserts this directly.
- `src/lib/designer/security.ts`: new `fenceDesignReference()`, deliberately distinct from `fenceUntrustedData()` -- a DESIGN.md only ever reaches a prompt from SiteForge's own trusted resolver code, never from prospect/public data, so it isn't "untrusted" in the prompt-injection sense, but it still needs its own boundary: design guidance, never authoritative about the business.
- `src/lib/designer/prompt.ts`: new static system-prompt section "DESIGN REFERENCE VS. VERIFIED BUSINESS FACTS", present unconditionally, naming every forbidden invented-claim category (ratings, reviews, testimonials, awards, credentials, years in business, staff names, services, pricing, guarantees, hours, addresses, service areas, phone numbers, emails, socials, locations, history, customer counts) and stating verified facts win "with no exception." `buildDesignerUserPrompt()` renders a bounded "DESIGN REFERENCE" block (via `fenceDesignReference`) only when the resolved reference actually carries a `designMarkdown` -- so today, with nothing approved, no real job's prompt changes at all. The block is kept structurally separate from the `<untrusted-data>`-fenced facts/imagery blocks (tested directly).
- **Master package contract (defined, not built)**: `DESIGNER_MASTERS_DIR = ".siteforge/designer-masters"` and a `DesignerMasterPackageMetadata` type (master id, title, category, source Designer job id, reviewer, approval timestamp, DESIGN.md fingerprint, source fingerprint, optional screenshot references) are defined in `reference.ts` as the target shape for a future session. `promoteDesignerJobToMaster()` (`src/data/designer.ts`) is **unchanged** -- it still only sets `designer_jobs.promoted_to_master`/`master_template_key`; it does not materialize a `DESIGN.md`/`metadata.json`/`site/`/`reference/` package on disk. That materialization, and any screenshot-generation seam, is explicitly deferred to a later session.
- Builder isolation is unaffected: nothing in this session's reference/prompt code imports `@/lib/builder/*` (asserted directly by a test reading `reference.ts`'s own source).

Validation: `npx tsc --noEmit`, `npm test` (460/460, up from 445), `npm run lint`, `npm run build`, `git diff --check` all clean. New tests cover: an approved scratch reference resolves with bounded content; a `pending_human_review` or `rejected` reference never resolves (scratch-directory tests that never touch the real, currently-pending professional-services-editorial files); missing/malformed metadata fails closed to `null`, never throws; the real on-disk reference contains no Sabal Point facts; `resolveDesignerReference()`'s live behavior is asserted against the real file's actual current approval state (so the test stays correct even after a future legitimate approval); the DESIGN REFERENCE prompt block is absent by default and, when present, is fenced separately from business facts; the system prompt states the fact-override rule with no exception; and Designer reference code never imports the Builder registry.

Deferred: `approved_master` resolution and master-package file materialization (deferred to a future session, per above); a second category reference beyond professional-services-editorial (this session deliberately built one, not five); the human review/approval step for professional-services-editorial itself (it is a complete, real artifact, but stays inert until a human edits its `metadata.json`).

## Session: Real autonomous Scout V1 + commercial lead ranking

Session start commit `a1a26a1` (prior session, above). One commit, pushed. No migration -- everything new lives in the existing `leads.inspection_summary` JSON column. Real external cash cost `$0.00`.

Scout's discovery provider was, until this session, entirely a hardcoded in-memory catalog (`mock_catalog`) -- even its own production path (`startScoutRun`) inspected canned fixture HTML, never a real website. This session makes discovery and inspection real while leaving the existing deterministic scoring/dedupe/normalization/SSRF infrastructure untouched.

- `src/lib/scout/providers/overpass.ts` (NEW): a real, $0, keyless discovery provider against the public OpenStreetMap Overpass API (no account, no key). A real connectivity test during this session found the shared free instance times out (504) or rate-limits (429) on POST requests and on large/slow area-boundary queries, but is fast and reliable for small-bbox GET queries -- the provider always uses GET with a small bounding box and exactly one request per Scout run, and fails soft (empty result + a human-readable diagnostic) rather than retrying a busy shared resource. Never invents a business name, address, phone, or rating -- OSM has no rating/review concept at all, so those are always `null`, correctly.
- `src/lib/scout/providers/osm-tags.ts` (NEW): category -> OSM tag mapping. Categories with no reliable OSM coverage (pool services, detailing, general cleaning) are deliberately left unmapped, returning an explicit `no_discovery_mapping` diagnostic rather than guessing a tag.
- `src/lib/scout/locations.ts` (NEW): a small static bounding-box table (Broward County plus Fort Lauderdale, Coconut Creek, Pompano Beach, Coral Springs, Boca Raton, Hollywood) -- Overpass's own area-boundary resolution proved too slow/unreliable against the free instance, so V1 supports a short, honestly-disclosed location list rather than a general (but flaky) geocoder. An unsupported location fails closed with the supported list, never a guessed bounding box.
- `src/lib/scout/website-status.ts` (NEW): `working_standalone_website | website_unreachable | social_or_directory_only | no_standalone_website_unverified`. Deliberately does not collapse "source omitted a URL" into a confident "no website" claim -- Scout V1 has no $0 mechanism that can affirmatively prove absence.
- `src/lib/scout/contactability.ts` (NEW): a deterministic channel model (phone/email/instagram/facebook/contact form) that only ever credits data a source directly provided or a real tel:/mailto:/`<form>` Scout's own inspection observed -- never a guessed `info@domain` address, never a social match inferred from name similarity.
- `src/lib/scout/commercial-score.ts` (NEW): the second-stage 0-100 commercial-potential composite requested this session, weighted businessStrength 25 / websiteOpportunity 30 / contactability 15 / factsCompleteness 15 / designPotential 10 / designerCoverage 5, producing a deterministic BUILD/REVIEW/SKIP recommendation. Reuses Scout's existing `businessStrengthScore`/`websiteOpportunityScore` unchanged; only overrides the opportunity input (to 85) for the `social_or_directory_only` website status, reflecting a real-but-not-fully-verified no-website opportunity without touching the underlying deterministic score. Designer coverage is read from Designer's own category architecture (`src/lib/designer/category.ts`, this session's prior work) -- landscaping and professional_services are marked "strong" because both have a real end-to-end Designer Worker proof; everything else with category guidance is "workable"; the generic fallback is "weak_unknown". Deliberately does NOT import the legacy Builder registry as a quality signal. A recommendation can never reach BUILD without both a verified contact channel and at least 3 of 6 sourced fact categories, regardless of the weighted score.
- `src/lib/scout/concurrency.ts` (NEW): a small bounded-concurrency mapper: website inspection now runs 4 at a time (`SCOUT_INSPECTION_CONCURRENCY`) instead of fully sequential.
- `src/lib/scout/limits.ts`: `SCOUT_MAX_CANDIDATES` 25->50, `SCOUT_DEFAULT_CANDIDATES` 10->25; new `SCOUT_MAX_EXTERNAL_REQUESTS_PER_RUN` (300) bounds total external HTTP requests for one run -- candidates beyond the budget are reported as not-inspected rather than inspected without limit.
- `src/lib/scout/discovery.ts`: `BusinessDiscoveryProvider.search()` now returns `{businesses, diagnostic}` instead of a bare array, so a provider can explain a partial/zero result (unsupported location, no tag mapping, rate limit, network error) without throwing. `runScoutPipeline` also now catches a throwing discovery provider itself, so a discovery failure degrades to a diagnostic instead of crashing the run.
- `src/data/scout.ts`: `startScoutRun` now uses the real Overpass provider and the real live HTTP client (previously the mock catalog HTTP client, even in production). Persists website status, contactability, and the full commercial-potential breakdown into `leads.inspection_summary` (no migration); candidates in the stored run output are ranked by commercial score.
- `/agents/scout` and `/agents/scout/[runId]`: run list now shows build/review/skip counts; run detail shows a discovery diagnostic banner, a partial-run-ceiling banner, per-candidate website status/contactability/facts-completeness/Designer-coverage/commercial score/recommendation, and BUILD/REVIEW/SKIP/no-website/weak-website filters.
- `/leads/[id]`: new "Commercial potential (Scout)" card reading the same `inspection_summary.commercial_potential` block.
- The human BUILD gate reuses the existing architecture unchanged rather than adding a new one: a BUILD/REVIEW candidate that gets persisted as a lead links to `/leads/[id]`, which already shows the correct contextual Audit or Build button (`isLeadEligibleForBuild`) -- Scout still only ever writes to `leads`, never to `designer_jobs`, and nothing in this session added an autonomous path from a Scout recommendation into Designer or Builder.

Validation: `npx tsc --noEmit`, `npm test` (445/445, up from 401), `npm run lint`, `npm run build`, `git diff --check` all clean.

Real validation run (research only, no DB persistence exercised -- see below): Broward County, FL / landscapers / limit 10, through the actual `runScoutPipeline` with the real Overpass provider and real live HTTP client. 3 real, named South Florida landscaping businesses discovered from public OpenStreetMap data (Verdant Lyfe, The Time Is Now Design & Build, Perfect Choice Nursery), 3 inspected, 0 errors, $0 cost. One had an unreachable listed website, one had a real reachable site with no obvious technical opportunity, one had neither a website nor social profile on record. None reached BUILD (all REVIEW/SKIP) -- an honest result, not a shortfall: OpenStreetMap has no rating/review concept at all, so `businessStrengthScore` is systematically capped without that signal, and this is a real, disclosed V1 characteristic of a $0 keyless source rather than something to paper over.

Not exercised in this session: the run was validated through `runScoutPipeline` directly rather than the admin-session-gated `startScoutRun`/`/agents/scout` HTTP path, because a standalone script has no HTTP session to satisfy `requireAdminSession()` and this session did not add a bypass seam for it (unlike the Designer Worker's `SITEFORGE_DESIGNER_WORKER` context flag) -- inventing one wasn't asked for and would be a new privileged-write seam. The existing `leads` persistence code itself is unchanged from before this session. An operator running a real Scout search from `/agents/scout` in a browser exercises the identical `runScoutPipeline` call plus the pre-existing, unmodified persistence path.

## Session: Reference-driven commercial-quality Designer Worker pivot

Session start commit `fba19bd` (see prior session below). End commit `bd7609f`. One commit, pushed. No migration. No production DB mutation beyond one fixture `designer_jobs` row. External cash cost `$0.00`.

Built on the prior session's Builder-isolation pivot by adding the pieces still missing for a candidate a human could confidently send to a real business: `src/lib/designer/category.ts` (deterministic, Builder-independent keyword table giving each business category -- restaurant, landscaping, home trades, professional services, beauty/lifestyle, generic fallback -- its own information-architecture priorities, surfaced in the brief and never a palette/layout instruction); `computeImageryMode()` in `facts.ts` (PHOTO_RICH/PHOTO_LIGHT/PHOTO_ABSENT, derived from the manifest already on the job, never stored separately); a COMMERCIAL PAGE ANATOMY framework and IMAGE STRATEGY FOR THIS JOB section in `prompt.ts` (flexible, not a fixed template); `src/lib/designer/reference.ts` (names the reference-architecture seam -- V1 always resolves the single approved gold-standard reference; `approved_master`/`category_reference` are typed but intentionally unbuilt until a human approves content for them); and a SELF-CRITIQUE BEFORE YOU FINISH pass the worker runs against its own output before writing `report.json`, with the result now actually surfacing to the human reviewer (`output_report` was being computed by `finalizeDesignerJobSuccess` but never written to the `designer_jobs` row before this session -- fixed, and now rendered on `/designer-jobs/[id]` as summary/visualNotes/selfCritique/factsOmitted/warnings). All of this derives at read-time from data already persisted (facts, imagery manifest); nothing required a schema change.

Proof: one real Designer Job (`8742316f-70b6-40a6-9d16-17dd1b061f0b`, fixture, `professional_services` -- a category no prior Designer run had exercised) through the actual worker, not simulated. Real ~8m45s Claude subscription session (`$0.00`), technical QA passed (validation + build both `passed`, zero findings), now `visual_review_required`. The candidate is an original ledger/engraving visual system for a synthetic Boca Raton bookkeeping practice -- warm paper/ink/pine/brass tokens, a Fraunces/IBM Plex Sans/IBM Plex Mono type trio, a hand-built line-engraved sabal-palm-frond SVG hero (PHOTO_ABSENT handled honestly, no invented photography), a Maps-only directions link built from the exact supplied address, `AccountingService` JSON-LD limited to supplied facts, and a self-critique note that actually named concrete contrast/gate checks rather than a rubber stamp. Not visually approved by a human yet. Never promotable (`is_fixture: true`).

Validation: `npx tsc --noEmit`, `npm test` (401/401, up from 385), `npm run lint`, `npm run build`, `git diff --check` all clean.

Not done, deliberately out of scope for this session: Antojitos is still referenced only as prose principles baked into the system prompt, not literal source access -- `approved_master`/`category_reference` reference kinds have no real content yet; the deterministic Builder registry (`src/lib/builder/registry.ts`) still cannot read a promoted Designer master; Hallmark's role stayed prompt-level (a self-critique pass informed by anti-generic-design review practice, in SiteForge's own words) rather than a second CLI/skill invocation, to conserve Claude subscription capacity; no human has visually reviewed the Sabal Point candidate yet.

## Session: Designer Job system + local Claude Code Designer Worker

Session start commit `24c0d52` (matches this file's top). End commit: see `git log --oneline -5`; three commits, all local, none pushed (see "Push" below). No migration was applied to the hosted project. External cash cost: `$0.00`.

### Why

Human review determined the deterministic Builder's visual quality is not yet consistently strong enough to confidently send to real businesses (this is a judgment about design quality, not correctness -- see the M9.5D Builder Design System section below, which is unchanged). The operator asked for a new architectural split: **Designer** creates premium visual candidates; **Builder** stays the $0 deterministic instantiator for already-approved masters. This session implements the Designer half: a Designer Job data model, a local worker that invokes the operator's own Claude Code subscription session (never a paid API), and the human-visual-approval gate that keeps an AI from ever approving its own design.

### Designer Job data model

- Migration `supabase/migrations/20260901000000_designer_jobs.sql`: `designer_jobs` table, RLS enabled, `anon`/`authenticated`/`public` revoked, and `siteforge_claim_designer_job(job_id, claimed_by)` -- a `SECURITY DEFINER` SQL function granted only to `service_role` that does a conditional `UPDATE ... WHERE status = 'queued' RETURNING *` so two workers can never claim the same job.
- Migration `supabase/migrations/20260901010000_designer_worker_provider.sql`: widens `external_site_artifacts.provider`'s check constraint to add `claude_code_worker` and `grok_worker` (a seam, not an implementation) alongside the existing `lovable`/`manual`/`other`.
- State machine (`src/lib/designer/state-machine.ts`): `queued -> claimed -> preparing -> generating -> generated -> validating -> technical_qa_passed -> visual_review_required -> approved | rejected`, plus `failed`/`cancelled`/`superseded`. **`approved` is reachable only from `visual_review_required`.** No worker output, no QA result, and no other code path can set that transition -- `src/data/designer.ts`'s `recordVisualReview()` is the only function that writes it, and it runs behind `requireAdminSession()`. This answers the mission's required question directly: **an AI cannot approve its own design in this system.**
- `designer_jobs` tracks: which lead triggered it (nullable -- fixture/QA jobs have none), `is_fixture` (fixture jobs can never be `promoted_to_master`, enforced in `promoteDesignerJobToMaster()`), mode (`new_master`/`adaptation`), template family, the generated design brief, a sanitized facts snapshot + fingerprint, an imagery manifest, provider/billing mode, claim/timing fields, the worker's raw output report, independently-computed technical QA, visual review status/notes/reviewer/timestamp, and master-promotion fields.

### Local worker architecture

- **CLI discovery** (`src/lib/designer/cli.ts`): this machine's Claude Code is **not on PATH**. It's bundled inside the VS Code extension at `~/.vscode/extensions/anthropic.claude-code-<version>-win32-x64/resources/native-binary/claude.exe`. `locateClaudeCli()` checks, in order: `SITEFORGE_CLAUDE_CLI_PATH` override, PATH, `~/.claude/local/claude(.exe)` (a native standalone install location that doesn't exist here), then the newest matching VS Code extension bundle. All flags used were confirmed against a real `claude --help` capture from this exact binary (Claude Code 2.1.252), not assumed.
- **Auth check**: `claude auth status --output-format` returns JSON with `loggedIn`, `authMethod`, `apiProvider`, `subscriptionType`, plus account-identifying fields (`email`, `orgId`, `orgName`, `projectsDirectory`) that `checkClaudeAuthHealth()` deliberately discards -- only `loggedIn`/`authMethod === "claude.ai"`/`apiProvider === "firstParty"`/`subscriptionType` are kept. This machine returned `subscriptionType: "pro"`. The worker refuses to run if `authMethod` isn't `"claude.ai"` (i.e., if it were ever API-key auth), rather than silently proceeding.
- **Sandbox** (`src/lib/designer/sandbox.ts`): isolated workspace per job at `.siteforge/designer-jobs/<job-id>/{input,workspace,output,logs}`, gitignored (`.gitignore` updated). The worker subprocess is confined via `--add-dir` to `workspace/` only; `input/` (where SiteForge wrote the brief/facts) and `output/` are outside its reach.
- **Invocation** (`src/lib/designer/runner.ts`): `claude -p --output-format json --permission-mode acceptEdits --restricted --add-dir <workspace> --tools Read,Write,Edit,Glob,Grep --strict-mcp-config --no-session-persistence --session-id <jobId> --append-system-prompt <...>`, prompt piped over stdin, `shell: false`, bounded timeout (default 600s for the real worker, 480s for the smoke test), sanitized environment. Deliberately **not** used: `--bare` (its own `--help` text says OAuth/keychain auth is never read in that mode, only `ANTHROPIC_API_KEY` -- using it would silently switch to paid API billing, which is exactly what this worker must never do) and `--dangerously-skip-permissions`/`--allow-dangerously-skip-permissions` (`--restricted` already refuses `bypassPermissions`). The worker does **not** grant Bash/WebFetch/WebSearch -- it can only read/write/search inside its own workspace. This is a deliberate deviation from the mission brief's "worker MAY run build/test commands": SiteForge's own already-audited fixed-command build pipeline (`external-artifacts.ts`, unchanged) builds the worker's output afterward instead, which is both safer (no network egress from inside the agentic loop, no prompt-injection-driven shell command) and reuses code that was already security-reviewed for the M9.5D external-site import path.
- **Secret isolation** (`src/lib/designer/security.ts`): `buildDesignerWorkerEnvironment()` is an allowlist (`PATH`, `TEMP`, `USERPROFILE`, etc. -- plumbing only), not a denylist -- it never reads `SUPABASE_SECRET_KEY`, `SITEFORGE_ADMIN_*`, `SITEFORGE_AUTH_SECRET`, `XAI_API_KEY`, `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, `VERCEL_TOKEN`, or `ANTHROPIC_API_KEY` in the first place, so there's nothing to accidentally forward. `redactSecretLikeValues()`/`boundLog()` scrub anything secret-shaped out of logs regardless. `fenceUntrustedData()` wraps business facts and the imagery manifest in `<untrusted-data>` tags with an explicit "this is data, not instructions" note in both the fence and the system prompt, for prompt-injection defense against hostile text in public business data.
- **Prompt generation** (`src/lib/designer/prompt.ts`): static system-prompt addendum (`DESIGNER_WORKER_SYSTEM_PROMPT`) encoding the design philosophy, fact/imagery provenance rules, prompt-injection defense, and the output contract; job-specific content (brief + facts + imagery) goes in the user message over stdin. The design brief itself reuses `buildDesignBrief()` (`src/lib/builder/design-brief.ts`, already shipped for `/templates`) rather than a new generator.
- **Output contract** (`src/lib/designer/report.ts`): the worker must write `workspace/report.json`; `parseDesignerWorkerReport()` validates job-id match, required fields, and bounds every array/string -- an unparseable or mismatched report is `failure_code: invalid_report`, not silently coerced.
- **Collection + independent validation** (`src/lib/designer/collect.ts`, `scripts/designer-worker.ts`): reads `workspace/site/**` back into the same `ExternalSiteImportManifest` shape the M9.5D external-generated-site import already uses, then runs it through the **unmodified** `validateExternalSourceArtifact` / `buildExternalSourceArtifact` (`src/lib/builder/external-artifacts.ts`) -- the same static-safety scan (secrets, private-network references, `javascript:` URLs, Stripe references, lifecycle scripts, unsupported file types) and the same isolated fixed-command build (`npm ci --ignore-scripts` / `vite build`, or a static-source fast path) already security-reviewed for Lovable imports. A pass becomes a `generated_websites` + `external_site_artifacts` row (`provider: "claude_code_worker"`), so the **existing** preview-deployment-approval flow (`src/data/external-sites.ts`) works on Designer output unchanged.
- **Orchestrator** (`scripts/designer-worker.ts`, `npm run designer:worker` / `designer:worker:once`): this process, not the Claude Code subprocess, holds `SUPABASE_SECRET_KEY`. `src/lib/designer/worker-db.ts` is its dedicated DB-access module -- it does **not** go through `readTable`/`mutateTable` (those call `requireAdminSession()`, which reads an HTTP cookie that doesn't exist in a standalone script) and does **not** `import "server-only"` (that package throws unconditionally outside Next.js's webpack substitution, which would break a plain `tsx` process entirely -- confirmed by reading `node_modules/server-only/index.js`). Instead every exported function in `worker-db.ts` calls `requireDesignerWorkerContext()`, which throws unless `SITEFORGE_DESIGNER_WORKER=true` -- set only by the worker entrypoint -- so an accidental import from a web route fails closed rather than silently bypassing the admin-session boundary the rest of the app uses.
- **Failure handling**: `classifyFailure()` in `runner.ts` inspects stderr/stdout for auth/billing/capacity language and tags the run `auth_unavailable` / `api_billing_required` / `subscription_capacity_unavailable` rather than a generic failure, per the "fail closed, never silently spend money" requirement. No automatic retries anywhere in this pipeline -- a failed job stays failed; a human creates a new job to retry.

### Real local smoke test (Mission 9) -- honest result, not simulated

`npm run designer:smoke-test` (`scripts/designer-smoke-test.ts`) ran against a **synthetic fixture business** ("Coral Ridge Cooling Co.", HVAC, Fort Lauderdale -- never a real lead, never enters the lead pipeline, structurally cannot be promoted to master since `promoteDesignerJobToMaster()` rejects `is_fixture` jobs). Real results from this session, timestamped `2026-09-01T12:32-12:34Z`:

- CLI found at the VS Code extension bundle path; version `2.1.252`.
- Subscription auth confirmed (`pro`); `billing_mode=subscription`, cash cost `$0.00`.
- A real, non-interactive Claude Code session ran for **100,035ms** and exited 0, producing `workspace/site/index.html` and `styles.css` (2 files) plus `workspace/report.json`.
- The worker's own report: built a single static HTML+CSS page with a full-bleed no-photo hero (an abstract inline-SVG duct-line texture, explicitly not a fake photo of the business), sticky header, a numbered editorial services list, an address + Google-Maps-link-only directions section, a closing CTA, and a footer -- using only the 5 supplied facts (name, industry, city/region, phone, address) and correctly *omitting* rating, review count, hours, an about section, and socials rather than inventing them. It also emitted a `LocalBusiness` JSON-LD block per the brief's SEO requirement.
- **SiteForge's independent validation caught something the worker's self-report missed**: `dangerous_inline_script` on `index.html`, because the (pre-existing, from M9.5D) inline-script regex in `src/lib/builder/external-sites.ts` flagged *any* `<script>` tag other than `type="module" src="..."` -- including the standards-compliant `<script type="application/ld+json">` JSON-LD block the design brief itself instructs every template/worker to emit. **This is a real false positive this session found and fixed**, not a hypothetical: `hasDangerousInlineScript()` now allows `type="application/ld+json"` specifically when its content contains no `<` character (so it can't smuggle a `</script>` breakout even if it's also syntactically valid JSON), while still blocking genuine executable inline scripts. Re-validated the *actual* smoke-test output against the fixed validator: passes with zero findings. Regression tests added (`external-sites.test.ts`): the safe JSON-LD case, a real breakout attempt via a JSON string containing `</script><script>...`, and a genuine `<script>alert(1)</script>` -- all three assert the correct outcome.
- Before the fix, technical QA correctly reported **FAILED** rather than pretending success -- proving the "never trust the worker's self-report" principle worked exactly as designed on a real, not fabricated, disagreement between the worker (`candidateForMaster: true`) and SiteForge's independent check.
- Nothing was persisted to Supabase (see Blockers). No public deployment. No prospect contacted.
- Full artifacts, including both Claude Code's raw stdout/stderr and every generated file, remain on disk at `.siteforge/designer-jobs/b8cd25a9-1d17-40b3-a41c-e8e0b2eeb175/` (gitignored, not committed) for the operator to inspect directly.

### Blockers

1. ~~`designer_jobs` and the `external_site_artifacts.provider` migrations not applied~~ **RESOLVED.** Root cause confirmed by reading the full applied SQL text via a read-only `supabase db query --linked` (not the Management dashboard, not guesswork): the two remote-only versions (`20260831113741`, `20260831125533`) were byte-for-byte identical to local `external_source_artifacts`/`external_source_archive_storage` content under older local timestamps. This was pure filename/version drift with zero content difference -- most likely the local files were renamed/re-dated in a later commit after the originals were already pushed. Fixed with two plain `git mv` renames (no SQL content touched; `git status` confirmed both as 100%-similarity renames) to align local filenames with the already-applied remote versions, then `supabase db push` applied only the two genuinely new Designer migrations. No `migration repair`, no `db pull`, no history mutation was ever run. Verified post-push: `designer_jobs` exists; `siteforge_claim_designer_job` exists with `prosecdef=true` and EXECUTE granted only to `service_role`/`postgres`; RLS enabled with zero `anon`/`authenticated`/`public` grants; `external_site_artifacts_provider_check` allows `claude_code_worker`/`grok_worker`. Full validation suite clean afterward.
2. **No Docker on this machine**, so there was no local Postgres to test the real persistence path against as an alternative before the hosted schema existed. Now that `designer_jobs` is live in production, this is moot for future sessions -- `npm run designer:worker` can be run directly against it. It has not yet been run against a real (non-fixture) lead in this session.
3. The admin UI (`/agents/designer`, `/designer-jobs/[id]`) has not been visually reviewed by the operator in a browser -- same caveat the existing `/visual-qa` pages already carry. This session could not log in to check itself without reading the admin password value, which this repo's own rules forbid ("Do not display credential values").
4. `promoteDesignerJobToMaster()` records the promotion on the job row (`promoted_to_master`, `master_template_key`) but does **not** wire a promoted master back into `src/lib/builder/registry.ts`'s static, code-defined registry. Converting the registry from a static TypeScript object into one that can also read DB-backed promoted masters is real follow-up work, explicitly out of scope for this session (Mission 5 was lower priority than the worker itself per the session's own suggested time allocation).
5. `assessCommercialPotential()` (`src/lib/leads/commercial-potential.ts`) is pure logic with full test coverage but is not yet wired into any page. Natural next step: a summary block on lead list/detail.
6. The first four commits of this session were pushed to `origin/main` on explicit operator instruction; the migration-reconciliation commit that follows was pushed the same way. Nothing in this session was pushed without that explicit instruction.

### What this session did not touch

Real leads, real prospect data, Antojitos, Resend/email, Stripe/payments, DNS, production deployment, the `agents`/`AgentId` catalog (Designer intentionally is not modeled as an `agent_runs` row -- it has its own table/state machine, not `$`-per-tick paid-AI budget semantics), or any credential value.

## M9.5 Roadmap

M9.5 - Launch Readiness / Market Validation

Goal: take a real business through real prospect -> real website audit -> generated replacement -> human review -> approved public preview -> approved real email -> tracked engagement.

M9.5 gates:

- A. Production/security readiness
- B. Real prospect acquisition
- C. Real email integration/internal send
- D. First controlled prospect campaign

Backlog after M9.5:

- M10 - Manager: customer requests, managed-site changes, approval workflows, maintenance history, managed-site status, and initially approval-gated customer-facing changes.
- M11 - Production Deployment & Handoff: customer production deployment, domains, DNS, releases, rollback, ownership/export, transfer, cancellation/handoff.
- M12 - Scout Scaling: scalable real prospect discovery/enrichment, targeting, deduplication, scheduling, and acquisition automation.
- M13 - Operations & Optimization: funnel analytics, experiments, scheduling, agent automation, cost optimization, operational dashboards and scaling.

M10-M13 are backlog milestones and may be reordered based on real market evidence. Do not implement M10-M13 during M9.5.

## M9.5A Safety Rule

No external side effects during M9.5A. Do not send email, call Resend, call Stripe, process real payment, enable live xAI inference, call paid AI APIs, publish a new prospect preview, deploy a customer website, buy domains, modify DNS, create real prospect records, scrape/search real businesses, run real Scout acquisition, or perform production customer actions. Hosted read-only verification is allowed.

## M9.5 Exit Criteria

M9.5A:

- Roadmap persisted
- Secret audit complete
- Environment contract documented
- External live-action gates reviewed
- Temporary auth reviewed
- Credential rotation checklist created
- Mock/test data cannot be mistaken for real revenue
- Production login verification procedure documented
- Tests/build clean
- No real external side effects

M9.5B - PUBLIC-DATA-ONLY PREPARATION:

- First real prospect can safely enter system
- Real public website can be inspected
- Auditor/Builder work on real prospect
- Human reviews generated result
- No outreach yet

Allowed in M9.5B preparation:

- Admin supplies one real public business manually.
- SiteForge validates, normalizes, and deduplicates the public business using existing Scout normalization/dedupe logic.
- Public website URLs are limited to http/https and pass the existing SSRF-safe HTTP boundary.
- The lead is marked with manual public prospect provenance and remains distinguishable from Scout and seed/fixture rows.
- Auditor and Builder may run deterministic `$0` workflows after manual human review.
- No real prospect has been created yet.

Still blocked during M9.5B preparation:

- Bulk Scout discovery or acquisition automation
- Private customer data
- Payment/card data
- Real email or Resend sends
- Live Stripe checkout or charges
- Live paid AI calls
- Customer production deployments, domains, or DNS

Manual public prospect import is the first real acquisition path for M9.5B. Broad Scout acquisition automation remains M12 backlog. M10 is not started.

M9.5B Auditor calibration is implemented for the first real manual prospects. Auditor now treats `overall_score` as deterministic website health (100 = technically/content healthy) and `redesign_opportunity_score` as a separate SiteForge fit signal weighted toward conversion blockers, contact paths, local trust signals, industry-specific gaps, and site availability. Minor maintenance findings should not by themselves make a healthy site look like a strong redesign candidate. No paid AI, email, Stripe, customer deployment, domain, or DNS action is part of this calibration.

M9.5B.1 Auditor Opportunity Differentiation follow-up: commit `d7f85679bc846b49a364cd23368f954dfa10c501` kept health/opportunity separate but made both first real dry-runs converge to opportunity `24` because high-health/no-conversion-blocker audits hit the same cap. The revised model decomposes redesign opportunity into modernization, conversion, local marketing, content/SEO expansion, and structure/navigation components. Modernization uses HTML-only deterministic proxies such as legacy page extensions, legacy generator/script markers, deprecated/presentation-heavy markup, table-heavy structure, excessive inline styling, stale copyright dates, and fragmented legacy file-style URLs. These are careful modernization indicators, not visual-design claims, and they do not lower technical health unless a separate health finding exists. HTML-only analysis remains limited: it does not inspect screenshots, computed layout, brand quality, accessibility tree output, Lighthouse metrics, private analytics, or business intent. Dry-run validation without hosted DB mutation: Signature Air Conditioning & Heating, LLC old/d7f8567/new health-opportunity `92/32 -> 92/24 -> 92/35`; Joe & Joe Air Conditioning, Inc old/d7f8567/new `91/38 -> 91/24 -> 91/26`.

M9.5C:

- Resend/provider integrated behind backend boundary
- Sending domain authentication completed externally in Resend for `mail.andresbotia.com`; SiteForge did not modify DNS.
- Unsubscribe/suppression safeguards
- Explicit live-email gate
- Human approval still mandatory
- Internal/operator test path implemented, allowlisted, and successfully exercised once
- No prospect email sent

M9.5C guarded email integration:

- Default provider remains the deterministic mock provider unless `SITEFORGE_ALLOW_LIVE_EMAIL=true`.
- Live Resend delivery requires server-only `RESEND_API_KEY`, `SITEFORGE_EMAIL_FROM`, `SITEFORGE_EMAIL_REPLY_TO`, and exact backend approval for the send.
- Settings -> Email shows presence-only status for provider key, live gate, sender, reply-to, internal test recipient, and webhook signing secret.
- The internal delivery test is admin-only, labeled test content, restricted to the configured operator/admin recipient, and records `internal_email_test_*` activity events without mutating leads, outreach, contacted status, prospect funnel metrics, or campaign state.
- Prospect sends continue to require approval bound to exact recipient, subject, body, preview deployment, content version, and attribution token hash. Edited or stale content fails closed.
- Live prospect sends additionally require provider readiness, duplicate-send blocking, suppression/DNC checks, and unsubscribe/opt-out language in the approved body.
- `/api/resend/webhook` verifies Resend/Svix signatures against the raw body, rejects unsigned or invalid payloads, and stores supported delivery/bounce/complaint/suppression events idempotently by provider event ID.
- Production evidence: provider configured, sending domain verified externally, live gate enabled for the controlled test phase, one operator-only internal email delivered through SiteForge -> Resend -> Gmail inbox, no private email body or credential value recorded in git, and no lead/prospect/customer funnel state mutated by the test.
- No prospect email has been sent. No controlled prospect campaign has started. M10 is not started.

M9.5D:

- Small manually selected real prospect cohort
- Maximum 5 distinct prospects in `m9.5d-first-controlled-campaign`
- Each site manually reviewed
- Each email individually approved
- Conservative rate limits
- Real sends tracked
- Opt-outs respected
- Campaign results measurable

M9.5D first controlled campaign preparation:

- Reuse existing `outreach.campaign_id` and `preview_deployments.campaign_id`; no new campaign table is needed yet.
- New Sales drafts are tagged with `m9.5d-first-controlled-campaign` and blocked after five distinct selected leads.
- Manual public prospect import now supports an explicit operator-controlled no-standalone-website path. Representation is `leads.website_url = null`, `leads.normalized_domain = null`, `leads.qualification_tier = 'high_priority'`, `leads.website_opportunity_score = 100`, and `leads.inspection_summary.website_status = 'verified_no_standalone_website'` with `no_standalone_website = true`. This is a new website opportunity, not a redesign audit.
- No-website state is never inferred from a missing or malformed URL. The operator must check the no-standalone-website option, and the import requires public phone or address data for safer dedupe.
- Auditor excludes explicit no-website prospects and `runAuditorPipeline` fails closed before crawl. No fake website audit, inspected URL, or technical/SEO/UX/content score is persisted for these leads.
- Builder may run for an explicitly verified no-website qualified lead without a crawled audit. It uses only sourced lead facts and existing provenance rules, including omitted menu, hours, testimonials, awards, emails, and links when not sourced.
- No-website lead detail now includes an admin-only verified-public-facts form. The operator can attach bounded public description, category/cuisine, hours, rating, review count, public source URL, and public social/menu/order/reservation URLs for later Builder regeneration.
- Verified public fact updates reuse SSRF-safe URL validation, store provenance under `inspection_summary.verified_public_facts`, log activity, and do not publish previews, send outreach, call paid services, or mutate campaign state.
- Builder regeneration can consume verified public facts for richer no-website drafts while continuing to omit unknown facts and avoid internal QA/disclaimer language in prospect-facing generated copy.
- Follow-up fix: enriched public descriptions remain bounded at 500 characters in the saved fact record, but Builder now fits rendered section copy to the existing 400-character `WebsiteSpec` string limit before validation. This preserves sourced fact metadata while avoiding `unsafe_hero`/`unsafe_copy` failures on long but valid public summaries.
- Restaurant Builder drafts now render through Restaurant Modern V2.1. The renderer keeps the existing `restaurant-modern` template key but treats dedicated structured fields as canonical for cuisine/category, rating, review count, daily hours, social profiles, menu/order/reservation links, and approved image assets. Public summary is visitor-facing prose only; legacy combined summaries with labels such as `Cuisine/category:`, `Rating:`, `Review count:`, `Description:`, and `Hours:` are sanitized before rendering so structured facts do not leak into copy.
- Restaurant Modern V2.1 stores and renders structured daily hours when present, with legacy public-hours strings used only as compatibility fallback. Verified social profiles are platform-specific, operator verified, and host matched before rendering. Google Maps behavior is link-only: `Get Directions` points to `https://www.google.com/maps/dir/?api=1&destination=<verified address>`. The empty fake map placeholder was removed; no Google Maps iframe or paid Maps API is used.
- Restaurant Modern V2.1 image handling is operator-approved and fail-closed. Image assets are structured in `WebsiteSpec.assets.images` with URL/reference, role, alt text, source type, source URL, rights status, attribution, and approval status. Only approved, rights-approved, allowlisted local restaurant assets render; unapproved, unsafe, mismatched, or third-party reference images are rejected/omitted. No scraping, platform download, arbitrary remote image ingestion, or rehosting was added. The no-image hero uses a designed CSS fallback instead of an empty placeholder.
- Restaurant Modern V2.1 CTAs are restaurant-specific. The renderer uses Call, Get Directions, View Menu, Order Online, and Reserve only when the corresponding sourced capability exists; generic Contact is retained only as a last-resort fallback. This does not publish a preview, send email, call paid AI, mutate Antojitos production data, or start M10.
- M9.5D Lovable-assisted Builder integration is provider-neutral and keeps deterministic Builder as the fallback. Admins can import operator-supplied external generated-site manifests for a selected lead from `/websites/import-external`; the import creates a new immutable `generated_websites` version with `metadata.generation_source = external_generated`, provider metadata, a verified-facts snapshot fingerprint, static safety validation, and build validation. The operator does not provide the SiteForge/Vercel deployment URL at import time.
- External generated source is now persisted as a canonical immutable admin-only artifact in `external_site_artifacts`, including the bounded source manifest, fingerprint, artifact metadata, validation/build status, and deployment status. Historical artifacts are insert-only and tied to the generated website version. Source is not fetched from arbitrary remote URLs and imported React/Vite code is not mounted inside the SiteForge admin/public runtime.
- External generated-site preview deployment is a separate human-approved `website_deployment` approval action before M7 public preview publication. It fails closed on severe validation/build findings, `.env`/secret files, unsupported file types, binary pasted image manifests, actual private/localhost/metadata URLs or host endpoints, `javascript:` URLs, Stripe/payment references, provider editor leaks in browser-facing source or build output, dangerous inline scripts, unsupported package lifecycle scripts, non-allowlisted build commands, missing build output, output secrets, or missing Vercel adapter configuration. The deployment state machine is import -> validation/build-ready -> deployment approval required -> pending approval -> deploying -> deployed or failed. SiteForge persists only the deployment id and URL returned by the deployment adapter. Provider preview URLs are admin-only. Prospect access remains through opaque SiteForge `/p/[token]` URLs, which record visit attribution before redirecting only to a deployed Vercel-controlled preview target and fail closed when no deployed SiteForge target exists.
- Supported import formats are a bounded JSON source manifest for text-centric Vite React static apps or plain static `index.html` projects, and bounded ZIP archives for Vite/TanStack exports with binary image/favicon assets. Private artifacts may preserve repository-only docs/config such as `README.md`, `AGENTS.md`, `.gitignore`, `.prettierignore`, and `.prettierrc`; those files are not accepted as public build output. Private-network detection is URL/host-context based so package versions and lockfile semver text do not create false positives. Deep CTA tracking inside arbitrary external generated sites is not injected automatically; M9.5D tracks preview opens at `/p/[token]` before redirect.
- External generated imports do not send email, publish outreach, call Resend, call Stripe, call paid AI, deploy customer production websites, modify DNS/domains, mutate real Antojitos data, or start M10. Stale verified-fact snapshots show the operator warning `Website was generated from an older verified-facts snapshot.` and never auto-regenerate or mutate approved/public versions.
- First real Antojitos static external artifact import checkpoint: Lovable source repo `andresbotia/antojitos-crafted-visuals` was cloned locally at GitHub HEAD `bc52a2aea56e3203e8ccf33fd4555dfffb04941d` and matched the approved Lovable provider ref `a9c024afd4dd9749622d02d254efe4f967f05e89` by source inventory, project metadata, restaurant content, and binary assets. The TanStack/Lovable source was converted into a static Vite React ZIP artifact at `tmp/antojitos-static.zip` with 30 imported files and 7 binary assets. SiteForge validation/build passed with framework `vite-react`, package manager `bun`, and the fixed command `bun install --frozen-lockfile --ignore-scripts && bun run build`. Imported generated website `b7598a73-3be7-4a47-8d70-d538af500c3e` and artifact `d6ca8f0f-c2e7-4dcf-bbf0-dbeeddce5a9d` are linked to Antojitos lead `c253aa3c-2ea7-43b7-9216-319b074cdb9f`; validation status `passed`, build status `passed`, deployment status `not_requested`. The private archive is stored in `external-site-artifacts`; no public preview token, Vercel deployment, outreach/email, Stripe/payment action, paid AI/API call, DNS/domain action, or Lovable mutation occurred. Next human step is review at `/websites/b7598a73-3be7-4a47-8d70-d538af500c3e`; first SiteForge-controlled Vercel preview deployment still requires explicit request and approval.
- Sales copy distinguishes no-website prospects and frames the offer around creating a standalone web presence. It must not claim a website audit, current-site deficiency, or redesign for a business without a standalone site.
- Sales server actions explicitly require an admin session before draft edits, approval requests, or send execution.
- The outreach detail view now shows business/prospect, recipient, latest audit health/redesign opportunity, generated website, preview state, exact subject/body, approval state, suppression/eligibility checks, provider readiness, and live-gate status.
- The final send button says `Send REAL External Email` whenever the live-email gate selects Resend.
- Live gate alone cannot send a prospect email. The backend also requires exact-content external-email approval, valid recipient, active unexpired preview tied to the same lead/website, matching attribution token, no duplicate send, no suppression/bounce/complaint history, valid provider config, and unsubscribe/opt-out language in the approved body.
- Resend webhooks are public at the proxy layer only for `/api/resend/webhook`, then must pass signature verification in the route handler.
- The webhook parser accepts the configured production event set: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`, and `email.failed`. Unknown events are ignored.
- Bounce, complaint, suppression, and failed events move the intended outreach to `failed` where appropriate. Bounce/complaint/suppression events are treated as suppression signals for future sends.
- Email opens are not a primary engagement signal. Tracked SiteForge preview activity remains the stronger engagement signal.
- Do not automatically choose Signature Air Conditioning or Joe & Joe Air Conditioning. The operator should manually select a prospect with a meaningfully poor/outdated website and credible redesign opportunity.

## M9.5D Builder Design System (current)

Session start commit `cfb6ee3d7c88aacc0cdd371d10687225f017777f`; end commit `7763d57`. Two commits: `f232f1b` (registry and design system) and `7763d57` (template library, visual QA, draft QA). No migration was needed; no production data changed; external cost was `$0.00`.

Problem addressed: the Antojitos static import was technically valid but visually weaker than the approved Lovable design, and the non-restaurant Builder path was worse still. Home services and professional drafts rendered through a generic fallback whose hero contained a literal empty grey box (`<div className="mt-12 h-24 rounded-2xl bg-white/10" />`). Visual quality, not correctness, was the blocker to real outreach.

New Builder architecture:

- `src/lib/builder/design-system.ts` holds curated design presets (`trade-trust`, `contractor-premium`, `advisory-authority`, `advisory-clean`, `kitchen-warm`). A preset is a complete look: surface/ink/deep/accent/band/highlight colors, display and body font stacks, radius scale, density, and hero treatment. Presets are enumerated design decisions, never runtime randomization. `presetCssVariables` flattens a preset into `--sf-*` custom properties so renderers use static Tailwind arbitrary values while colors stay data-driven. `contrastRatio` and `contrastPairs` implement WCAG 2.x relative luminance; a test asserts every preset clears 4.5:1 for body pairs and 3:1 for large display pairs.
- `src/lib/builder/registry.ts` is the single source of truth for template capability: versioned id, family, status, renderer, design preset, legacy palette key, summary, industry keywords, required/optional facts, image roles, image family, CTA capabilities, and designed section order. `selectTemplateForIndustry` does deterministic longest-keyword matching and returns `confidence: "matched" | "fallback"` plus a reason. `needsNewMasterTemplate` exposes the "no suitable template exists" signal. No paid AI is involved in selection.
- `src/lib/builder/templates.ts` now derives `TEMPLATE_CATALOG` from the registry. `selectTemplate` and `templateLabel` keep their existing signatures, so `src/data/builder.ts`, `run.ts`, `spec.ts`, and `persist.ts` are unchanged.
- `src/components/builder/site/local-business-v2.tsx` is a shared section system for the non-restaurant templates: sticky translucent nav, full-bleed hero with directional scrim and asymmetric grid, floating credibility panel, trust strip, numbered editorial service list, editorial split sections, visit panel with directions link and hours table, deep-ground closing CTA, quiet footer. It consumes the existing `Section[]` spec, so no spec migration was required. Every section omits itself when its facts are absent.
- The no-image hero renders `.sf-local-v2 .sf-hero-canvas` in `globals.css`, a composed ground built from the preset's own CSS variables. There is no longer an empty box anywhere in the Builder output.
- `DraftSite` dispatches on `definition.renderer`. `restaurant-modern-v2` and `local-business-v2` cover all three active templates; the legacy palette-based branch remains only as dead-code fallback for an unknown renderer.

Template identifiers now in the registry:

| Template key | Registry id | Renderer | Preset |
| --- | --- | --- | --- |
| `home-services-modern` | `home-services-modern@2.0.0` | `local-business-v2` | `trade-trust` |
| `restaurant-modern` | `restaurant-modern@2.1.0` | `restaurant-modern-v2` | `kitchen-warm` |
| `professional-services-modern` | `professional-services-modern@2.0.0` | `local-business-v2` | `advisory-authority` |

Template QA (`src/lib/builder/qa.ts`) is deterministic, `$0`, and does no network or rendering work. It checks required facts, page/nav/section structure, unsupported marketing claims (superlatives, years in business, customer volume, awards, guarantees, prices, licensing/insurance, free-estimate offers), internal and placeholder copy leaks, CTA safety and reachability, image renderability/alt text/role support/illustrative labeling, conversion paths, and preset contrast. It reports blockers, warnings, and notes; it never mutates drafts or gates approvals. The report is surfaced on `/websites/[id]` for Builder-generated drafts.

Designer brief (`src/lib/builder/design-brief.ts`) generates a provider-neutral master-template brief covering required sections, design direction from the chosen preset, static-export requirement, mobile-first and contrast requirements, SEO patterns, imagery rights policy, and the explicit prohibited-invention list. A test asserts the brief mentions no provider by name. `/templates` exposes it through an admin-guarded server action; generating a brief performs no network call and authorizes no paid generation.

Imagery: `ImageSourceType` gains `template_illustrative` for rights-safe artwork bundled with a template. The renderable allowlist generalized from `/fixtures/restaurant/**` to `/fixtures/{restaurant,home-services,professional}/**` (local SVG only). `imageProvenanceLabel` gives operator-facing provenance text that keeps template artwork visibly illustrative. No image was scraped, downloaded, or rehosted, and no artwork has been authored for the `home-services` or `professional` families yet — those templates currently render the designed CSS hero ground.

Also in this session: `derivedServices` now falls back to keyword matching, so real-world labels such as "Air Conditioning & Heating" reach HVAC capability copy instead of generic professional copy. Service lists remain generic category capability language and still make no claim about a specific business.

New operator surfaces:

- `/templates` - registry contents, palette swatches, matched keywords, visual QA links, designer brief form.
- `/visual-qa/local-business/[variant]` - four variants (`home-services`, `home-services-minimal`, `professional`, `professional-minimal`) rendered from real `runBuilderPipeline` output on fictional QA businesses. Admin-only via the default-deny proxy, `robots: noindex, nofollow`. The QA businesses are invented for rendering checks and must never enter the lead pipeline.

Validation: `npx tsc --noEmit`, `npm test` (326/326), `npm run lint`, `npm run build`, `git diff --check` all clean.

Not done in this session, in priority order:

1. No human has eyeballed the four `/visual-qa/local-business/*` pages yet. They prerender without error and pass automated QA, but a design pass by the operator is the next step before any home-services or professional draft goes to a prospect.
2. No illustrative artwork exists for the `home-services` or `professional` fixture families. The allowlist, provenance types, and image slots are ready; the SVGs are not authored.
3. Restaurant Modern still has a bespoke renderer rather than running on the shared preset system. That is deliberate - it is locked and tested - but the two systems should eventually converge.
4. `contractor-premium` and `advisory-clean` presets are defined and contrast-tested but no template uses them yet. They exist so a second variant per family is a registry entry rather than new layout code.
5. QA is advisory only. It is not wired into the preview-approval path; a draft with blockers can still be approved by a human.

M9.5D safety state is unchanged by this session: no prospect email, no public preview, no deployment, no payment, no DNS, no paid AI, no Antojitos mutation. Antojitos generated website `b7598a73-3be7-4a47-8d70-d538af500c3e` and artifact `d6ca8f0f-c2e7-4dcf-bbf0-dbeeddce5a9d` were not read, modified, or deployed.

## Credential Rotation Before Sensitive Data

Rotation is deferred by operator decision for the narrow M9.5B public-data-only path. Rotate these before entering sensitive customer data, handling payment/card data, enabling live email/payment providers, or expanding production use. Do not store rotated values in git or share them with agents.

- Supabase secret/server key: prior local/screenshot exposure risk. Update local environment, Vercel environment, and Supabase dashboard-created key as applicable. Re-test dashboard reads, approvals, webhook processing, and RLS-denied anon access.
- Temporary SiteForge admin password: prior local/screenshot exposure risk. Update local and Vercel environment. Re-test valid login, invalid login, logout, and protected-route redirect.
- SiteForge auth signing secret: prior local/screenshot exposure risk; existing sessions remain valid until expiry if the old secret stays active. Update local and Vercel environment. Re-test that old sessions fail and new login succeeds.
- Supabase personal access token, if still active: operator-only credential may have been exposed during local setup. Revoke/rotate in Supabase account settings and re-test CLI/project access.
- Any Stripe, Resend, Vercel, GitHub, or xAI credential found outside secure provider storage: rotate in the relevant provider dashboard, update local/Vercel server-only env, then re-test the specific integration with live gates still disabled unless explicitly approved.

## Production Login Verification

Do not retrieve or print secret values. Presence-only configuration status can be viewed in Settings -> Safety.

Manual procedure:

1. Visit `/leads` or another protected admin route while signed out; expect redirect to `/login`.
2. Enter the configured admin email/password; expect redirect to `/dashboard` and a secure HttpOnly session cookie.
3. Use logout; expect the next protected route request to redirect to `/login`.
4. Try an invalid password; expect no authenticated session.

Temporary single-admin auth remains future hardening. Do not replace it with Supabase Auth during M9.5A unless a severe concrete issue requires it.

## Real-Data Readiness Note

M9 smoke conversion used mock Stripe IDs and must not be treated as real payment or revenue. Customer views now classify payment provenance as mock/live/unknown and exclude mock or unknown subscription amounts from monthly revenue display.

M9.5B manual prospect import is limited to public business facts supplied by the admin. It does not discover businesses in bulk, send outreach, process payments, call paid AI, or deploy customer production websites.

M9.5C guarded email setup added real Resend infrastructure but did not start prospect outreach. Resend sender/domain, server-only environment variables, and webhook signing were configured outside agent context. `SITEFORGE_ALLOW_LIVE_EMAIL=true` is now configured for the controlled test/campaign phase, but live gate alone is never enough to send a prospect email.

First production import failure diagnosis: Vercel had `NEXT_PUBLIC_SUPABASE_SECRET_KEY` configured but not server-only `SUPABASE_SECRET_KEY`, so the server Supabase client could not initialize. The public-prefixed value must be removed/replaced with the correct server-only Vercel variable before retrying the manual import.

## Project

- SiteForge: AI-assisted local-business website operations
- Next.js App Router, TypeScript, Tailwind
- Supabase with server-only `SUPABASE_SECRET_KEY`, RLS on, and no anon/authenticated table grants
- Vercel production admin app deployment
- Temporary single-admin cookie auth (`SITEFORGE_ADMIN_*`)
- xAI provider infrastructure exists; live inference remains disabled (`XAI_ALLOW_LIVE_INFERENCE` not `true`)
- Resend provider infrastructure exists; live email remains disabled unless `SITEFORGE_ALLOW_LIVE_EMAIL=true` and all server-only provider settings are present.

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
- Outreach send execution is mock by default; guarded Resend live delivery requires exact approval, provider readiness, suppression checks, and the live-email gate
- No payments
- No domain/DNS automation
- Supabase public application-table access remains revoked
- Credential rotation is deferred for public-data-only validation, but remains mandatory before sensitive customer/payment data or broader production use

## Next Milestone

Continue with M9.5D by having the human operator manually select one real prospect for review. Do not send the first prospect email until the exact draft, preview, approval, and readiness checklist have been reviewed. Do not start M10.

Immediate next actions:

1. Operator reviews `/visual-qa/local-business/home-services` and `/visual-qa/local-business/professional` at desktop and 390px widths and records what still looks weak. That judgment drives the next design pass.
2. Author rights-safe illustrative SVGs under `public/fixtures/home-services/` and `public/fixtures/professional/`, wired as `template_illustrative` with alt text that reads as illustrative. Do not source imagery from Google, Yelp, Instagram, Facebook, or any listing site.
3. Rebuild one existing home-services draft through the new renderer and compare it against the current Antojitos external artifact to decide whether the deterministic Builder is now good enough to skip an external generation for the next non-restaurant prospect.

Also updated `README.md` architecture notes for the registry, design system, QA, and designer brief.
