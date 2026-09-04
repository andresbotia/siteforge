# SiteForge Operator Console — Design System

Status: **M10.6**. This document is the durable artifact. The CSS variables in
`src/app/globals.css` and the shared components in `src/components/shared` are
downstream of it. When they disagree, this document is wrong or the code is
wrong — fix one of them, not neither.

## Scope and separation

This system styles the **admin operator console**: the authenticated app behind
`requireAdminSession()` — `/today`, `/leads`, `/leads/[id]`, `/customers`,
`/roadmap`, `/settings`, and every secondary/debug surface (`/agents/*`,
`/audits`, `/websites`, `/outreach`, `/offers`, `/approvals`, `/analytics`).

It is **not** the website-generation design system. `src/lib/builder/design-system.ts`
(`DESIGN_PRESETS`, `presetCssVariables`, the `--sf-*` inline-style vars consumed
by `src/components/builder/site/*`) styles the sites SiteForge produces *for
prospects*. That system is light, editorial, and per-preset; this one is light,
neutral, and singular (it was dark through M10.5; M10.6 converted it — see
Direction below). **They must not share tokens** regardless of which is
currently dark or light. The name collision on the
`--sf-` prefix is unfortunate but the two never appear on the same page: the
console theme lives on `:root` in `globals.css`; the builder presets are written
as inline `style={}` on a preset root inside a renderer. Do not import one into
the other. The one thing this system reuses from the builder module is the pure
function `contrastRatio()` — math, not tokens — in a test
(`src/lib/console-theme/contrast.test.ts`).

Not in scope, do not restyle: `/p/[token]`, `/o/[token]`, `/buy/[token]`,
`/checkout/*` (prospect/customer-facing, separate surface), `/visual-qa/*`,
`/templates` (developer tools showing raw builder output).

## Direction

An operator console someone uses for hours, not a marketing page. The reference
points are a good developer tool's **information density** and Apple software
UI's **typographic discipline**: a small type scale used consistently, hierarchy
built from weight and spacing rather than from size ramps and color, tight rhythm
*within* a section and generous rhythm *between* sections. Nothing decorative. No
gradients. No shadow doing a job a border can do. No color used as ornament —
every non-neutral color on the screen is either "this is interactive" (one
accent) or "this is a status" (four semantic colors), never "this looks nice
here."

**M10.6: the console is now light**, not dark. Reversed from M10.5's own
"the console stays dark" call — the operator's direction, and the right one:
a near-white ground with mostly-black text is the more legible default for
long sessions of reading dense tabular data, and it is the harder aesthetic
to fake, which is the point. Restraint is the aesthetic this pass targets
explicitly:

- No gradients, no glassmorphism, no colored/glow drop shadows.
- No rounded-everything — two radii, not one applied indiscriminately.
- No emoji or decorative icons in the product chrome (Lucide icons in the nav
  are functional wayfinding, not decoration, and stay).
- No purple-to-blue anything. One accent, one hue, used only for interactive
  elements.
- No cards floating on a tinted background — the page ground and the card
  fill are both neutral; the only thing that separates them is a hairline
  border, not a color shift.
- No color used to make a screen feel lively. If a visual element is not
  communicating information, it is not in this system.
- Structure comes from whitespace and hairline rules, not from nesting boxes
  inside boxes (§4's "no bordered card inside a bordered card" rule is part
  of this, not just a density rule).

This is a value swap, not a redesign: every rule below this line that isn't a
color value is unchanged from M10.5 — same five-size type scale, same 4px
spacing scale, same two radii, same one-border-weight rule, same borders-not-
shadows elevation model, same component vocabulary.

---

## 1. Color

Defined once on `:root` in `globals.css` as `--sf-*`, then bridged to Tailwind
utility names via `@theme inline` so existing classes (`bg-surface`,
`text-muted`, `border-border`, `bg-accent`…) keep working with the new values.
The `--sf-*` layer is the semantic source of truth; the Tailwind names are a
compatibility bridge, not a second palette.

### Neutrals

