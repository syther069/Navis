# Navis Design System

**Status:** Design source of truth for implementation  
**Product:** Navis  
**Direction:** Proof Terminal  
**Design date:** 2026-09-16  
**Implementation status:** DS-01 tokens implemented in `app/globals.css`; UI-01 through UI-03 implemented

## Design read

Reading this as: an information-dense Web3 finance product for crypto-native investors and hackathon judges, with a premium institutional language, leaning toward an asymmetric trading workstation rather than a SaaS landing page.

### Design dials

- **Design variance: 7/10.** Distinctive silhouette and asymmetric composition, but predictable interaction patterns.
- **Motion intensity: 4/10.** Motion explains state changes; nothing floats or loops for decoration.
- **Visual density: 7/10.** A working surface for decisions and proofs, with deliberate breathing room around the critical action.

## 1. Visual theme

### Concept: Proof Terminal

Navis should feel like a private capital-allocation terminal crossed with a chain explorer: precise, quiet, and visibly accountable. Its visual fingerprint is a **decision spine**—a persistent vertical sequence connecting mandate, market snapshot, policy checks, signature, and portfolio delta. This turns the product's core promise into the page structure.

What someone should remember five minutes later:

> Every action has a visible rule, source, and proof.

The product is dark by default because it is a sustained-use financial workspace, not because “Web3 means black.” Contrast is controlled rather than neon. Signal amber marks intent and attention; state colors communicate outcomes. Fine ledger lines, tabular numerics, compact source annotations, and deliberate alignment make the interface feel financial. Large empty gradients, glowing coins, fake candlesticks, and terminal cosplay are forbidden.

### Personality

- **Measured:** never breathless, gamified, or profit-promising.
- **Exact:** full mint addresses, timestamps, sources, clusters, and rules are accessible.
- **Agent-native:** the agent is a capital-bearing mandate, not a chatbot mascot.
- **Transparent:** simulated, devnet, and mainnet states are impossible to confuse.
- **Premium:** achieved through proportion, typography, material restraint, and polish—not excessive effects.

## 2. Brand direction and visual identity

### Brand idea

**Navis is the navigation layer between intent and onchain action.** The identity draws from navigational instruments, ledger marks, and proof chains. It should not use nautical clip art, robot heads, stock arrows, rockets, or coins.

### Core motif

Use a restrained **bearing mark**: four short directional ticks around a small central square or diamond. The mark can represent navigation, constraints, and a verified decision point. It must remain legible at 16px and should be constructed as a simple geometric SVG during implementation.

### Wordmark behavior

- `NAVIS` in uppercase only in the compact product wordmark.
- Slightly tightened tracking, not spaced-out sci-fi lettering.
- Product headings use normal title case.
- Never append “AI” or “Web3” to the logo.

## 3. Color system

The base is a cool ink spectrum. Signal amber is the only brand accent. Semantic colors are reserved for state and never used as decorative accents.

### Core tokens

| Token              | Hex       | HSL            | Role                                |
| ------------------ | --------- | -------------- | ----------------------------------- |
| `--canvas`         | `#080B0F` | `216 30% 5%`   | App background                      |
| `--canvas-subtle`  | `#0C1117` | `213 31% 7%`   | Section alternation / sidebar       |
| `--surface`        | `#111820` | `211 31% 10%`  | Primary panels                      |
| `--surface-raised` | `#18212B` | `211 28% 13%`  | Menus, dialogs, selected rows       |
| `--surface-hover`  | `#1D2833` | `211 27% 16%`  | Hovered interactive surfaces        |
| `--text-primary`   | `#F3F6F8` | `204 26% 96%`  | Main text                           |
| `--text-secondary` | `#A9B4C0` | `211 14% 71%`  | Supporting text                     |
| `--text-muted`     | `#778390` | `211 10% 52%`  | Non-critical metadata; AA on panels |
| `--border`         | `#26313D` | `211 23% 20%`  | Default strokes                     |
| `--border-strong`  | `#3B4855` | `211 18% 28%`  | Focused grouping / table header     |
| `--brand`          | `#F5B942` | `41 90% 61%`   | Primary action and active intent    |
| `--brand-hover`    | `#FFCA68` | `40 100% 70%`  | Primary hover                       |
| `--brand-ink`      | `#171006` | `37 59% 6%`    | Text on brand surface               |
| `--info`           | `#62A8FF` | `213 100% 69%` | Informational state only            |
| `--success`        | `#45C987` | `151 55% 53%`  | Passed / confirmed only             |
| `--warning`        | `#F2A93B` | `35 87% 59%`   | Warning / pending only              |
| `--destructive`    | `#F06B6B` | `0 82% 68%`    | Failed / blocked / destructive only |
| `--simulation`     | `#9A8CFF` | `247 100% 77%` | Simulation identity only            |

