# Navis design system: first pass

Status: first coherent pass, implemented in the root Next app. Scope is shared
tokens, the shell, reusable primitives and modest home and Atlas improvements.
Nothing about routes, handlers, data sources, enablement logic or backend code
changed.

Prerequisites: the five skill commands from the master brief were run in order
and their full outputs read (`frontend-design`, `anti-ui-slop`,
`ui-ux-pro-max`, `redesign-existing-projects`, `pick-ui-library`). The
`anti-ui-slop` playbook used was `reference/new-work.md`. The
`pick-ui-library` list was consulted and no library was added: the existing
primitives (`route-primitives.tsx`, `shared/domain-primitives.tsx`) already
cover the surface this pass needs, and a base-ui or motion dependency is not
justified for a disclosure button and CSS transitions.

## 1. Audit

Inspected: `package.json`, `app/layout.tsx`, `app/(workspace)/layout.tsx`,
`app/globals.css` (3917 lines, one file), `components/workspace-shell.tsx`,
`components/route-primitives.tsx`, `components/shared/*`,
`components/decisions/run-decision-panel.tsx`,
`components/proofs/proof-receipt-view.tsx`,
`components/markets/prestocks/prestocks-research.tsx`,
`components/agent/navis-intro.tsx`, `app/(workspace)/page.tsx`,
`app/(workspace)/agents/atlas/page.tsx`, the rendered home and Atlas pages
(`docs/evidence/design-pass-before-home.jpg`,
`docs/evidence/design-pass-before-atlas.jpg`) and the UI tests that assert on
markup (`landing-page`, `policy-explanation-panel`, `proof-receipt-view`,
`prestocks-research-view`, `wallet-control-session`, `meteora-recovery-ui`).

Stack: Next (app router), React, TypeScript, Tailwind 4 via PostCSS but the
UI is written as hand-authored CSS classes, Geist Sans plus IBM Plex Mono,
Phosphor icons. No animation library. No component library.

What already worked and was kept: skip link, trapped mobile navigation dialog
with focus restore and `inert` background, semantic landmarks, honest mode and
cluster stamps derived from `getPublicCapabilities()`, assurance labelling,
loading skeletons, empty and error states.

The wider source audit also covered the market launch route, ClawPump and
Meteora panels, transaction ledger, auth/wallet controls, settings,
disclosures and documentation. No dedicated FAQ or footer exists. Pyth is
not implemented; this pass does not add or imply a working integration.

What was wrong:

- Headings were oversized for a workspace: agent and route titles ran to
  3.3rem, the home sentence was set as a hero. The page read as a landing
  template rather than research software.
- Uppercase monospace metadata (`route-eyebrow`, `heading-meta`,
  `section-kicker`, `panel-heading span`, `decision-context span`, list
  captions) competed with the content it labelled. Monospace was used as a
  decoration, not as a data typeface.
- The same bordered panel was used for everything, including three identical
  card rows on the home page (proof points, entry links) and pill stamps in the
  Atlas intro.