| token | value | role | reason |
|---|---|---|---|
| `--sf-bg` | `#f8f8f9` | page ground | Near-white, not pure `#fff` — a hair off white so a pure-white raised surface still reads as a distinct plane under a hairline border, without needing a shadow to separate them. |
| `--sf-surface` | `#ffffff` | card / panel fill | White. The one surface allowed to be pure white; everything else sits slightly off it. |
| `--sf-surface-2` | `#eef0f2` | table header, row hover, nested block fill | The *only* second surface. Replaces "a card inside a card": nested content gets this fill and no border. |
| `--sf-border` | `#e2e2e6` | every border and divider | One border weight, light enough to recede (contrast ratio ~1.2 against white — deliberately low; a border's job is definition, not attention) but present enough to define structure without a shadow's help. |
| `--sf-border-strong` | `#c9c9d1` | hover border on interactive surfaces, focus-ring track | Used only to signal interactivity on hover, never structurally. |
| `--sf-text` | `#1a1a1e` | primary text | 16.4:1 on `--sf-bg`, 17.4:1 on `--sf-surface`. Near-black, not pure black — mostly-black text on mostly-white ground, per the M10.6 brief. |
| `--sf-text-muted` | `#5b5b63` | secondary text, labels, descriptions | 6.3:1 on `--sf-bg`, 5.9:1 on `--sf-surface-2` — clears AA everywhere it is used. |
| `--sf-text-faint` | `#6b6b74` | timestamps, disabled, non-load-bearing metadata | 5.0:1 on `--sf-bg`, 5.3:1 on `--sf-surface`. Still held to the same 4.5:1 floor as every other body text — no exception was carved out for "it's just a timestamp." |

### Accent — exactly one

| token | value | role |
|---|---|---|
| `--sf-accent` | `#2555c7` | interactive: links, primary button fill, active nav item, focus outline, the one "do this" affordance in a group |
| `--sf-accent-hover` | `#1c469f` | accent hover (darker, not lighter — conventional on a light ground, reads as "pressed," not "lifted") |
| `--sf-on-accent` | `#ffffff` | text/icon on an accent fill (6.6:1 on `--sf-accent`, 8.7:1 on `--sf-accent-hover`) |
| `--sf-accent-soft` | `color-mix(--sf-accent 10%, transparent)` | active nav background, selected-row tint |

M10.5 had already moved the accent off the original teal to a blue
(`#5b9dff`) so it stopped colliding with the success-green status color.
M10.6 keeps that decision and re-derives the exact blue for the light ground:
`#5b9dff` reads at only ~3.1:1 on white — legible on a dark ground, too pale
on a light one — so the hue was kept and the value darkened to `#2555c7`
(6.2:1 on `--sf-bg`), which still reads unambiguously as "blue, not black,
not a status color."

### Semantic — status only

These five tones express **the state of a thing**. They never style a button, a
link, a border that isn't communicating status, or a background that isn't a
badge. If you want to draw the eye to an action, that is the accent's job.

| tone | value | `-soft` bg | means | example statuses |
|---|---|---|---|---|
| `neutral` | `--sf-text-faint` | `--sf-surface-2` | inert / not started / archived | draft, not_connected, archived, expired, "none" |
| `info` | `#086b7a` | `mix 10%` | in progress, nothing required of the operator yet | building, contacted, sent, checkout_created, review (tier) |
| `warning` | `#7a4a05` | `mix 10%` | **the operator needs to act** | awaiting_approval, pending_setup, review_required, needs_revision |
| `success` | `#0a6a3d` | `mix 10%` | good, usually terminal | approved, live, paid, active, interested, customer, qualified |
| `danger` | `#ab2530` | `mix 10%` | bad, or failed | failed, rejected, declined, error, cancelled |

All four are markedly darker/more saturated than their M10.5 dark-mode
counterparts (`#2dd4bf`/`#e8b23a`/`#3ecf8e`/`#f26d6d`) — **re-derived, not
lightened.** A color that clears 4.5:1 against near-black needs far less
weight than one that has to clear 4.5:1 against near-white; picking colors
that "look like the same family, just paler" reliably undershoots on a light
ground. Every value here was checked directly against the real contrast
math, including the harder case: the badge's own text against its own tinted
fill, which is why the tint amount also changed (14% on dark → 10% on light,
`palette.ts`'s `SOFT_FILL_AMOUNT` — a lighter base needs a lighter tint to
keep the fill from converging on the text color). Verified end-to-end in
`contrast.test.ts`, 22 assertions, all passing against the light values with
no threshold weakened.

### The canonical status → tone map

Every status enum in the app resolves through `src/components/shared/status-badge.tsx`.
The mapping:

| domain | value → tone |
|---|---|
| **lead status** | discovered → neutral · qualified → success · audited → info · website_built → info · approved → success · contacted → info · interested → success · customer → success · rejected → danger · archived → neutral |
| **website status** | building → info · review_required → warning · approved → success · live → success · failed → danger |
| **outreach status** | draft → neutral · awaiting_approval → warning · approved → success · sent → info · replied → info · interested → success · declined → danger · failed → danger · unsubscribed → neutral |
| **commercial offer** | draft → neutral · awaiting_approval → warning · approved → success · checkout_created → info · paid → success · expired → neutral · cancelled → danger |
| **customer status** | active → success · pending_setup → warning · cancelled → neutral |
| **approval type** | (category, not state — all `neutral` except `payment_action`/`dns_change`/`destructive_infrastructure_action` → warning to flag the risk class) |
| **payment environment** | mock → neutral · test → warning · live → success · unknown → neutral |
| **qualification tier** | reject → danger · review → warning · qualified → success · high_priority → success |
| **risk level** | low → success · medium → warning · high → danger |

The through-line: **warning always means "you, the operator, have a decision to
make."** That is what makes `/today` and the pipeline scannable — amber is the
color of your queue.

---

## 2. Typography

Font: Geist Sans (already loaded). Geist Mono for provider IDs, hashes, tokens,
and raw JSON only.

Five sizes. Overriding Tailwind's `--text-*` theme keys so existing
`text-xs/sm/base/lg/xl` classes snap to this scale; ad-hoc `text-[10px]` /
`text-[11px]` / `text-[13px]` are removed in favor of these.

| class | size / line-height | weight | letter-spacing | use |
|---|---|---|---|---|
| `text-xs` | 11px / 16px | 500 | `+0.02em`, `uppercase` when a label | column headers, badges, eyebrow labels, timestamps, field labels, metadata keys |
| `text-sm` | 13px / 18px | 400 (**500** for the primary item in a row/card) | — | **the default.** table cells, body copy, descriptions, form controls, list secondary lines |
| `text-base` | 14px / 21px | 400–500 | — | used sparingly: card-body prose where 13px reads cramped, the one step up from default |
| `text-lg` | 16px / 22px | 600 | — | card titles, section headers |
| `text-xl` | 20px / 28px | 600 | `-0.01em` | page title — **one per screen** — and large metric values |

Rules, with reasons:

- **Hierarchy comes from weight and space, not size.** There are only two jumps
  in the scale that matter (13→16 for "this is a heading", 16→20 for "this is the
  page"). Everything else is 400 vs 500 vs 600 at 13px. This is the Apple-UI
  discipline: you distinguish a row's title from its subtitle by *weight*, and
  you separate groups by *whitespace*, so the eye isn't doing size arithmetic.
- **13px is the workhorse.** A console is mostly tabular. 13/18 fits dense rows
  while clearing AA. Do not reach for `text-base` to "make it comfortable" —
  comfort on this surface is consistency, not size.
- **One `text-xl` per screen.** If two things are page-title-sized, neither is
  the page title.
- **Numbers are `tabular-nums`** everywhere they can change or be compared
  (scores, counts, currency, dates in tables).
- **Uppercase only at `text-xs`/500/`+0.02em`**, and only for labels (a field
  label, a column header, a metadata key, a section eyebrow). Never uppercase a
  sentence.

---

## 3. Spacing

Base unit **4px**. Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48` (Tailwind
`1 2 3 4 6 8 12`). 20px, 28px, 40px are deliberately not on the scale — if you
reach for them, one of the two neighbors is right.

| context | value |
|---|---|
| label ↔ its value | `4` |
| items in a list / stacked fields / badges in a row | `8` |
| intra-card: header ↔ body content, related blocks inside a body | `12` |
| card padding (header `px-4 py-3`, body `p-4`) | `16` |
| card ↔ next card | `16` |
| **page section ↔ page section** (top-level regions of a page) | `24`, `32` on `/today` and detail pages |
| page title block ↔ first section | `24` |

The rule the current UI breaks and this fixes: **tight within, generous
between.** Rows inside a list are 8–12px apart; the list as a whole is 24–32px
from whatever follows. Right now everything is `mb-4`, so a page reads as one
undifferentiated column. Section gaps are what make a long detail page
navigable without anchors.

Horizontal page padding: `px-4` mobile, `px-8` from `md`. Max content width:
none globally — tables need the room — but prose blocks (page descriptions,
empty states, callouts) cap at `max-w-2xl`.

---

## 4. Border, radius, elevation

- **Radius: two values.** `rounded-sm` = 4px (badges, buttons, inputs, inline
  chips, the accent-bordered link-buttons). `rounded-md` = 8px (cards, panels,
  the table container, dialogs). Nothing is fully round. A pill badge and a
  4px badge on the same screen is two design languages.
- **Borders: one weight, one color** (`--sf-border`). Card edge, table row rule,
  section divider, input outline. `--sf-border-strong` appears only on
  `:hover` of an interactive surface.
- **Elevation: borders, not shadows.** A shadow says "this element is on a
  different z-plane than the page." The only things that are: the mobile nav
  drawer and the modal dialog. Those get `--sf-shadow-overlay`
  (`0 16px 40px -14px rgba(15,15,20,0.22)` on the light ground — neutral
  black at low opacity, never a colored/glow shadow). Every card, panel,
  dropdown-in-flow, and popover-in-flow uses a border and `--sf-surface` /
  `--sf-surface-2` fills, never a shadow.
- **Nested containers:** do not put a bordered card inside a bordered card.
  A block inside a `CardBody` that needs visual separation gets
  `bg-[--sf-surface-2]` + `rounded-sm` + padding, no border, or just a top
  `border-t border-[--sf-border]` divider. This removes the
  `rounded border border-border-subtle p-3` "mini-card" pattern that appears
  ~8 times across `/leads/[id]`, `/customers/[id]`, and the Today row.

---

## 5. Density — tables and lists

### Table (`DataTable` / `THead` / `Th` / `Td`)

- Container: `rounded-md border border-[--sf-border]`, `overflow-x-auto`. The
  page body never scrolls horizontally; the table does, inside this box.
- Header: `bg-[--sf-surface-2]`, `text-xs` uppercase `--sf-text-muted`,
  `px-3 py-2`.
- Body cell: `px-3 py-2`, `text-sm`, `border-t border-[--sf-border]`. Target
  row height ≈ 36px.
- **First column is the identity** (business name, customer name): `text-sm`
  `font-medium` `--sf-text`, a link. Every other cell is `--sf-text-muted`
  unless it is a badge or a number that carries meaning.
- Numeric columns: `tabular-nums`, right-aligned, header right-aligned to match.
- Row hover: `bg-[--sf-surface-2]/60`. No hover on non-interactive tables.
- Empty: a single full-width cell, `text-sm --sf-text-muted`, `py-6`, centered
  — or an `<EmptyState>` (below) when there is an action to offer.

### List (Today queue, outreach thread, activity timeline, subscription rows)

- A list is **hairline-separated rows in one bordered container**, not a stack
  of individually-bordered cards. `divide-y divide-[--sf-border]` inside a
  `rounded-md border` wrapper, or bare rows with `border-t` when the list *is*
  the card body.
- Row vertical padding `py-3`. Primary line `text-sm font-medium`, secondary
  line(s) `text-sm --sf-text-muted`, metadata `text-xs --sf-text-faint`.
- Actions sit at the right edge of the row, vertically centered, and are the
  only accent-colored thing in the row.

---

## 6. Component vocabulary

One of each. Where a page has bespoke markup doing one of these jobs, it gets
replaced.

### Card / Section — `src/components/shared/card.tsx`

`<Card>` = `rounded-md border border-[--sf-border] bg-[--sf-surface]`, optional
`id` for anchors. `<CardHeader title description action />` = `px-4 py-3`,
bottom `border-b`, title `text-lg`, description `text-sm --sf-text-muted`,
`action` slot right-aligned. `<CardBody className>` = `p-4`, callers pass
`space-y-3` / grid as needed. A "section" and a "card" are the same component —
there is no separate section primitive.

### Section eyebrow — inline, not a component

`<p class="text-xs uppercase tracking-[0.02em] text-[--sf-text-muted]">` for
grouping labels inside a body (e.g. "Reasons", "Major findings"). Already used;
just standardize the classes.

### Badge — `src/components/shared/badge.tsx`

`tone` ∈ `neutral | info | warning | success | danger` (the `accent` tone is
**removed**). `bg-[tone-soft]`, `text-[tone]`, no border, `rounded-sm`,
`text-xs`, `px-1.5 py-0.5`, `whitespace-nowrap`. Optional leading 6px dot for
use in dense tables where the soft fill is too heavy. All the
`LeadStatusBadge` / `OutreachStatusBadge` / … wrappers stay; only their tone
maps change per §1.

### Button — `src/components/shared/button.tsx`

Variants collapse from five to **four**:

| variant | style | use |
|---|---|---|
| `primary` | `bg-[--sf-accent] text-[--sf-on-accent]`, hover `--sf-accent-hover` | the one primary action in a view |
| `secondary` | `border border-[--sf-border] bg-[--sf-surface-2]`, hover border `--sf-border-strong` | everything else |
| `ghost` | `text-[--sf-text-muted]`, hover `bg-[--sf-surface-2] text-[--sf-text]` | tertiary / icon-only / toolbar |
| `danger` | `text-[--sf-danger] bg-[--sf-danger-soft]` border `--sf-danger/25` | destructive confirm only |

`outline` is deleted (it was `secondary` without the fill). Sizes: `sm` = h-7
`text-xs`, `md` = h-8 `text-sm`. Radius `sm`. No shadow. Disabled = `opacity-50`.

### LinkButton — new, `src/components/shared/button.tsx`

A Next `<Link>` with button styling, for navigation actions that currently
render as `rounded border border-accent px-2.5 py-1 text-xs text-accent`
(Today row "Open business", `/leads/[id]` "Next actions" targets). Takes the
same `variant`/`size` as `Button`. Removes the hand-rolled accent-border link.

### Table — §5.

### EmptyState — new, `src/components/shared/empty-state.tsx`

`text-sm --sf-text-muted`, optional one-line `--sf-text-faint` sub, optional
single `Button`/`LinkButton`. Sits in a `CardBody` or replaces a table body.
Replaces the ~6 bespoke "No X yet." paragraphs.

### InlineCallout — new, `src/components/shared/callout.tsx`

`role="status"`, `rounded-sm`, `px-3 py-2`, `text-sm`. `tone` ∈
`info | warning | danger`, styled as `bg-[tone-soft] text-[tone]`. For the
`/today` reconcile-failure banner, the offer-amount-drift warning, the
manual-public-prospect note, the archived-terminal note. Replaces four
different ad-hoc warning treatments (`text-danger` paragraphs,
`border-warning/30 bg-warning-muted` divs, plain `text-muted` notes).

### PageHeader — `src/components/shared/page-header.tsx`

`h1` → `text-xl` (was `text-lg`; now clearly above card titles at `text-lg`).
Description `text-sm --sf-text-muted max-w-2xl`. `mb-6` (24px) to the first
section. `actions` slot right-aligned, top-aligned.

---

## 7. Accessibility (non-negotiable)

- Every text/background pair in §1 is verified ≥ 4.5:1 (body) or ≥ 3:1 (≥19px
  or bold ≥14px) by `src/lib/console-theme/contrast.test.ts`, which imports
  `contrastRatio` from the builder module (shared math, not shared tokens) and
  asserts against `src/lib/console-theme/palette.ts` — the TS mirror of the
  `--sf-*` hex values. `globals.css` and `palette.ts` must stay in sync; the
  test is what catches drift.
- Focus: `:focus-visible` stays `2px solid --sf-accent`, `offset 2px`. Never
  removed, never `outline: none` without a replacement ring.
- The mobile nav drawer, dialog focus trap, `aria-current` on nav, skip link,
  and reduced-motion handling that exist today are preserved.
- Status is never conveyed by color alone — every badge has a text label; the
  optional dot is redundant, not primary.
- Responsive behavior that exists (sidebar collapse < `lg`, table horizontal
  scroll, `sm:`/`md:` grid reflows) is preserved.

---

## 8. What this pass explicitly does not do

- No new dependencies, no CSS-in-JS, Tailwind utilities + `globals.css`
  `@theme` only.
- No information-architecture, route, navigation, or business-logic change
  (that was M10; this is paint).
- No restyle of prospect/customer-facing routes or `/visual-qa` / `/templates`.
- Does not touch `src/lib/builder/design-system.ts` or its presets.