### Light-mode stance

The hackathon MVP is dark-first and may ship dark-only. Do not produce a rushed inverted theme. If light mode is added, it must receive its own tested token map based on cold white, navy ink, and the same amber accent; it may not be generated with automatic color inversion.

### Color rules

- Brand amber indicates the chosen action, active navigation, focus emphasis, or primary CTA—not success.
- Green means a check passed or a transaction confirmed. Never use it merely to “make things feel live.”
- Purple is reserved for simulation state only, preventing generic purple-gradient branding.
- No text sits directly over a complex gradient.
- Body text must meet WCAG AA; critical numeric and status text should target AAA where practical.
- Charts use direct labels, strokes/patterns, and shapes in addition to color.

### Gradient and texture

Use a single atmospheric field only on the agent overview's command surface:

```css
background:
  radial-gradient(75% 95% at 82% 0%, rgba(245, 185, 66, 0.1), transparent 58%),
  linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 28%), var(--canvas);
```

Optional grain may be a subtle static asset at 1.5–2.5% opacity. No animated aurora, purple-blue mesh, or gradient border around every card. Pryzm is a production tool candidate for the one atmospheric background, and FeralUI is a reference candidate; neither should determine the palette.

## 4. Typography

### Families

- **Display and body:** Geist Sans via `next/font` or a self-hosted equivalent.
- **Data and code:** IBM Plex Mono via `next/font` or self-hosted.
- **Fallback:** `ui-sans-serif, system-ui, sans-serif`; data fallback `ui-monospace, SFMono-Regular, monospace`.
- Do not load fonts from a runtime Google Fonts `<link>`.

Geist keeps the interface contemporary without editorial affectation. IBM Plex Mono is limited to addresses, hashes, timestamps, rule IDs, and compact data labels. Body copy does not use monospace.

### Type scale

| Style                | Desktop |  Mobile | Weight | Line height | Tracking |
| -------------------- | ------: | ------: | -----: | ----------: | -------: |
| Display / agent name |    48px |    34px |    560 |        1.02 | -0.035em |
| H1                   |    40px |    32px |    560 |        1.08 |  -0.03em |
| H2                   |    28px |    24px |    540 |        1.15 |  -0.02em |
| H3                   |    20px |    18px |    540 |        1.25 |  -0.01em |
| Body                 |    16px |    16px |    420 |        1.55 |        0 |
| Compact body         |    14px |    14px |    430 |        1.45 |        0 |
| Label                |    13px |    13px |    560 |         1.3 |   0.01em |
| Metadata             |    12px |    12px |    450 |         1.4 |  0.015em |
| Primary numeric      | 28–36px | 24–30px |    520 |           1 | -0.025em |
| Table numeric        |    14px |    14px |    500 |        1.35 |        0 |

### Typography rules

- Use `font-variant-numeric: tabular-nums slashed-zero` for values, balances, percentages, time, and block data.
- Addresses use mono and middle truncation: `7xKX…8dP3`; full value remains copyable and visible in tooltip/detail.
- Headings use sentence case. Uppercase is limited to the `NAVIS` wordmark, mode stamps, and occasional 11–12px machine labels.
- Paragraphs max at 65 characters per line; dense tables are exempt.
- A heading hierarchy reflects the document outline; never choose heading tags for size.
- No hero headline exceeds two lines on desktop. Navis's product surface should not use a giant marketing headline.

