# Design System

Primary visual reference: `reference/design/` (desktop ×3, mobile ×6, typography ×2).
The video in `reference/video/` informs **behaviour and motion only**.
We borrow the language — never the SugarCRM logo, names, people, copy or exact layouts.

## 1. What the references actually show

| Observation | Source |
|---|---|
| App sits on a cool light-gray canvas that drifts to a faint blue at the bottom | desktop1, t07 |
| Content lives in large translucent-white panels (~32px radius) holding smaller, whiter nested cards (~20–24px) | desktop1, t07 |
| Exactly one near-black element marks "active": nav pill, selected workflow node, primary CTA, FAB | desktop1 (Cases pill, Request Processing node), mobile1 |
| Every utility action is a 40–44px circular button with a hairline ring, no fill | desktop1 top bar, card headers |
| Left rail: vertical stack of circular icon buttons, theme toggle pinned bottom (dark circle = active) | desktop1 |
| Top bar: logo left, centered text nav with black pill for active, round search/mail/bell + avatar right; small coral dot = unread | desktop1 |
| Page title is large, medium weight, tight tracking; section titles ~17px medium | desktop1 |
| Numbers are big and light with a small unit suffix (`134 hrs.`, `12,310 $`) | mobile3 |
| Avatars carry a tiny pastel count badge underneath | mobile1, t07 |
| Progress rendered as thick rounded segmented bars in pastel blue/yellow/peach/coral and thin ring gauges | mobile3, t07 |
| Status chips are small filled pills: blue "Executed", coral "Scheduled" | desktop1 table |
| Workflow: columns of stacked node cards, joined by thin curved connectors with small dot ports; dashed for pending | desktop1, mobile1 |
| Dark card (`#29292C`) used once per screen as a focus surface (date picker) with coral range highlight | mobile1 right |
| Mobile: big 2-line title, stacked cards that overlap like a deck, floating black circular FAB, right-edge vertical action rail | mobile1, mobile3 |
| Shadows are almost absent; separation is by tone and translucency | all |

## 2. Tokens (`app/globals.css`)

Semantic tokens only; components never use raw hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#E3E5E9` | `#0E1116` | App canvas |
| `--background-tint` | `#D3DAE8` | `#121722` | Bottom gradient stop |
| `--surface` | `rgb(255 255 255 / 0.55)` | `rgb(255 255 255 / 0.04)` | Large panels |
| `--surface-secondary` | `#F4F5F7` | `#1A1E25` | Inputs, list rows |
| `--surface-elevated` | `#FBFBFB` | `#20252D` | Nested cards, menus, sheets |
| `--surface-active` | `#10141A` | `#F4F5F7` | Active pill, selected node, primary CTA |
| `--surface-dark` | `#29292C` | `#1B1F26` | Focus/feature card |
| `--foreground` | `#10141A` | `#ECEEF2` | Primary text |
| `--foreground-muted` | `#6B7079` | `#9097A3` | Metadata |
| `--foreground-subtle` | `#9AA0A9` | `#646B77` | Placeholder, captions |
| `--foreground-on-active` | `#FFFFFF` | `#10141A` | Text on active surface |
| `--border-subtle` | `rgb(16 20 26 / 0.08)` | `rgb(255 255 255 / 0.08)` | Hairline rings |
| `--accent-blue` / `-soft` | `#83A2DB` / `#B9DEFF` | same hue, lower L | Info, executed, progress |
| `--accent-red` / `-soft` | `#CE6969` / `#FD8E8C` | | Urgent, scheduled, alerts |
| `--accent-yellow` / `-soft` | `#F2B45A` / `#FFCE87` | | Warning, medium priority |
| `--accent-green` / `-soft` | `#5FAE8B` / `#BFE5D2` | | Success, done |
| `--accent-peach-soft` | `#FFC59E` | | Secondary progress segment |
| `--success` `--warning` `--danger` | map to green / yellow / red | | Semantic state |
| `--focus-ring` | `#83A2DB` | | Keyboard focus |