- `--text-muted` (#778390 on #111820) sat near 4.3:1; several small mono
  captions were 10 to 11px in that colour.
- Decorative gradients: a radial amber wash on `body`, `.landing-hero`,
  `.navis-intro`, `.decision-surface` (with a dot grid), `.wallet-dialog`.
- The workspace bar hardcoded "Atlas / Balanced equity" on every page,
  including Decisions, Markets, Proofs and Settings.
- The compact rail (<= 1180px) hid link text with no visible label on hover or
  focus.
- Below 620px the cluster stamp was hidden, so the network truth left the bar.
- The mobile navigation Settings link lacked `aria-current`.
- Undefined custom properties were referenced (`--positive`,
  `--color-border-subtle`, `--color-surface-raised`, `--color-text-muted`,
  `--text-xs`), so the wallet live dot and pair cards fell back to browser
  defaults.
- No z-index or motion scale; values were ad hoc (15, 18, 20, 50, 70, 100).

## 2. Direction

Navis is a research and risk workspace: a person must understand why a
proposal passed or failed policy before trusting the receipt. The interface
should feel like premium, restrained financial software with an onchain
substrate: quiet surfaces, one accent used for action and position, data set
in a real data typeface, and status carried by icon plus label plus colour.

Layout paradigm: fixed rail plus a single reading column. Reading order on
every page: where am I (bar), what is this (title, one line), the primary
content, the primary action, then supporting detail. Content is left aligned
throughout; nothing is centred except empty states.

Not wanted, and removed where it existed: hero typography, glow, gradient
washes, dot grids, identical card rows, pills, uppercase mono captions,
terminal styling.

## 3. Typography

Families kept, roles redefined.

- Geist Sans stays as the UI face. Rationale: neutral grotesk with even
  colour at 13 to 16px, real tabular figures, already shipped via
  `geist/font/sans` with zero layout shift.
- IBM Plex Mono stays as the data face, but only for data: hashes, addresses,
  amounts, slot numbers, cluster names, identifiers. It is no longer used for
  eyebrows, captions or headings.

Roles (tokens in `app/styles/tokens.css`):

| Role                                          | Token              | Size                                      | Weight | Line height | Tracking                   |
| --------------------------------------------- | ------------------ | ----------------------------------------- | ------ | ----------- | -------------------------- |
| Display (home sentence only)                  | `--type-display`   | clamp(1.625rem, 1.2rem + 1.6vw, 2.125rem) | 560    | 1.18        | -0.025em                   |
| H1 (route and agent titles)                   | `--type-h1`        | clamp(1.375rem, 1.1rem + 1vw, 1.75rem)    | 600    | 1.2         | -0.02em                    |
| H2 (panel titles)                             | `--type-h2`        | 1.125rem                                  | 600    | 1.3         | -0.01em                    |
| H3 (sub-sections, list titles)                | `--type-h3`        | 1rem                                      | 600    | 1.35        | 0                          |
| Body                                          | `--type-body`      | 0.9375rem                                 | 400    | 1.55        | 0                          |
| Secondary                                     | `--type-secondary` | 0.875rem                                  | 400    | 1.55        | 0                          |
| Label (eyebrows, field labels, sentence case) | `--type-label`     | 0.8125rem                                 | 500    | 1.4         | 0                          |
| Caption (notes, footnotes)                    | `--type-caption`   | 0.75rem                                   | 400    | 1.45        | 0                          |
| Numeric (amounts, percentages)                | `--type-numeric`   | 0.875rem mono                             | 500    | 1.3         | tabular-nums, slashed-zero |
| Technical (hashes, ids)                       | `--type-technical` | 0.75rem mono                              | 400    | 1.5         | overflow-wrap anywhere     |

Rules: sentence case everywhere. The only uppercase left is the two or three
character network seal (`.mode-stamp`), which is a stamp by design and is set
in the UI face with 0.06em tracking. Numbers use `font-variant-numeric:
tabular-nums` so columns of percentages and amounts align. Body copy is capped
at 68ch.

## 4. Spacing

4px base scale, unchanged tokens `--space-1` to `--space-24`, plus semantic
tokens so components stop picking arbitrary values:

- `--gutter`: page inline padding, clamp(1rem, 2.5vw, 2rem)
- `--section-gap`: between unrelated blocks, 1.75rem (1.25rem below 620px)
- `--panel-pad`: inside a panel, 1.375rem (1rem below 620px)
- `--stack-gap`: between related rows, 0.75rem
- `--inline-gap`: between inline items, 0.5rem
- `--heading-gap`: title to body inside a heading, 0.375rem

Route header margin drops from 28 to 24px, agent heading from 34 to 24px,
panel padding from 24 to 22px, and the decision surface loses its 60px and
64px internal gaps. Related things sit closer, unrelated things keep the
section gap.

## 5. Colour

Dark scheme kept. Rationale: the legacy stylesheet contains several hundred
dark-specific overlay values; a light scheme would be a rewrite, which the
brief forbids for this pass. Within dark, the palette was rebuilt: cooler and
lifted canvas, one brass accent with hover and active steps, semantic status
colours, and higher-contrast secondary and muted text.

| Token              | Value   | Use                                |
| ------------------ | ------- | ---------------------------------- |
| `--canvas`         | #0f141b | page background                    |
| `--canvas-subtle`  | #131923 | muted surface, rail, drawers       |
| `--surface`        | #171e28 | panels                             |
| `--surface-raised` | #1d2531 | menus, selects, secondary buttons  |
| `--surface-hover`  | #232d3a | hover on raised surfaces           |
| `--border`         | #28323f | default border                     |
| `--border-strong`  | #3b4757 | emphasised border, controls        |
| `--text-primary`   | #eef2f6 | primary text (15.2:1 on surface)   |
| `--text-secondary` | #b7c1cd | secondary text (9.3:1)             |
| `--text-muted`     | #8e9aa8 | muted text (5.6:1)                 |
| `--text-disabled`  | #66717f | disabled text                      |
| `--accent`         | #d9a441 | primary action, current nav, focus |
| `--accent-hover`   | #e3b45a |                                    |
| `--accent-active`  | #c69436 |                                    |
| `--accent-ink`     | #1a1205 | text on accent                     |
| `--success`        | #4fc38a | pass, verified, live onchain       |
| `--warning`        | #e0a43c | warn, stale, pending authorization |
| `--danger`         | #e8706c | fail, block, invalid, errors       |
| `--info`           | #6fa8e6 | devnet, informational              |
| `--simulation`     | #a89fd6 | demo simulation label only         |

The legacy names `--brand`, `--brand-hover`, `--brand-ink`, `--destructive`
and `--positive` are kept as aliases so the 3900 legacy lines keep resolving.
Every tinted background is derived from these with `color-mix`, not a new hex.

## 6. Radius, focus, z-index, motion

- Radius: xs 4px (badges, stamps), sm 6px (inputs, small buttons), md 8px
  (buttons, menu items), lg 10px (panels), xl 14px (dialogs). Pills are not
  used.
- Focus: 2px accent outline, 2px offset, on `:focus-visible` for every
  interactive element; inputs use a 1px accent border plus a 3px accent ring at
  22% for the same state.
- Z-index scale: `--z-bar` 15, `--z-rail` 20, `--z-notice` 25,
  `--z-drawer` 50, `--z-popover` 70, `--z-dialog` 100, `--z-skip` 110.
- Motion: `--duration-press` 90ms, `--duration-fast` 140ms,
  `--duration-state` 240ms, one standard ease. Motion only answers an action:
  hover, press, disclosure open, skeleton scan. `prefers-reduced-motion`
  collapses all durations.
- Interactive states on every control: hover (surface shift), pressed
  (1px translate plus darker accent), loading (`aria-busy` or disabled with a
  progress cursor), disabled (46% opacity, not-allowed cursor), error (danger
  border and text near the field).

## 7. Components

- `InfoHint` (`components/shared/info-hint.tsx`, new): an accessible
  disclosure for unfamiliar actions. A real button with `aria-expanded` and
  `aria-controls` toggles an in-DOM panel that answers "What it is", "Why it
  matters" and "What happens next". Opens on click, tap or keyboard, closes on
  Escape, outside click or the button; the panel is not hover-only and never
  the sole place the information lives. Copy lives in
  `components/shared/info-hint-content.ts` and is drawn from statements the app
  already makes. Used on: run or generate decision, policy verdict, assurance
  badge, verify receipt, proof receipt verifier.
- Workspace bar: the hardcoded Atlas lockup is replaced by a route context
  derived from the pathname (section icon, section label, and a second line
  only when it is truthfully known: "Demo agent" for Atlas, the slug for other
  agents, "New agent" for the form). Mode stamp, cluster stamp and wallet
  control stay in place; the cluster stamp is now visible at every width.
- Rail: compact mode (<= 1180px) keeps the accessible label and adds a visible
  label on hover and focus. Mobile Settings link carries `aria-current`.
- Buttons: `.primary-button`, `.secondary-button`, `.icon-button`,
  `.wallet-button` share one state model (hover, pressed, focus, loading,
  disabled). Weights drop from 720 to 600.
- Status: `.status-badge` keeps its icon plus label and gets a faint tinted
  background per tone so pass, warn, block, pending and simulation are
  distinguishable without relying on colour alone.
- Panels: `.route-panel` keeps its border but the home proof points and entry
  links become one grouped list each, not three cards; the Atlas intro stamps
  become square status tags; the decision surface drops its grid and radial
  wash.
- Eyebrows and captions: sentence case, UI face, secondary or muted colour.
  Class names are unchanged so tests and markup stay stable.

## 8. Files

Styles are split by concern and imported by `app/globals.css`. The legacy
rules stay in `globals.css` inside `@layer navis-legacy`; the new files are
imported into `@layer navis-system`, which is declared after it, so the system
wins without specificity games and each override is a small, reviewable file.

- `app/styles/tokens.css` (new): layer order, all custom properties, legacy
  aliases.
- `app/styles/base.css` (new): document, focus, selection, reduced motion.
- `app/styles/typography.css` (new): type roles and de-uppercased metadata.
- `app/styles/controls.css` (new): buttons, inputs, selects, status badges,
  stamps.
- `app/styles/shell.css` (new): rail, bar, route context, drawer, responsive.
- `app/styles/surfaces.css` (new): panels, home, Atlas intro, decision surface,
  empty state, policy and proof surfaces.
- `app/styles/info-hint.css` (new): the disclosure.
- `app/globals.css` (modified): tokens removed, legacy wrapped in a layer.
- `components/workspace-shell.tsx`, `components/shared/info-hint.tsx` (new),
  `components/shared/info-hint-content.ts` (new),
  `components/shared/assurance-badge.tsx`,
  `components/shared/policy-explanation-panel.tsx`,
  `components/decisions/run-decision-panel.tsx`,
  `components/proofs/proof-receipt-view.tsx`. The home page and Atlas page
  markup were not edited; their changes are CSS only, keyed on existing class
  names.

## 9. Preserved and deliberately not changed

- Routes, handlers, API calls, auth, wallet session, signing, Meteora
  enablement logic (guarded Devnet stays exactly as coded), ClawPump state,
  PreStocks read-only labelling, Atlas demo mode, fixture numbers.
- `data-testid` attributes, button names ("Run decision", "Generate decision",
  "Verify receipt", "Open Decision", "View Proof", "Copy Proof Link"),
  `class="mode-stamp"` and `class="cluster-stamp"` markup asserted by tests.
- Loading, empty and error components and their behaviour.
- Legal and disclosure links; no new footer, FAQ or pages were invented.
- The favicon and brand lockup.

## 10. Deferred

- Light scheme: a real option once legacy overlays are tokenised.
- Markets (ClawPump, Meteora) and Transactions surfaces still use legacy panel
  rules; they inherit the tokens and controls but their layouts were not
  re-cut. InfoHint entries for Meteora and ClawPump should be written against
  those components' actual state machines in the next pass.
- Tables: PreStocks and ledger rows inherit tabular numerals and the new type
  roles but need a dedicated density pass at 768px and below.
- Wallet dialog: tokens and radius applied through aliases; its internal
  layout was not touched to keep the `wallet-control-session` behaviour
  untouched.
- Legacy rgb overlays should be migrated to `color-mix` on tokens file by
  file, retiring `@layer navis-legacy` when it is empty.

## 11. Verification and remaining limitations

- Production build, TypeScript and lint passed.
- Six focused UI test files passed, including the new disclosure tests:
  34 tests covering existing landing, policy, receipt, wallet and Meteora
  recovery contracts, plus help toggling, dismissal and focus restoration.
- The broader test run passed 597 tests and failed 10 database-dependent
  tests. The development database is missing the session-family migration
  (`auth_session_families`). No schema or backend changes were made.
- A real Chromium session checked home, Atlas, new agent, market launch,
  demo proof, settings and disclosures at 320, 375, 414, 768, 1024 and
  1280px. All 42 page/width combinations passed without page overflow,
  unlabelled visible buttons or uncaught JavaScript exceptions.
- Contextual help was opened and dismissed at every tested width.
  Mobile navigation focus trapping, active Settings state and Escape
  restoration passed. The wallet chooser opened and dismissed at 375px.
  No wallet was connected, no transaction was signed and no execution
  setting was changed.
- The responsive check found and corrected narrow market-grid overflow.
  Help uses a viewport-contained panel below 860px and 44px controls,
  avoiding invisible oversized hit areas over adjacent content.
- Receipt help explicitly distinguishes internal hash consistency from
  independent authorship, policy-input verification and settlement.
- Before/after captures are in `docs/evidence/design-pass-*.jpg`.
  Reproduce the read-only browser check with
  `node scripts/check-design-system.mjs <running-app-origin> <output-folder>`.
  The latest full report is `/tmp/navis-design-after/report.json`.
- Authenticated end-to-end signing and live onchain operations were not
  exercised by this visual pass. The screenshot service reports a local
  Next HMR WebSocket handshake warning; the proxied browser check rendered
  all seven routes successfully.

Additional verification files: `tests/info-hint.test.tsx` and
`scripts/check-design-system.mjs`.