## 5. Spacing and rhythm

Use a 4px base with a practical scale:

```text
1: 4px   2: 8px   3: 12px   4: 16px   5: 20px
6: 24px  8: 32px  10: 40px  12: 48px  16: 64px
20: 80px 24: 96px
```

Rules:

- Dense row padding: 10–12px vertical.
- Standard control height: 40px; compact control: 34px; primary action: 44px.
- Touch targets are at least 44×44px even if the visible glyph is smaller.
- Panel internal padding: 20px compact, 24px standard, 32px focal.
- Page sections are separated by 48–72px, not by wrapping everything in a card.
- Vertical rhythm follows 8px multiples except for optical type adjustments.

## 6. Grid and page frame

### Desktop, 1440px+

- Maximum content width: 1520px.
- Page gutters: 32px at 1280–1599px; 48px at 1600px+.
- App shell: 232px left navigation + flexible workspace.
- Workspace: 12-column grid, 24px gutters.
- Agent overview: 7-column primary command surface + 5-column constraint/treasury rail.
- Detail pages may use a 3-column context rail + 9-column record body.

### Laptop, 1024–1439px

- Navigation collapses to 72px icon rail at 1180px and below.
- Workspace gutters: 24px.
- Maintain two-column overview where each side stays at least 360px.

### Tablet, 768–1023px

- Navigation becomes a top bar plus drawer.
- Main panels stack in task order: decision → checks → treasury → history.
- Sticky contextual actions sit at the bottom and respect safe areas.
- Tables switch to horizontally scrollable data regions only when row comparison matters; otherwise use keyed rows.

### Mobile, 320–767px

- 16px page gutters; 12px internal compact panels.
- Header is 56px with wordmark, mode stamp, and menu.
- The primary action remains visible without covering content.
- Proof timeline is a single vertical spine.
- Wide wallet addresses and signatures wrap inside dedicated copy rows; the page itself never scrolls horizontally.
- Treasury table becomes asset rows with label/value pairs.
- Secondary metadata moves into expandable “Technical details.”

## 7. Layout system

### Product silhouette

Navis is a working surface. The first viewport opens on a selected agent and its current action state; there is no marketing hero before the product.

Desktop hierarchy:

```text
┌ navigation ┬ agent identity / mode / wallet ───────────────────────┐
│            ├ decision command surface ─────┬ constraint ledger      │
│            │ thesis + proposed action       │ pass / warn / block    │
│            │ primary action                 ├ treasury exposure      │
│            ├ proof spine / recent activity ─┴ market/source context  │
└────────────┴─────────────────────────────────────────────────────────┘
```

The right rail is not a collection of decorative KPI cards. It is a ledger: aligned rows, dividers, and one focal exposure figure.

### Composition principles

- Primary task occupies the largest continuous surface.
- Evidence sits adjacent to the action it explains.
- Use asymmetry through column weight, not arbitrary offsets.
- Use full-width divider bands for major state changes such as “Policy approved” or “Transaction confirmed.”
- Cards indicate actual containment, selection, or elevation. Related read-only data uses rows and dividers.
- Avoid repeating the same card grid on consecutive sections.

## 8. UI principles

1. **Proof before persuasion.** Evidence and source freshness are more prominent than promotional copy.
2. **Constraints are first-class.** A risk rule is never hidden behind a settings icon during approval.
3. **One dominant action.** Each state has one primary next step: generate, validate, review, sign, or verify.
4. **Progressive technical detail.** Judges see a readable summary; experts can expand exact mints, hashes, slots, and instructions.
5. **State survives color.** Icons, labels, borders, and placement distinguish status.
6. **No implied execution.** Language says “Prepare” before signature and “Submitted” before confirmation.
7. **Sources travel with values.** Prices and portfolio data show provider and freshness at point of use.
8. **User authority is visible.** Wallet approval is a deliberate boundary, not a background spinner.

## 9. Navigation

Desktop navigation is a quiet vertical rail:

- Wordmark and bearing mark at top.
- `Agent`, `Decisions`, `Markets`, and `Proofs` as primary destinations.
- Settings and provider health at bottom.
- Current route uses a 2px amber leading rule and brighter text, not a glowing pill.
- Agent switcher sits in workspace header rather than nav.