Green is an addition (refs have none); kept desaturated to sit with the pastels.

## 3. Typography

Lufga (reference) is commercially licensed. We use **Plus Jakarta Sans** (OFL, via `next/font`) —
geometric, rounded terminals, good numerals. Swap is a single `next/font` change.

| Role | Size / line | Weight | Tracking |
|---|---|---|---|
| Page title | 32/38 (mobile 30/34) | 500 | -0.02em |
| Section title | 17/24 | 500 | -0.01em |
| Card title | 15/20 | 500 | 0 |
| Body | 14/20 | 400 | 0 |
| Metadata | 12.5/16 | 400 | 0 |
| Caption | 11/14 | 500 | 0.01em |
| Metric | 28/32 | 400 | -0.02em, `tabular-nums`, unit at 13px muted |

Only weights 400, 500, 600 are allowed.

**Persian / Arabic script: Vazirmatn** (OFL, `next/font/google`, arabic subset). It's geometric with soft terminals, has full Persian digits, and sits well beside Jakarta.
- The root layout sets one explicit stack per direction. fa: Vazirmatn → Jakarta → fallback. en: Jakarta → Vazirmatn → fallback. Each script always renders in its real face, including mixed content.
- Letter-spacing is neutralised under `:lang(fa)`: negative tracking breaks cursive joining.
- Persian needs taller line boxes: page titles use 40–42px line height and card titles 24px.
- Persian digits come from Intl (`fa` → `۰-۹`). Dates are Gregorian with Persian month names.

## 4. Geometry

| Element | Radius |
|---|---|
| Page panel (`Panel`) | 32px (`--radius-panel`) |
| Nested card (`Card`) | 24px (`--radius-card`) |
| Row / input / menu | 16px (`--radius-control`) |
| Chip, pill, nav item, buttons | full |
| Icon button | circle 40px (sm 32, lg 48) |

Spacing scale is Tailwind's 4px grid. Panels pad 24px (mobile 16px); gaps between panels 16px.

## 5. Elevation & surfaces

- Level 0 canvas → level 1 `surface` panel (translucent + 24px backdrop blur) → level 2
  `surface-elevated` card → level 3 overlays (sheet/modal) with soft `--shadow-overlay`.
- Hairline `ring-1 ring-[--border-subtle]` instead of borders. No heavy drop shadows.
- At most one dark focus card per view.

## 6. Interaction & motion (from `reference/video/scroll_choreography.md`)

| Motion | Spec |
|---|---|
| Overlay open | backdrop `blur(0→12px)` + dim; panel `scale(.96→1)` + fade, 280ms, `--ease-out-expo` |
| Content build-in | `translateY(8px)`→0 + fade, 300ms, 60ms stagger per row/card |
| Hover on node/row | background tone shift, 150ms; selected → `surface-active` |
| Drag | lifted card gets `--shadow-overlay`, contextual black pill action appears (video 1.7s) |
| Route change | crossfade content only; shell stays put |

`--ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1)`. All motion is disabled under
`prefers-reduced-motion: reduce`.

## 7. Navigation

Revised 2026-10-04 (reference alignment, top-shell redesign): the source references show both a
horizontal top nav (logo left, centred text pills, black active pill, round actions + avatar
right) **and** a left icon rail — not an either/or. The product owner's final call: the top nav is
the **primary** module switcher; the left rail comes back as **contextual sub-navigation** for
whichever module is active, not as a second copy of the primary nav.

