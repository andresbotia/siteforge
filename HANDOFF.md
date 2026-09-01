# SiteForge Handoff

For the next session. Milestones 1 through 9 are locked, with the latest M9.5A readiness lock at `bfbf41181fb8c1c1ba3ba56ab38f5c2606b8f007`. M9.5B real-prospect preparation and Auditor calibration are locked, with the M9.5B Auditor Calibration lock at `1358caad47c46b9832f875ec1e62d5834043906b`. M9.5C guarded real email integration/internal send is complete: Resend is configured server-side, the sending domain was verified externally, the live-email gate was exercised for one operator-only test, and the test delivered without prospect/customer funnel mutation. M9.5D first controlled prospect campaign preparation is current. The operator deferred credential rotation for now; credential rotation is still required before sensitive customer/payment data, live payment use, or broader production operation. This is NOT M10.

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