Mobile uses a modal drawer with focus trapping. Wallet and cluster controls remain in the header or drawer footer. Navigation state must be represented by URLs.

## 10. Component system

### Buttons

- **Primary:** amber fill, dark ink label, 10px radius, 44px height, no glow.
- **Secondary:** transparent or surface fill, `--border-strong`, primary text.
- **Quiet:** no container until hover; used for low-risk utilities.
- **Destructive:** red-tinted surface, destructive text/border; confirmation required.
- Active state moves down 1px or scales to 0.985 for 80–100ms.
- Labels use one action verb and do not wrap: “Generate”, “Review trade”, “Sign transaction”, “Verify proof”.

### Cards and panels

- Default radius: 12px.
- Focal command surface: 16px radius.
- Border: 1px solid `--border`.
- Shadows are rare; raised dialog shadow: `0 24px 80px rgba(0, 6, 12, .42)`.
- No glow borders or translucent glass cards over every surface.
- Use a subtle top inset highlight on raised panels only.

### Inputs

- Label above input, helper below, inline error beneath helper.
- 42px minimum height; 10px radius.
- Surface is slightly darker than surrounding panel, not white.
- Focus: 2px amber outline with 2px offset.
- Placeholders never replace labels.
- Numeric constraints show units and safe bounds beside the field.

### Selects and dropdowns

- Display label, symbol, and truncated mint for asset selection.
- Selected assets show verification/source state.
- Search is included only when the live list is large.
- Menus align to their trigger, stay within viewport, and support arrows, Enter, and Escape.

### Dialogs and drawers

- Use dialogs for destructive confirmation and signature review.
- Use right sheets for non-destructive detail such as source payloads.
- Mobile uses bottom sheets only when content is brief; long technical content uses a full-screen route.
- The transaction approval dialog must show cluster, wallet, mints, amounts, fees, programs, and expiry before its CTA.

### Tabs

- Underline/rail tabs, not pill tabs.
- Use only for peer views of the same object, such as `Overview / Strategy / Activity`.
- Tabs update the URL when direct linking is useful.
- On mobile, horizontally scroll with visible affordance; never shrink text below 14px.

### Badges and stamps

- Status badge radius: 6px, not pill-shaped.
- Mode stamp is uppercase mono: `DEMO`, `DEVNET`, or `MAINNET`.
- `MAINNET` uses warning treatment until action completes; it does not imply success.
- Avoid badges for ordinary metadata; use text rows.

### Tooltips

- For icon meanings, shortened addresses, and technical definitions.
- Never contain essential consent information.
- Keyboard and touch accessible; 250ms delay on pointer hover.

### Tables

- 14px text, 12px metadata, tabular numerics.
- Sticky header only for long datasets.
- Right-align numeric columns; left-align assets and state.
- Row hover is a quiet surface shift; selected row also has an amber leading rule.
- No zebra striping unless row density makes scanning difficult.
- Column titles stay visible and sorting state uses text plus icon.

### Data panels

- Prefer aligned ledger rows over nested mini-cards.
- One primary numeric, supporting delta, source, and timestamp.
- Sparklines are used only with real time-series data.
- Skeletons match the final row geometry; avoid generic spinners.

### Toasts

- Only for transient confirmation such as “Address copied.”
- Policy denial, launch failure, and transaction uncertainty remain inline and persistent.

## 11. Agent card design

Agent cards are used only in the agent switcher/list, not as the main profile.

- 16:9-ish horizontal composition, approximately 320×180px.
- Bearing mark/avatar at top left; mode stamp at top right.
- Agent name and one-line mandate occupy the center.
- Bottom ledger shows treasury value, active policy version, and last decision time.
- A thin state rail along the left indicates active/paused/error with label and color.
- No robot illustration, profile photo, fake status pulse, or decorative chart.
- Hover reveals `Open agent`; it must also be visible through keyboard focus.

## 12. Agent profile design

The profile is the main application home.

### Header