- **Desktop ≥1024px:**
  - **Header** (full width, top): three zones in a `[minmax(0,1fr)_auto_minmax(0,1fr)]` grid (same
    pattern as §14's panel header): **start** — logo + compact context switcher (personal ↔
    workspace); **centre** — primary nav as plain text links, the active one in a black pill
    (`PrimaryNav`, only modules that exist — currently Home, Planner, Projects, Team); **end** —
    quick add, theme toggle, account avatar, all 36–40px circular actions. Sits directly on the
    page background (no card, no shadow).
  - **Sub-nav** (`SubNav`, left, below the header): a 76px icon rail scoped to the active module's
    own views/pages, shown only for modules that actually have sub-views (currently Planner's 8
    views: Inbox/Today/Upcoming/Overdue/Scheduled/Someday/Completed/All tasks). Renders nothing for
    modules without sub-views rather than inventing placeholder icons (§98). This is additive to,
    not a replacement for, a module's own in-panel navigation (e.g. Planner's pill row stays).
  - Below the header, each page renders its own compact `PageTitle`.
- **Tablet/Mobile <1024px:** the centre nav and `SubNav` both hide; the header keeps logo + context
  switcher (start) and actions (end) only. Primary navigation moves to `MobileTabBar`: a floating
  pill bar (Home, Planner, Projects, Team) + black circular quick-add FAB. Detail views open as
  bottom sheets.
- Settings has no standalone nav entry — it lives in the account (avatar) menu on every breakpoint.

## 8. Component rules

- Buttons: `primary` (active surface, pill), `secondary` (elevated surface + ring), `ghost`,
  `icon` (circle + ring). Min hit target 40px (mobile 44px).
- Chips: filled soft accent, 11–12px text, pill.
- Avatars and people groups: see §13. Always `PeopleCluster`, never a hand-rolled row.
- Progress: segmented bar (rounded 6px tall segments, 4px gap) and ring gauge (6px stroke).
- Tables collapse to card lists < 768px.
- Workflow connectors: SVG paths with 1.25px stroke in `--foreground-subtle`, accent-red when
  blocking, dashed when pending; ports are 6px dots. Only drawn for real relationships
  (dependencies, stages, automation edges).

## 9. Anti-goals

Not the shadcn demo look, not Bootstrap/admin template, not Linear/Notion/Monday clones. No
gradients on text, no glassmorphism beyond the single panel blur, no decorative connectors.

## 10. Pages without a visual reference (§96)

Most modules (finance, chat, habits, docs, forms, CRM, …) have no reference image. They are built by **composition**, never by a new visual system:

1. Write down the functional requirements (PAGE_INVENTORY block).
2. Map each need to an existing pattern:
   - list → `Panel` + rows (TaskRow style)
   - entity summary → `Card` with `Metric`/`RingGauge`/`SegmentedBar` (ProjectCard style)
   - detail/edit → `Sheet`
   - navigation inside a module → pill tabs
   - one emphasis → `DarkCard`
   - relationships → WorkflowCanvas (real relations only)
3. Use only the tokens, type scale, radii and spacing in §2–§5.
4. Keep the same shell and navigation model (rail / top bar / mobile tab bar + FAB).
5. Design the mobile state explicitly (stack, sheet, cards, horizontal-scroll workflow).

## 11. Visual regression loop (§88)

After each major page, run the loop in QA.md §5:
1. Screenshot desktop 1440×960 and mobile 390×844, light and dark.
2. Compare against `reference/design/*` and sibling screens.
3. Check spacing, alignment, type, hierarchy, surfaces, radii, button sizes, card proportions and responsiveness.
4. Fix, then repeat.

One pass is never enough to call the UI done.

## 12. RTL and localization rules

- **Logical properties only:** `ms/me`, `ps/pe`, `start-*/end-*`, `text-start/end`, `rounded-s/e`. Avoid `ml/mr/pl/pr/left/right` unless something is physically fixed.
- **Mirror** directional icons: back/forward chevrons (`rtl:rotate-180`), "open" arrows and sign-out (`rtl:-scale-x-100`).
- **Don't mirror** neutral icons: plus, close, check, flag, repeat, calendar, clock. Ring gauges keep their clockwise fill.
- **Follows direction automatically** (flex/grid along the inline axis): segmented bars, avatar stacks (`space-x` is logical in Tailwind 4), pill rows, tab-bar order, FAB side, and the sheet's entry edge.
- **User content:** add `dir="auto"` so a Persian title in an English UI, or the reverse, lays out correctly. Emails, IANA timezones and parser tokens render `dir="ltr"`.
- **No fixed widths for text.** Pills use `whitespace-nowrap` inside scrollable rows; cards tolerate longer strings.
- Both directions go through the §11 visual loop.