- Agent name, status, mode, owner/provider wallet, and strategy version.
- One sentence mandate; no large tagline.
- Primary action at right: `Generate decision`.

### Main composition

- Left: decision command surface and proof spine.
- Right: risk constraint ledger and treasury exposure.
- Below: recent decisions with outcome, action, timestamp, and proof status.

The profile should answer within five seconds: what the agent controls, what it may do, what it cannot do, and what it did last.

## 13. Strategy and risk panel design

Display strategy as a structured mandate, not a paragraph dump:

- Objective and horizon.
- Allowed assets.
- Signals and rebalance cadence.
- Constraint ledger with limit, observed value, and remaining headroom.
- Policy hash and version in an expandable footer.

Passed checks use a check icon and neutral/success text; they should not create a wall of bright green. Warnings use amber. A failed rule expands by default and visually interrupts the approval path with a full-width blocked band.

## 14. Treasury panel design

- Header: current value, reserve percentage, snapshot time, and source.
- Asset rows: token mark, symbol, full asset name, amount, value, weight, permission state.
- Allocation may use a single horizontal segmented bar with direct labels; do not default to a donut chart.
- Unknown or unvalued assets sit in a separate `Unvalued exposure` block and prevent a falsely precise total.
- Connected-wallet treasury and ClawPump agent treasury are visibly separate accounts.

## 15. Proof timeline design

The **decision spine** is Navis's signature component.

- Vertical 1px rule using `--border-strong`.
- Each node has time, stage, outcome, and one-line evidence summary.
- Stages: Snapshot → Proposal → Validation → Approval → Submission → Confirmation → Portfolio delta.
- Current step uses an amber square node; confirmed step uses success; blocked step uses destructive; simulation uses lavender and `SIMULATED` label.
- Expanding a node reveals exact source IDs, hashes, or RPC data inline.
- Connector never animates endlessly. On state transition, it may fill once over 300ms.

## 16. Transaction and proof receipt design

The receipt should resemble an instrument record, not a celebratory success modal.

### Summary band

- `CONFIRMED`, `PENDING`, `FAILED`, or `SIMULATED` stamp.
- Action and asset pair.
- Cluster and confirmation time.

### Evidence grid

- Decision hash, strategy hash, policy hash.
- Signature and explorer link when real.
- Slot, fee, program IDs, quote source, and request ID.
- Pre/post balances and portfolio delta.

### Integrity treatment

- Copy controls on every address/hash.
- Exact mode and data-source labels.
- If no signature exists, the space says “No onchain transaction was submitted”; it is not filled with a placeholder.
- Print/share layout may be added later, but no social card is required for MVP.

## 17. Homepage structure

The homepage is the selected agent workspace, not a marketing landing page.

1. Compact shell header with agent, mode, wallet, and provider health.
2. Agent identity and mandate.
3. Decision command surface with the current/next action.
4. Constraint ledger and treasury alongside it.
5. Decision spine.
6. Recent activity.

For a signed-out first visit, show the public Atlas demo agent and a clear `Connect wallet` secondary action. Users can understand the product before connecting.

## 18. Launch agent flow

Use a four-step route with visible progress, not a long modal:

1. **Mandate:** name, objective, horizon, cadence.
2. **Universe:** allowed mints and source/verification state.
3. **Limits:** trade size, concentration, reserve, turnover, slippage, cooldown.
4. **Review:** plain-language mandate, exact policy table, mode, provider linkage, and disclosures.

On desktop, a sticky right review ledger updates as fields change. On mobile, it becomes a `Review current setup` drawer. Creation success opens the agent profile; it does not trigger confetti.

## 19. Dashboard and decision flow

### Generate

Primary action changes the command surface into a structured loading state: snapshot source → strategy version → model proposal. Show elapsed progress only when real.

### Validate

Proposal sits left; checks resolve in the adjacent ledger. Checks may reveal sequentially once to explain causality, but users can skip motion.

### Review and sign

Approved state introduces one amber action band. Transaction review uses a focused dialog with decoded facts. Wallet prompt occurs only after confirmation.

### Confirm