## 13. People pattern (standard for every small group of related users)

Reference:
- desktop1 header avatar strip with pastel count chips
- mobile3 "Task allocation" row
- video case cards with overlapping faces and colored badges

**Whenever a module shows the people attached to something, it uses `PeopleCluster`.** That covers:
- project members
- task assignees and watchers
- meeting participants and chat participants
- reviewers and approvers
- request people
- workspace and team previews
- workflow nodes and summary widgets

| Rule | Implementation |
|---|---|
| Circular faces | `Avatar` (circle; sizes xs 24 · sm 32 · md 40 · lg 48) |
| Photo if available | `avatarUrl` → `<img>` (lazy, no-referrer) |
| Otherwise initials on a stable soft pastel | `initialsOf` (any script; one letter at xs) on `avatarTone(id)`, keyed by id, never by name |
| Compact overlap for cards, rows, nodes | `variant="overlap"`; overlap ≈ ⅕ of a face so initials stay readable; logical spacing mirrors in RTL |
| Spaced row with tiny count/status badges | `variant="spaced"` + `badge: { kind: "count" \| "status" }`; pastel chip centred under the face (reference allocation numbers) |
| Header strip | `variant="strip"`: soft pill surface in detail headers |
| Soft separating rings | `on="elevated" \| "secondary" \| "dark"` matches the surface behind the faces |
| Overflow | `+N` chip (localized aria label); `total` counts people beyond the loaded preview; never a "+1" chip |
| Placement | near the top/header of cards and sections; at the inline end of task rows and node cards |
| Badges show real data only | e.g. open tasks assigned per member; no decorative numbers (§75) |
| Accessibility | group `aria-label` (what these people are); each face is named, with the badge meaning appended ("Arash — 5 open tasks") |

Badge tones for workload: 1–2 open → blue, 3–4 → yellow, 5+ → red, 0 → neutral.

Not this pattern: full directories and lists (Team rows, member management, search results). Those use rows with a single `Avatar` plus details.

## 14. Panel headers and forms (reference alignment, 2026-10-03)

**Panel header with selectable pills** (reference: "Case Pipelines | Pipelines · In Progress · Completed · Expired | actions"):
- One row, three zones: section title + count at the **start**, selectable pills **centred**, actions at the **end**. It's a `[minmax(0,1fr) auto minmax(0,1fr)]` grid from `lg` up.
- Pills: inactive = white chip with a hairline ring; active = near-black.
- Below `lg`, the pills drop under the title and scroll horizontally inside the panel. The page grid uses `minmax(0,1fr)` so a long pill row never widens the page.
- Used by: Planner views. Any future module with view/status pills follows the same pattern.

**Forms** (reference: "Processing of the New Case"):
- **Single column.** Every label sits above its field at the inline **start**, never in a second column mid-form.
- Fields are **white pills** (`h-12 rounded-full`) with a hairline ring, on a soft grey surface (`surface-secondary`) for dialogs and sheets. Textareas use a 22px radius.
- Selects show a chevron at the inline end (mirrors in RTL).
- Related controls that belong to one concept share a row under one label (due date + time).
- Dialog: title at the start, round close button at the end, hairline divider. The footer is two **equal** pills: secondary dismiss + primary action (`DialogFooter`).
- Sizes are set on wrappers, never by overriding `Input`'s width/height classes (`cn` doesn't resolve Tailwind conflicts).