The decision spine updates in place and the portfolio delta appears. Pending remains pending; there is no optimistic “Success.”

### Market launch

Stock-pair catalogue uses a compact table with mint and source. Pair selection, fee, payment, payout wallet, and fixed terms are summarized before launch. ClawPump and Meteora occupy separate labelled stages/tabs so their evidence cannot be conflated.

## 20. Shape language and depth

- Primary card radius: 12px; focal surface: 16px; controls: 10px; badges: 6px.
- Pills are reserved for binary segmented controls or compact filters where the shape communicates selection.
- Stroke weight: 1px default; 2px for focus and blocked state.
- No random mixture of sharp and fully rounded containers.
- Depth comes from nested surface values and inset highlights before shadows.
- Glass treatment, if used at all, is limited to the sticky mobile action bar with a solid-color fallback.
- Background grid lines may appear at 2–3% opacity only within the command surface.

## 21. Iconography and assets

- Use one line-icon family, preferably Phosphor at 1.5px–1.75px optical stroke.
- Icons clarify action or state; they do not sit in colored square tiles by default.
- Asset/token marks come from verified metadata or a deterministic monogram fallback.
- No generated lifestyle imagery is required: this is a technical working surface.
- No fake stock photography, avatars, robots, coins, holograms, or 3D chain art.
- The bearing mark and functional charts are code-native SVG/CSS; do not use representational SVG illustration.

## 22. Motion

### Tokens

```css
--duration-instant: 80ms;
--duration-fast: 140ms;
--duration-base: 220ms;
--duration-slow: 320ms;
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-exit: cubic-bezier(0.4, 0, 1, 1);
```

### Approved motion

- Button press and hover feedback.
- 160–220ms tab indicator transition.
- 220ms panel expansion using opacity and transform where possible.
- One-time 300ms proof-spine advancement.
- Value changes crossfade; they do not count upward theatrically.
- Skeleton-to-content transition without layout shift.

### Forbidden motion

- Infinite glowing/pulsing cards.
- Floating agent tiles, parallax decoration, bouncing arrows, or ambient particles.
- Animation that delays wallet approval or obscures pending status.
- Large blur/filter animation that harms performance.

`prefers-reduced-motion: reduce` removes non-essential transforms, disables smooth scrolling, and swaps transitions for near-instant opacity changes. No information may depend on animation.

## 23. Visual density

Navis is **information-dense with a single calm focal zone**. The treasury, policy, and proof history need efficient scanning; the active decision needs more space and stronger hierarchy. Density is reduced by alignment, grouping, and progressive disclosure—not by hiding critical data or wrapping every metric in a large card.

Density rules:

- Maximum one oversized number per panel.
- Keep critical constraint values visible during execution.
- Collapse raw provider payloads and verbose program details by default.
- Use 14px as the normal dense UI size; reserve 12px for secondary metadata.
- Avoid more than two nested bordered containers.

## 24. Interaction and state inventory

Every product component must account for:

- Loading with layout-matched skeleton.
- Empty with a specific next action.
- Partial/stale data with source and timestamp.
- Validation error adjacent to the field.
- Policy blocked with exact rule and remediation.
- Wallet disconnected, wrong wallet, and account changed.
- User rejected signature.
- Quote expired and transaction blockhash expired.
- Submitted but confirmation unknown.
- Confirmed with reconciled balances.
- Provider unavailable with safe retry rules.
- Demo fallback without fabricated onchain evidence.

## 25. Responsive rules by component

| Component          | Desktop                 | Tablet                      | Mobile                            |
| ------------------ | ----------------------- | --------------------------- | --------------------------------- |
| Navigation         | 232px rail              | Top bar + drawer            | 56px top bar + drawer             |
| Agent overview     | 7/5 split               | Stacked with decision first | Single column                     |
| Constraint ledger  | Sticky right rail       | Inline after decision       | Accordion; failures open          |
| Treasury           | Full table              | Reduced columns             | Asset rows                        |
| Proof timeline     | Detailed vertical spine | Same, narrower              | Summary first; expandable details |
| Launch review      | Sticky side summary     | Inline summary              | Full-screen review step           |
| Transaction dialog | 640–720px centered      | 90vw                        | Full screen / bottom action bar   |
| Tabs               | Inline                  | Scroll if needed            | Horizontal scroll with edge fade  |

No hover-only action is permitted. Desktop tables must preserve keyboard row actions. Sticky elements must respect viewport height and never conceal the last field or CTA.

## 26. Accessibility rules

- Target WCAG 2.2 AA.
- Visible `:focus-visible` ring on every interactive element.
- Skip link to the main workspace.
- Semantic headings, landmarks, lists, tables, and form relationships.
- 44px minimum touch target.
- Errors are associated with inputs and announced via appropriate live regions.
- Status changes use concise `aria-live` announcements; RPC polling does not spam screen readers.
- Dialogs trap focus, close with Escape where safe, and return focus to their trigger.
- Copy buttons announce success without replacing the address text.
- Charts provide text/table equivalents.
- Colors are never the sole status signal.
- Wallet addresses are readable by screen readers without inserting ellipsis into the accessible value.
- Respect reduced motion, increased contrast, browser zoom, and 200% text enlargement.
- Do not disable user zoom or remove browser focus outlines without a replacement.

## 27. Content and microcopy

- Use exact verbs: `Generate proposal`, `Run checks`, `Review transaction`, `Sign`, `Verify on Solana`.
- Avoid “magic,” “effortless,” “revolutionary,” “smartest,” or guaranteed-performance language.
- Distinguish `proposed`, `approved`, `prepared`, `submitted`, and `confirmed`.
- Say `tokenized exposure`, not `shares`, unless issuer documentation explicitly supports the legal claim.
- Error copy explains what happened, what remains safe, and the next valid action.
- Tooltips define terms in one sentence; they do not become mini documentation pages.

## 28. Do

- Put the agent's mandate and constraints next to the action.
- Show real source, cluster, freshness, and verification state.
- Use alignment and dividers to make dense data calm.
- Give hashes, mints, and signatures first-class copy interactions.
- Keep one amber primary action per state.
- Make rejection and uncertainty as thoughtfully designed as success.
- Use genuine live data when available and label fixtures at the data point.
- Let typography and the decision spine carry the brand.
- Decode transaction intent before asking for a signature.

## 29. Don't

- Do not use purple-blue branding, neon glows, animated blobs, star fields, or circuit-board wallpaper.
- Do not use a centered giant hero, generic bento features, testimonials, meaningless stats, or partner-logo filler.
- Do not represent the agent as a chat bubble or robot avatar.
- Do not place every metric in a rounded card.
- Do not use pills for ordinary navigation or metadata.
- Do not mix icon families, radius systems, warm and cool grays, or unrelated motion styles.
- Do not use fake charts, fake wallet addresses, fake signatures, fake activity pulses, or fake transaction success.
- Do not hide risk constraints during transaction approval.
- Do not auto-acknowledge sponsor risk warnings.
- Do not animate values or status merely to look “live.”

## 30. Anti-AI-slop quality checklist

- [ ] First viewport is the product workspace, not a marketing hero.
- [ ] One visual concept—Proof Terminal—is visible across every route.
- [ ] The decision spine is used consistently and not duplicated as decorative timeline variants.
- [ ] No repeated three-card/bento section pattern.
- [ ] No excessive eyebrows; machine labels appear only where they identify real state.
- [ ] One brand accent is used consistently.
- [ ] Green appears only for real passed/confirmed state.
- [ ] Cards represent containment or hierarchy; flat groups use dividers.
- [ ] CTAs use one label per intent and never wrap.
- [ ] No unsupported metrics, testimonials, users, charts, or integrations.
- [ ] No long copy blocks narrate obvious UI.
- [ ] Mobile has deliberate reordering and component-specific alternatives.
- [ ] Empty, blocked, pending, error, and simulation states look intentional.
- [ ] The page remains legible without gradients, motion, or hover.

## 31. Component sourcing policy

- Prefer accessible primitives already present in the eventual project.
- Search 21st MCP only for a concrete need such as a command palette, timeline, or transaction-review dialog; adapt tokens, radius, and motion before use.
- Use Skiper UI selectively for one interaction whose behavior materially improves feedback. Free/licensed components only, with required attribution preserved.
- Use Jiro as composition research only; do not paste unrelated landing-page sections into the product.
- Use Pryzm/FeralUI only to tune the single atmospheric background if needed.
- OpenDesign is optional for comparing a difficult composition, not a dependency requirement.
- Every imported component must pass licensing, bundle, accessibility, and visual-consistency review.
- Do not install multiple animation or icon libraries for overlapping jobs.

## 32. Implementation sequence

1. Encode color, typography, spacing, shape, and motion tokens.
2. Build the shell and selected-agent first viewport.
3. Implement the decision command surface, constraint ledger, treasury, and proof spine.
4. Add complete states before expanding routes.
5. Implement agent creation and transaction review.
6. Implement market-launch surfaces with separate ClawPump and Meteora evidence.
7. Perform responsive reflow component by component.
8. Run anti-slop, accessibility, and interaction audits.
9. Capture screenshots and refine hierarchy before considering the UI complete.

## 33. Visual QA plan

The restored application exists and its automated baseline passes. The checklist below remains open because final manual visual, responsive, and accessibility QA has not yet been supplied.

### Required viewports

- Desktop: 1440×900.
- Laptop: 1280×800.
- Tablet: 768×1024.
- Mobile: 390×844.
- Minimum-width sanity check: 320×700.

### Required screens and states

- Public/signed-out agent profile.
- Connected agent with fresh treasury.
- Decision generating, approved, blocked, and stale.
- Wallet disconnected and signature rejected.
- Transaction review, submitted/pending, confirmed, failed, and simulated.
- ClawPump pair loading/empty/error/preflight/result.
- Meteora configuration preview and pool status.
- Mobile navigation, drawers, forms, and technical details.

### Review methods

- Use Playwright CLI or the project's chosen Playwright runner for interaction and screenshots.
- Inspect keyboard order, focus visibility, semantic structure, touch targets, overflow, wrapping, sticky behavior, reduced motion, hydration, and loading shifts.
- Run the Vercel `web-design-guidelines` audit after implementation for accessibility, forms, focus, performance, state, and motion.
- Run Hallmark audit if installed; otherwise manually use its slop-test intent: identify repeated structures, default-template choices, unnecessary cards, weak hierarchy, and decorative effects.
- Compare screenshots as a product designer: first focal point, hierarchy, competing surfaces, rhythm, consistency, and recognizable visual fingerprint.

## 34. Research resources and usage notes

The following supplied resources informed this document:

- **Taste Skill:** used for brief inference, design dials, anti-default discipline, single-accent consistency, layout variance, shape consistency, state completeness, and responsive specificity. The public v2 guidance explicitly says it is aimed primarily at landing pages rather than dashboards, so its anti-slop principles were adapted rather than copied mechanically.
- **Hallmark:** used as an anti-template lens and source for study/audit discipline; no CLI audit was run because no UI exists.
- **Awesome DESIGN.md:** used for the source-of-truth structure: theme, tokens, typography, components, layout, depth, guardrails, responsiveness, and handoff guidance.
- **Pryzm Studio:** used to constrain background material to one subtle atmospheric field.
- **Jiro:** reviewed as a composition library; no template was copied.
- **21st MCP:** documented as a future component-search source; it was not installed or used to import a component.
- **Skiper UI:** reviewed at catalogue level; no component was selected or copied.
- **Vercel Agent Skills:** used to define the later accessibility, focus, forms, motion, performance, navigation, and state audit.
- **Playwright CLI:** used to define the later interaction and screenshot QA matrix; no browser tests have been run yet.
- **OpenDesign:** reviewed as an optional prototyping aid; it was not introduced as a dependency.
- **FeralUI Gradient Builder:** the provided page could not be accessed from the research environment, so no claim is made that a specific gradient was used.

## 35. Source-of-truth rule

During implementation, this file governs visual and interaction decisions. If a component library, reference, generated mockup, or convenience conflicts with this document, adapt the component or update this document deliberately. Do not allow silent visual drift.
