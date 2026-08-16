# WCA Scorecard Generator v2

A browser-only React app that generates competition scorecards and competitor name tags as print-ready PDFs for WCA (World Cube Association) events. Delegates and organizers log in with their WCA account, pick a competition they manage, configure options, and download the PDFs - one per round stage plus one name-tag sheet, bundled into a ZIP when there is more than one.

## Stack

- **React 19 + TypeScript + Vite** - SPA, no backend required for normal use
- **`@react-pdf/renderer` v4 (browser build)** - renders scorecards and name tags to PDF entirely in the browser
- **`fflate`** - bundles the PDFs into a single ZIP for download (skipped when there is only one PDF)
- **`lucide-react`** - the single icon pack used across the UI (no hand-rolled SVGs or emoji icons)
- **WCA OAuth 2.0 (PKCE)** - authenticates the user against the WCA API

---

## Getting started

### Environment variables

Create a `.env` file at the project root:

```
VITE_WCA_CLIENT_ID=your_wca_oauth_client_id
WCA_CLIENT_SECRET=your_wca_oauth_client_secret
VITE_WCA_REDIRECT_URI=http://localhost:5173/auth/callback   # optional, defaults to origin/auth/callback
```

`VITE_WCA_CLIENT_ID` is bundled into the client. `WCA_CLIENT_SECRET` is **never** bundled - see the section on the token proxy below.

```
npm install
npm run dev
```

### Production deployment

Deploys run automatically from [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`. The workflow builds the bundle on a GitHub-hosted runner (injecting `VITE_WCA_CLIENT_ID` from the repo variable of the same name), then uploads the prebuilt `dist/` to App Engine via Workload Identity Federation. One-time GCP setup (WIF pool, service account, IAM bindings) is documented in [`.github/workflows/README.md`](.github/workflows/README.md).

`package.json`'s `gcp-build` script is intentionally a no-op echo. App Engine's Cloud Build runs that hook after upload; we do **not** want it to rebuild, because the build environment there has no access to `VITE_WCA_CLIENT_ID` and would clobber the good `dist/` with one that ships `client_id=undefined`.

For emergency manual deploys, run:

```
VITE_WCA_CLIENT_ID=... npm run build
./deploy.sh
```

`deploy.sh` only calls `gcloud app deploy`; it relies on `dist/` already being built locally with the right env var in scope.

#### Server-side token proxy

The production build is a static SPA served by `server.js`, which also hosts one server-side endpoint: **`POST /wca-token`**. This endpoint:

1. Accepts the same `application/x-www-form-urlencoded` body the browser sends.
2. Appends `client_secret` from `process.env.WCA_CLIENT_SECRET` (loaded into the App Engine instance from Secret Manager - never bundled into the browser).
3. Forwards the request to `https://www.worldcubeassociation.org/oauth/token`.
4. Returns the response verbatim.

In development, `vite.config.ts` provides this endpoint as a Vite dev-server middleware. The WCA token endpoint has no CORS headers, which is why the browser cannot call it directly even without the secret concern.

---

## Application flow

```
LoginPage → CompetitionPickerPage → RoundScopePage → SettingsPage → GeneratePage (download)
                     └→ CustomCompetitionPage ────────────↑   (custom competitions skip /scope)
```

- **LoginPage** - initiates WCA OAuth PKCE; stores the code verifier in `sessionStorage`.
- **AuthCallbackPage** - exchanges the code for a token; stores the token in `sessionStorage`.
- **CompetitionPickerPage** - lists competitions managed by the logged-in user (WCA API `?managed_by_me=true`). An **"About this tool"** info button (ℹ) sits next to the heading; the same explainer is reachable from the login page (see below). A dashed **"Create a custom competition"** tile below the competition grid (a deliberately secondary placement for a niche flow) leads to the custom-competition builder; selecting a WCA competition clears any stale `custom_competition*` sessionStorage keys so custom state never leaks into a WCA flow.
- **CustomCompetitionPage** (`/custom`) - builder for **custom (non-WCA) competitions** (see [Custom competitions](#custom-competitions-non-wca)). Collects a competition name and a manually defined event list (same `CustomEventEditor` component as the Advanced settings section), then writes the same sessionStorage contract the WCA flow uses - plus `custom_competition: 'true'` and `custom_competition_events` - and continues straight to Settings (no WCIF ⇒ `/scope` is skipped).
- **RoundScopePage** (`/scope`, "What to generate") - fetches the WCIF up front and detects whether any round ≥ 2 already has real group assignments (groups generated mid-competition). Two columns: an optional [**regional preset**](#regional-presets) picker on the left, and on the right the **document types** to generate (scorecards / schedule tracker / name tags / Round Checklist / first-timer slips) plus, mid-competition only, **which rounds** - latest round only (default) / everything / select specific event+rounds. The WCIF is cached in memory (`lib/wcifCache.ts`) so GeneratePage reuses it without a second fetch. It also records whether groups have been generated yet (`parsed.hasGroups`) in `sessionStorage` under `competition_has_groups`, so the Settings page can warn without re-fetching.
- **SettingsPage** - collects paper format, language, logo, etc.; auto-detects the WCA Live competition ID and per-competitor person IDs from the WCA Live API; stores settings in `sessionStorage`. It adapts to the scope: when generating scorecards only (scope ≠ everything) it shows just scorecard-relevant options and hides the name-tag and custom-event sections; it also hides the Round 2 prefilled/blanks control once Round 2 has real groups (so the choice no longer matters). When no groups have been generated for the competition yet, it shows a **"no groups assigned"** warning banner.
- **GeneratePage** - gets the WCIF (cache or fetch), parses it, applies the chosen scope, and renders the download button. PDF rendering runs inside a Web Worker to keep the UI responsive. Before downloading, it shows preview stats - scorecards, cover cards, PDFs, **estimated total pages**, and paper size - and repeats the "no groups assigned" warning when `parsed.hasGroups` is false. Under the button sits the [**print-and-cut guide**](#print-and-cut-guide), which explains what to do with each PDF in the download.

Settings and auth state live in `sessionStorage` only - they are cleared when the tab is closed and are never sent to any server.

---

## User interface

### Design system

The UI styles itself with per-component inline `React.CSSProperties` objects (no CSS framework), so a shared set of **CSS custom properties** in `src/index.css` is the single source of truth that keeps those inline styles consistent. Beyond the theme colors (see [Dark mode](#dark-mode)), `:root` defines:

- **Type scale** - `--fs-stat`, `--fs-display`, `--fs-title`, `--fs-heading`, `--fs-body`, `--fs-label`, `--fs-caption`. Components reference these for `fontSize` instead of magic numbers.
- **Weight hierarchy** - only **three** weights are used anywhere: `400` (body, descriptions, hints), `500` (controls, nav, secondary buttons), and `700` (headings, primary buttons, stat values, option titles). The Montserrat `<link>` in `index.html` loads exactly `@400;500;700`. Keep new UI on these three weights - don't reintroduce 600/800.
- **Spacing** (`--space-1`…`--space-8`) and **radii** (`--radius-sm/md/lg`) for consistent gaps, padding, and corners.
- A global `:focus-visible` ring (`--focus-ring`) so every interactive element has a visible keyboard focus state.

The app's typeface is **Montserrat**, set on `body` and inherited everywhere (`fontFamily: 'inherit'` on form controls/buttons).

**Icons** come exclusively from `lucide-react` at a consistent size/stroke (e.g. theme toggle `Sun`/`Moon`, header `Menu`/`X`, status `XCircle`, `Check`, `Upload`, `ChevronDown/Right`, `RectangleVertical/Horizontal`). The WCA event icons in `src/assets/events.ts` stay PNGs - they're artwork rendered into the PDFs, not UI chrome.

**Shared UI primitives:**

- `src/components/Tooltip.tsx` - a lightweight, dependency-free tooltip (hover + keyboard focus, `role="tooltip"`, themed via the tokens). Wrap any icon-only or jargon control to explain it. Used on the theme toggle, the About trigger, and the custom-event icon upload button.
- `src/components/PrintGuide.tsx` - the download page's [print-and-cut guide](#print-and-cut-guide): a per-document "what to do with this PDF" card, with a CSS-only sheet → piles → deck diagram for scorecards.
- `src/components/Skeleton.tsx` - a pulsing placeholder (configurable width/height/radius) driven by the global `.skeleton` rule and `skeleton-pulse` keyframes in `index.css`. Loading states render skeletons that mirror the eventual layout (competition cards on the picker, scope option cards, the five-stat grid on Generate) instead of bare text/emoji. The pulse and icon spinners respect `prefers-reduced-motion`.

### Regional presets

The **"What to generate"** step offers an optional **preset** column that seeds the options a region usually prints. **Default** is selected out of the box, so anyone who ignores presets sees the behaviour described everywhere else in this README.

A preset only **seeds defaults** - every option it touches stays editable on the following screen, and switching presets re-seeds from the base defaults rather than accumulating the previous choice. Because a preset spans two steps, `/scope` stashes the `settings` half under the `preset_settings` sessionStorage key and `SettingsPage` reads it as its `useState` seed; `CompetitionPickerPage` clears it on mount so a preset never leaks into the next competition.

Presets are plain JSON files in **`src/presets/`**, globbed at build time by `src/presets/index.ts`. **Adding a region is a file drop + PR - no `.ts`/`.tsx` changes.** Shipped: `ontario.json`, `quebec.json`, `british-columbia.json`. `parsePreset()` whitelists keys and values, so a contributor's typo is dropped rather than written into `CompetitionSettings`.

**Full field reference and contributor guide: [`src/presets/README.md`](src/presets/README.md).**

### Interface language

The header (and the login page) carries a **language dropdown** (`src/components/LanguageSelect.tsx`) that switches the *interface* language via `i18next`. The available languages are defined once in `src/i18n/index.ts` as the exported `LANGUAGES` registry (code + native label) - this same registry also drives the scorecard language pickers on the SettingsPage, so adding a locale there (plus its translation JSON) makes it appear in both places automatically, no per-language wiring needed. The chosen interface language is persisted by `i18next-browser-languagedetector` under the `i18nextLng` localStorage key.

This is independent of the printed-output `language` / `secondaryLanguage` *settings* on the SettingsPage, which control the language(s) printed on the scorecards themselves.

### Dark mode

A theme toggle (Lucide `Moon`/`Sun`) sits next to the language dropdown in the header and on the login page. Theming is implemented with **CSS custom properties**:

- `src/index.css` defines the full token set under `:root` (light) and `[data-theme='dark']` (dark) - surfaces, text shades, borders, brand, status colors, shadows, plus the shared type scale, weight hierarchy, spacing, and radii (see [Design system](#design-system)). All UI components reference these via `var(--token)` rather than hardcoded hex.
- `src/theme/ThemeContext.tsx` (`ThemeProvider` + `useTheme`) sets the `data-theme` attribute on `<html>`. It defaults to the OS `prefers-color-scheme` and, while no explicit choice is stored, follows live OS changes. Once the user toggles, the choice is persisted under the `theme` localStorage key and wins over the OS preference.
- `src/theme/theme.ts` holds the pure `resolveInitialTheme(stored, prefersDark)` helper (covered by `theme.test.ts`).

The SCC logo's wordmark and lines are black and would vanish on the dark background, so `src/components/Logo.tsx` swaps to a white-recolored variant (`public/scc-logo-dark.svg`) in dark mode. That variant is `public/scc-logo.svg` with every `#000000` replaced by `#ffffff`; `logo-asset.test.ts` guards that the two stay in sync (regenerate the dark file if the source logo ever changes).

Dark mode affects the on-screen UI only. The generated PDFs (`src/pdf/*`) use `@react-pdf/renderer`'s own isolated `StyleSheet` with white backgrounds and are intentionally unaffected, so printed output is identical in either theme.

### Responsive / mobile layout

The UI adapts to phone-sized screens at a single breakpoint of **600px** (viewports `≤ 600px` get the mobile layout; wider viewports keep the unchanged desktop layout). Because every component styles itself with inline `React.CSSProperties` objects rather than CSS classes, CSS `@media` queries can't override those inline styles - so the breakpoint is read in JavaScript via `src/lib/useIsMobile.ts`. That module exposes the `useIsMobile()` hook (backed by `window.matchMedia`, updates live on resize), the `MOBILE_BREAKPOINT` constant, and a pure `isMobileWidth(width)` helper that is unit-tested in `useIsMobile.test.ts`.

Components call `useIsMobile()` and spread a small mobile-only style override into their existing style object. The notable adaptations:

- **Header** (`src/components/Header.tsx`) - on mobile the language dropdown, theme toggle, user info, and sign-out collapse behind a **hamburger button** that opens a dropdown panel (closes on outside click / sign-out). The desktop header markup is unchanged.
- **Login** - card padding is reduced so it fits a narrow screen.
- **Competition picker** - the card grid drops to a single column.
- **Generate** - the stats grid goes from five columns to two, with a smaller value font.
- **Settings** - the custom-event "format" and "cutoff / time-limit" rows stack vertically.

### "About this tool" dialog

`src/components/AboutDialog.tsx` is a self-contained explainer (trigger + modal) that tells newcomers what the tool is, what the **WCIF** is, and where this tool sits in the workflow - it is the *final* step, turning a competition's already-assigned groups into print-ready, cuttable PDFs. It renders either a circular ℹ icon button (default) or a text link (`as="text"`). It is placed on the **login page** (text link under the sign-in button) and the **competition picker page** (icon next to the heading). All copy lives under the `about.*` i18n keys.

### Feedback and bug reports

Bug reports and feedback go to the [issue tracker](https://github.com/Speedcubing-Canada/scorecards-v2/issues) or to **software@speedcubingcanada.org**.

Both are reachable from inside the app: `src/components/ContactLinks.tsx` renders the GitHub mark and a mail icon in the `Header`, so they sit beside the "what's new" sparkles on every signed-in page, and the same two links appear as text at the bottom of the About dialog - which is what covers the signed-out login page, since that page has no header. The URL and address are exported constants in that one file (`REPO_URL` / `SUPPORT_EMAIL`); import them rather than retyping them, and `contact-links.test.ts` enforces the single copy.

The GitHub mark is `public/github-mark.svg` rendered through an `<img>`, not a lucide icon: lucide 1.x dropped brand icons, and the design-system guard forbids inline SVG in `src/components`. This is the same asset escape hatch `Logo.tsx` uses. One neutral-grey mark serves both themes; if it ever reads washed out, split it into light/dark files and switch on `useTheme()` the way `Logo.tsx` does.

### "What's new" changelog

Organizers typically return once per competition, months apart, so `src/components/WhatsNewDialog.tsx` shows them a short summary of what shipped since their last visit. No account or analytics data is involved: `localStorage` holds one key, `changelog_seen`, containing the id of the newest entry the visitor has read.

The trigger is a sparkles icon in `Header.tsx` (desktop toolbar, or the hamburger panel on mobile), so it never appears before sign-in. The dialog **opens by itself** on the first page load where unseen entries exist, and closing it marks everything read, so it can only open once even though the header remounts on every wizard page. Afterwards the icon reopens it, showing the three most recent entries. A visitor with no marker at all sees the changelog, so the existing user base does not silently miss the first entry.

**The whole feature switches itself off once the newest entry is over a year old** (`isStale`), rather than greeting organizers with last year's highlights. Shipping a new entry brings it back automatically.

Entries live in **`src/changelog.ts`**, newest first. Adding one is a single-file edit:

```ts
{
  id: '2026-09-12',                     // YYYY-MM-DD, unique; same-day second entry -> '2026-09-12b'
  items: {
    en: ['Short organizer-facing bullet.'],   // required
    fr: ['Puce courte destinée aux organisateurs.'],  // optional, falls back to en
  },
}
```

`id` ordering drives the "newer than seen" comparison, so ids must stay sortable and strictly descending - `src/changelog.test.ts` enforces that, along with unique ids and non-empty text in every locale provided. Entry text is deliberately **not** in the `src/i18n/*.json` bundles, so a release never needs four full translations; only the dialog chrome (`whats_new.*`) lives in the locale files.

### "No groups assigned" warning

When a competition's groups have not been generated yet, scorecard counts read 0, which confused early users. The parser now exposes `parsed.hasGroups` (true once the schedule contains group child-activities). `src/components/WarningBanner.tsx` (amber notice, matching the login setup warning) surfaces the `warnings.no_groups` message on both the Settings and Generate pages, explaining that groups must be assigned upstream (Groupifier / the WCA website) first, while the schedule tracker and name tags can still be generated.

### Page-count estimate

The Generate-page stats include an **estimated total number of printed pages** so organizers can gauge the real print volume before downloading. `src/lib/pageEstimate.ts` (`estimateTotalPages`) computes it from the scope-filtered parse: exact for scorecards and name tags (both four-per-page - the per-page constants live in `src/pdf/layoutConstants.ts` and are shared with the PDF documents so they cannot drift), one page for the schedule tracker, and a greedy height-based estimate for first-timer slips (which auto-flow). The estimator is pure and deliberately free of any `@react-pdf` import so it stays out of the main bundle.

---

## Settings reference

| Field | Type | Description |
|---|---|---|
| `language` | `en \| fr \| es \| pt` | Primary printed-output language (mandatory). See [Language support](#language-support) |
| `secondaryLanguage` | `LocaleCode \| null` | Optional second printed language; `null` = single-language output |
| `paperFormat` | `A4 \| LETTER` | Page size for all PDFs |
| `generationScope` | `GenerationScope` | Which rounds/documents to emit, chosen on the round-scope step (see Mid-competition generation) |
| `secondRoundMode` | `prefilled \| blanks` | How intermediate-round scorecards are printed |
| `logoDataUrl` | `string \| null` | Base64 data URL of a custom competition logo. When set, takes precedence over `useDefaultLogo` |
| `useDefaultLogo` | `boolean` | If `true` and no custom logo is uploaded, the bundled Speedcubing Canada logo (`src/assets/SC_Logo.png`) is rendered next to the competition name. Defaults to `true`; disable for competitions outside Canada |
| `wcaLiveId` | `string \| null` | Numeric WCA Live competition ID (e.g. `9667`). Auto-detected from the WCA Live API on the Settings page; can be overridden manually. Used to generate per-competitor WCA Live QR codes on name tags |
| `wcaLivePersonIds` | `Record<number, string> \| null` | Map of `registrantId → WCA Live internal person ID`, fetched automatically after `wcaLiveId` is resolved. The WCA Live person ID differs from the WCA website user ID and is required for correct competitor QR code URLs |
| `hideWcaLiveId` | `boolean` | When `true`, suppresses the `WCA Live: …` line **only on cards that have no ID to print** - blank/extra cards and custom-event cards, which all carry `liveId: ''`. A card with a competitor always shows its ID. Defaults to `false`, which keeps the empty `WCA Live:` label on blank cards (matching the original PDFs) |
| `nametagLogoMode` | `hidden \| with-name \| logo-only` | How the logo appears on name tags (see Name tag section) |
| `nametagQrMode` | `back-only \| both-sides` | Which panels get QR codes (see Name tag section) |
| `nametagLayout` | `vertical \| horizontal` | Card orientation: `vertical` (default) uses a landscape page 4×2 grid with portrait cards; `horizontal` uses a portrait page 2×4 grid with landscape cards sized for 90×55 mm badge holders |
| `scorecardCheckMode` | `per-group-card \| per-round-card \| none` | Where the delegate/scoretaker **cover card** is printed (see Cover cards). Defaults to `per-group-card`, the original behaviour |
| `customEvents` | `CustomEvent[]` | Zero or more custom/bonus events: name, icon, format (`avg5 \| mo3 \| bo3 \| bo2 \| bo1`), cutoff, time limit, optional `roundLabel`, optional `competitors` CSV list (see Custom events section) |
| `isCustomCompetition` | `boolean` | `true` for custom (non-WCA) competitions: GeneratePage skips the WCIF fetch, only `customEvents` are rendered, and all WCA Live fields are forced off (`wcaLiveId: null`, `hideWcaLiveId: true`). Defaults to `false` |
| `scrambleDoubleCheck` | `boolean` | Enables the optional second scrambler-signature column (see Scramble double-checking) |
| `scrambleDoubleCheckRounds` | `DoubleCheckRound[]` | Which round categories get the column: `firstRound \| intermediate \| semis \| finals`. Defaults to `['finals']` |
| `scrambleDoubleCheckOverrides` | `Record<string, string[]>` | Map of `WCA ID → event IDs` that are always double-checked for that competitor, in every round (named cards only) |

---

## Cover cards

Every group of every non-FM round normally gets a **cover card** - the quarter-page
checklist a delegate and scoretaker sign off (bundled all N scorecards, checked
signatures, incident count, results entered, incidents logged, results checked).
`scorecardCheckMode` decides where that card goes:

| Mode | Effect |
|---|---|
| `per-group-card` (default) | One cover card in front of every group's scorecards. The original behaviour |
| `per-round-card` | One cover card per event round instead of per group. Fewer cards to print; the card shows `All N groups` instead of a group label, and `numScorecards` is the round total |
| `none` | No cover cards |

The **Round Checklist** is *not* a mode here. A cover card travels with one pile of
scorecards and is signed as that pile is handled; the Round Checklist tracks the whole
competition's data flow. They are different artefacts, and a delegate may want both or
neither - so the checklist is a separately selectable document (below).

### Why covers are gated at emission time

`pushCover` in `parseWCIF` is the **only** place a cover is created, and the mode is
checked there. Covers must not be filtered out downstream: `finalizeEntries` sorts →
pads each bucket to a multiple of 4 → quadrant-reorders for cut-and-stack, so removing
entries after the fact would corrupt the printed pile order.

The collapsed `per-round-card` cover carries `group: ''`, which sorts before every real
group label and therefore still lands at the head of its pile. The collapse partition is
`event + round + stage` - the same partition the sort uses. Named rounds carry a `stage`
key, so a round spread across two stages gets one cover per stage (each stage is its own
physical pile); blank buckets (finals/semis/round 2) have no stage key and get one cover
per round.

---

## The Round Checklist (`{id}_checklist.pdf`)

An **opt-in document**, chosen on the `/scope` screen alongside Scorecards, Schedule
Tracker, Nametags and First-Timer Slips - `DocumentSelection.roundChecklist`, which
defaults to **false** everywhere. `filterParsedByScope` empties `checkingDays` unless it
is selected, so every downstream consumer (the worker, `pageEstimate`, the Generate
page's PDF count) gates on `checkingDays.length > 0` alone.

Rendered by `src/pdf/CheckingSheetDocument.tsx` from `ParsedWCIF.checkingDays`: **one table
per day, one row per round**, whatever room or stage the round ran in - see
[One table per day](#one-table-per-day). (Internals still use the earlier "checking sheet"
names.) Columns:

| Column | Flex | Contents |
|---|---|---|
| Start time | 1 | Round start, venue-local |
| Event | 2.7 | e.g. `3x3x3 Cube Round 1` |
| Groups created | 1 | Group count for that round across the whole competition, plus a 9×9pt tick box (same geometry as the cover card's checkbox) |
| Scorecards ready | 1.1 | Tick box only |
| Data entry (initials) | 1.3 | Blank writing space, plus a tick box on the right edge |
| Double-check (initials) | 1.35 | Same - wider, it holds the longest header we ship |
| Scorecards taken by | 1.55 | Blank - widest, it takes a name rather than initials |

**The columns record work, not custody.** *Groups created* means the groups were made on
competitiongroups; *scorecards ready* means they were printed or hand-written. Both are
prepared before the competition for a first round, so both boxes print already ticked on
every `roundNum === 1` row (`CheckingRow.preChecked`); later rounds print blank. Ticks are
drawn with `Svg`/`Polyline`, not typeset - Helvetica has no U+2713.

*Data entry* and *double-check* take initials **and** a tick box: either can span several
passes, so a cell accumulates initials, and the box is ticked only when the round is
finished. The box is pinned to the right edge; the writing space beside it is held at
≥ 40pt by the layout test. Data cells use `paddingVertical: 9` (vs the schedule tracker's
6) so there is room to write by hand.

`checkingDays` is built unconditionally by the parser and is independent of
`scorecardCheckMode` - cover cards and the checklist do not influence each other. Group
counts come from `groupUnitsOf`, so a later round with no real groups still reports the
count implied by its scramble-set count; rounds with no groups yet report `0`. `333fm`
**is** included (results entry still happens for it), even though FM never gets cover cards.

### One table per day

**The checklist has no room dimension.** A round produces one pile of scorecards however
many rooms or stages it runs across, and the pile is what this document tracks, so every
room's rounds for a date go into a single table, in start-time order. FMC in a side room is
just another row. `CheckingDay` is `{ dayLabel, rows }` - there is no stage level.

Merging unions the rounds' **group activity codes** rather than adding per-room counts,
because two stages running one logical group share that group's code, and a later round
synthesizes the same `g1..gN` in every room it occupies - summing would double both
(`mergeSlots` in `wcif-parser.ts`). The merged row spans the earliest start to the latest
end, and one round holding two blocks of a day collapses to one row too.

**The schedule tracker is unaffected** and keeps one table per room: it records when each
stage actually runs, which is exactly what merging throws away.

#### Page breaks

A day's table is as long as the day, so it can outgrow a page - around 20 rounds on LETTER
(`checking-sheet-layout.test.ts` pins the arithmetic). The day block therefore **wraps**:

- **Never `wrap={false}` on the day block.** @react-pdf *squashes* an oversized
  non-breaking block rather than moving it to its own page - at 30 rounds every tick box
  collapses into an unusable sliver.
- Each `DataRow` is `wrap={false}`, so a break never falls through a row (a split row loses
  its cell borders and its start time).
- The day heading, the column header and the **first** data row are one atomic group, which
  is why the table is drawn as two bordered pieces (`tableHead` + `tableRest`, joined by
  dropping the shared border). `minPresenceAhead` alone does not achieve this.
- Known limit: a day spanning two pages does not repeat the column header on the second.
  A `fixed` header would also draw on the common single-page case, so it loses on balance.

### The lunch rule

Both the Round Checklist **and** the schedule tracker draw a thick rule
(`CHECKING_BREAK_RULE`, 1.5pt) where lunch splits a day - delegates mark it by hand
otherwise. `CheckingRow.breakBefore` / `ScheduleRow.breakBefore` is set on the first round
that starts after a scheduled lunch; the first row of a table never carries one, since the
header border is already above it.

Lunch is detected **explicitly**, never inferred from a gap in the schedule: an activity
counts when it is not a round activity and either its `activityCode` is `other-lunch` or
its name matches `LUNCH_NAME_RE` (lunch / dîner / déjeuner / almuerzo / almoço / comida) -
delegates routinely file lunch under `other-misc` with a localised name. Only lunch draws
a rule; awards and tutorials would clutter a busy day.

Lunch activities are collected across **every** room of the day, since a competition
typically enters lunch once while the rule belongs on every table. The lunch activity
itself never becomes a row: non-round activities stay filtered out of both documents.

`src/pdf/checking-sheet-layout.test.ts` pins the geometry: every header, in every locale,
on both LETTER and A4, must fit inside its column at 8pt Helvetica-Bold; the **event**
column must additionally fit the longest event + round label at 10pt regular; and the
initials columns must keep ≥ 40pt of writing space beside their tick box.

---

## Scramble double-checking

For major championships, scrambles are often double-checked: a second scrambler
independently confirms the scramble and signs for it. When enabled, scorecards gain a
second scrambler-signature column (header "Check") immediately to the right of the
existing **Scrambler** column. Its 13% width is taken entirely from the result column
(52% → 39%); the card's outer size, the other columns, and the 4-up cut lines are
unchanged, so a double-check card and a normal card can sit on the same sheet.

A scorecard gets the column when **either**:

1. **Round rule** - its round category is selected in `scrambleDoubleCheckRounds`
   (default: Finals only). The four categories map 1:1 to the generated PDFs
   (`round1` / `round2` / `semis` / `finals`). A single-round event's only round is
   treated as a final, so selecting "Finals" also covers it.
2. **Per-competitor override** - the competitor's WCA ID + event appears in the uploaded
   override file. These competitors are double-checked for those events in **every**
   round. Because the override matches by WCA ID, it only applies to **named** cards
   (Round 1, and prefilled Round 2); blank later-round cards rely on the round rule.

### Override file format

A CSV with one line per competitor and no header:

```
# WCAID,event1,event2,...
2015FOOB01,333,444
2018BARS02,333bf,555bf
```

Blank lines and lines starting with `#` are ignored; WCA IDs are upper-cased and event
IDs lower-cased. Parsed by `src/lib/parseDoubleCheckOverrides.ts`. (A helper script to
generate this file from a competition's data may be added later.)

---

## PDF output structure

When a run produces **two or more PDFs**, the download is a ZIP named **`{competitionId}_pdfs.zip`** containing one PDF per round stage plus a name-tag PDF if the competition has nametag data. Most competitions produce 2–3 PDFs; a competition with 4-round events (e.g., a large 3×3×3) produces 4 scorecard PDFs. (The name is deliberately not `_scorecards.zip`: the bundle routinely carries nametags, slips and the schedule too.)

When a run produces **exactly one PDF**, that PDF is downloaded directly - `{competitionId}_schedule.pdf`, not a one-file ZIP - so it can be printed straight from the download. This is the normal case for the mid-competition scope step, where an organizer picks a single document such as the schedule tracker or the Round Checklist. The download button label always shows the file you will actually get.

Both the file list and the zip-vs-bare-PDF decision come from `src/lib/pdfJobs.ts` (`buildPdfJobs` / `downloadTarget`), which the worker and the generate page share - so the "PDFs" stat, the button label, and the rendered output can't disagree.

### Print-and-cut guide

Organisers have lost hours re-sorting a whole competition by hand after cutting the sheets, not realising the scorecards come out of the generator **already in order**. `src/components/PrintGuide.tsx` puts that workflow on the download page, under the button:

1. Print the scorecard PDF single-sided, in page order.
2. Cut every sheet into 4, keeping the pieces separated by position - top-left, top-right, bottom-left, bottom-right. Each of those four piles is already correctly ordered.
3. Stack the top-left pile on the top-right, then the bottom-left, then the bottom-right. That single deck holds every group of every round in schedule order, each group led by its cover card.

That is exactly what `reorderQuadrants` (`src/lib/wcif-parser.ts`) imposes: `finalizeEntries` sorts, pads to a multiple of 4, then deals the sorted list column-wise across the pages, and `ScorecardDocument` places the four cards per page in reading order. The `cut-and-stack imposition` tests in `wcif-parser.test.ts` pin that contract so the printed instructions can't silently go stale.

The guide is **per document**: it lists only the PDFs actually in the download, so an organiser generating just the schedule tracker is never shown scorecard cutting instructions. The sections come from `guideSections(jobs)` in `src/lib/pdfJobs.ts` - the same job list that drives the "PDFs" stat and the button label - and cover scorecards (incl. custom events, which print 4-up on the same sheet), the schedule tracker, the Round Checklist, name tags (four people per page, front and back side by side: cut each pair out and fold it down the middle), and first-timer slips. Copy lives under the `generate.guide.*` i18n keys in all four locales.

| File | Contents |
|---|---|
| `{id}_round1.pdf` | Named scorecards for every competitor assigned to round 1, plus cover cards as configured by `scorecardCheckMode` |
| `{id}_round2.pdf` | Round 2 of events with 3 or more rounds; named when groups are assigned in the WCIF, otherwise prefilled or blank depending on the setting |
| `{id}_semis.pdf` | Round 3 of events with 4 rounds (semi-finals); named when groups are assigned, otherwise blank |
| `{id}_finals.pdf` | Final round of every multi-round event; named when groups are assigned, otherwise blank scorecards |
| `{id}_extras.pdf` | One blank spare scorecard per round per event (sorted by schedule order) |
| `{id}_checklist.pdf` | Round Checklist; only when the `roundChecklist` document is selected |
| `{id}_schedule.pdf` | Schedule tracker table: estimated start/end times with blank columns for actual times and competitor count |
| `{id}_nametags.pdf` | Sheet of competitor name tags - portrait (2×4 grid) for horizontal layout, landscape (4×2 grid) for vertical layout; omitted if no nametag data is available |
| `{id}_first_timers.pdf` | Confirmation slips for newcomers (competitors with no WCA ID); only when enabled in Advanced settings, omitted if there are none |
| `{id}_custom_{name}.pdf` | One file per custom event: 4 blank scorecards by default, or - when a competitor CSV was uploaded - one named scorecard per competitor padded with blanks to fill the last 4-card page |

A PDF is omitted from the output if it would be empty (e.g., all events have only one round → no finals PDF). 2-round events skip straight from round 1 to finals; they never produce a round2 or semis PDF. If the omissions leave exactly one PDF, it downloads on its own rather than in a ZIP.

---

## Scorecard PDF

### Intermediate round modes

Controlled by the `secondRoundMode` setting:

- **Prefilled** - N cover cards (one per group) followed by all round-1 participants with a blank group placeholder (`Group _ of N`). Staff sorts the advancing competitors into groups manually and pulls their cards from the stack.
- **Blanks** - fully blank scorecards per group, same as finals.

These two modes only apply to a round that has **not** been assigned yet - see below.

**Later rounds scheduled without groups.** The blank/prefilled buckets and the extras are
built from the schedule's **group child-activities**. Some organizers schedule a later round
as a bare time block with no groups; the parser then synthesizes implicit groups from the
round activity, as many as the round has **scramble sets** (`Round.scrambleSetCount`, floor
of 1). The fallback applies only to rounds ≥ 2 with no real groups anywhere, and never flips
`parsed.hasGroups`. See `groupUnitsOf` in `src/lib/wcif-parser.ts`.

**Sizing unassigned later rounds (advancement chain).** Round 1's field is the number of
**accepted registrations** for the event; each later round applies the previous round's
advancement condition to the previous field: `ranking` → top *X*, `percent` →
`floor(level/100 × previous field)`. Blank stacks hold `ceil(field / groups) + 2` cards per
group; prefilled Round-2 cover counts sum to the field. An `attemptResult` (or absent)
condition makes the downstream field unknown, so those rounds fall back to a flat **16**
blanks. Applies to all *unassigned* later rounds, never to assigned ones. See
`roundFieldSize` in `src/lib/wcif-parser.ts`.

### Mid-competition generation (live group assignments)

When the parser finds real `competitor` assignments for a round ≥ 2 (the organizer assigned
groups mid-competition and re-exported the WCIF), it produces **named** scorecards with the
actual group, routed to the matching `intermediate` / `semis` / `finals` PDF instead of the
prefilled/blank output above. Unassigned rounds still use the blank/prefilled fallback.

Detection happens **up front** on `RoundScopePage` (right after picking the competition), not
at download time. When at least one later round has real assignments, that page asks a
**scope** question:

- **Latest round only** *(default)* - print only the most recent round that has groups. Best
  during a competition (you don't reprint earlier rounds).
- **Everything** - print all rounds (plus name tags, schedule, etc.), using assigned groups
  where available.
- **Select rounds** - pick individual event + round combinations.

The scoped modes (`latest` / `selected`) emit scorecard PDFs only - name tags, the schedule
tracker, and extras are pre-competition artifacts and are skipped, and the Settings page hides
those sections accordingly. When no later round has assignments (the normal pre-competition
WCIF) there is no prompt, the page auto-advances to Settings, and output is unchanged.

Independently of the round question, the same page carries a **Document types** checklist
(`DocumentSelection`), shown in both the pre- and mid-competition flows:

| Key | Label | Default |
|---|---|---|
| `scorecards` | Scorecards | on |
| `scheduleTracker` | Schedule Tracker | on (off mid-competition) |
| `nametags` | Nametags | on (off mid-competition) |
| `roundChecklist` | Round Checklist | **off** |
| `firstTimerSlips` | First-Timer Slips | off |

`filterParsedByScope` applies these flags by **emptying the corresponding arrays**, so every
consumer downstream just checks `.length > 0` and needs no knowledge of the selection. Continue
is disabled when nothing is ticked.

The scope filtering lives in `src/lib/generationScope.ts` (`GenerationScope`,
`filterParsedByScope`, `availableRounds`, `latestAssignedRound`, `hasUnassignedIntermediate`);
the parser exposes `ParsedWCIF.laterRoundsWithAssignments` and a `roundNum` on every entry to
drive it. The chosen scope is persisted on `CompetitionSettings.generationScope`.

### Print layout (quad-reorder / cut-and-stack)

Each page holds 4 scorecards. Cards are **not** laid out in reading order. Instead they are interleaved so that after printing, cutting along the centre lines, and stacking the half-sheets on top of each other, each resulting stack is already sorted in the correct order for distribution. This is called a cut-and-stack or quadrant reorder.

Concretely: input position 0 → page 1 top-left, input position 1 → page 2 top-left, input position 2 → page 3 top-left, etc. All "top-left" cards come first, then all "top-right", and so on. The `reorderQuadrants` function in `wcif-parser.ts` implements this mapping.

The number of entries is always padded to a multiple of 4 (with empty cover placeholders) before reordering so that every page is full and the stacking math works out.

### Page geometry

Cards preserve the aspect ratio of the original HTML scorecards (561:726 ≈ 0.773). Absolute positioning is used so that cutting guides (gaps between cards) are exact.

| Paper | Card size | Positions (left, top in pt) |
|---|---|---|
| LETTER (612×792 pt) | 282×365 pt | (12,12), (318,12), (12,415), (318,415) |
| A4 (595×842 pt) | 274×354 pt | (12,36), (309,36), (12,452), (309,452) |

### Bilingual result header

When a secondary language is set, both `resultPrefix` and the result suffix have two lines (one per language). Concatenating them naively produces four lines in the narrow result column header. Instead, the two strings are split on `\n` and interleaved: line 1 of the prefix + space + line 1 of the suffix, then line 2 of the prefix + space + line 2 of the suffix. This keeps the header to exactly two lines.

### Name font size (scorecards)

The competitor name is auto-scaled to fit on one line inside the name cell. The formula approximates Helvetica-Bold character width as 0.65 pt per pt of font size per character:

```
fontSize = clamp(7, floor(available / (name.length * 0.65)), 18)
```

Available width is ~158 pt when any logo cell is present (custom or default), ~210 pt when the header is the narrow comp-name-only cell.

### Logo vs competition name

The header has three mutually exclusive modes, resolved by `src/lib/logo.ts`:

| `logoDataUrl` | `useDefaultLogo` | State | Header content |
|---|---|---|---|
| set | - | `custom` | Uploaded logo alone in an 80 pt cell; competition name is **not printed** on the card |
| `null` | `true` (default) | `default` | Competition name text + bundled Speedcubing Canada logo side by side in an 80 pt cell |
| `null` | `false` | `none` | Competition name only, printed vertically in a narrow 26 pt cell on the left |

The `default` state is intended as the standard for Canadian competitions; competitions outside Canada toggle `useDefaultLogo` off to fall back to the legacy `none` layout.

---

## Name tag PDF

### Physical layout

The two layouts use **different page orientations and card sizes**; both produce 8 panels (4 front/back pairs) per page.

**Vertical layout** (`nametagLayout: 'vertical'`, default) - landscape page, 4-column × 2-row grid:

```
row 0: [Front_A] [Back_A] [Front_B] [Back_B]
row 1: [Front_C] [Back_C] [Front_D] [Back_D]
```

| Paper | Slot size | Margin | Gap |
|---|---|---|---|
| LETTER | 189 × 292 pt | 12 pt | 4 pt H, 4 pt V |
| A4 | 201 × 283 pt | 12 pt | 4 pt H, 4 pt V |

Cut between column pairs (each [Front/Back] pair is adjacent) and fold front-to-back.

---

**Horizontal layout** (`nametagLayout: 'horizontal'`) - portrait page, 2-column × 4-row grid. Each row holds one person's front and back side-by-side:

```
row 0: [Front_A] [Back_A]
row 1: [Front_B] [Back_B]
row 2: [Front_C] [Back_C]
row 3: [Front_D] [Back_D]
```

| Paper | Slot size | Margin | Gap |
|---|---|---|---|
| LETTER | 244 × 147 pt (86 × 52 mm) | 15 pt | 10 pt H, 10 pt V |
| A4 | 244 × 147 pt (86 × 52 mm) | 15 pt | 10 pt H, 10 pt V |

Cards are sized to fit **90 × 55 mm badge holders** with ~2 mm clearance per edge - holder-dictated, so both paper formats use the same size. No rotation is applied. Cut horizontally between rows and vertically down the centre; each row pair goes into the holder front-and-back.

In horizontal mode the top section is compressed (≈ 58 pt vs 127–146 pt) and the WCA ID is shown only on the back panel to fit the shorter (147 pt) card height.

**Event icons appear only on the side without the QR codes.** `eventIconsVisible({ isQrSide, compact })` in `src/pdf/layoutConstants.ts` is the single source of truth: icons are hidden only when a panel is the QR side *and* the layout is compact, so the vertical layout keeps icons on both panels.

In compact layout the competition name, competitor name, and role badge are **top-packed with equal gaps on both panels**, so the role badge lands at the same Y on front and back regardless of what follows it. A very dense duty list can still push the front's section taller, breaking the alignment.

### Panel contents

Every panel (front and back) starts with the same top section:

- **Logo or competition name** - controlled by `nametagLogoMode` (see below)
- **Competitor name** - auto-sized to fill available width (see formula below)
- **Role badge** - DÉLÉGUÉ / COMPÉTITEUR / COMPÉTITRICE / NOUVEAU COMPÉTITEUR / etc. (or English equivalents on the back panel), coloured by role. The badge is pinned at a fixed vertical position within the top section so it appears at the same height regardless of name length
- **Event icons** - one icon per registered event (in horizontal layout, only on the non-QR side - see above)
- **WCA ID** - or a blank placeholder for first-timers

**Front panel** (primary language) - duty assignments grouped by role, e.g. in French:
- `Concourir:` - events and groups the competitor competes in
- `Mélanger:` - scrambling assignments
- `Juger:` - judging assignments
- `Courir:` - running assignments

**Back panel** (secondary language, or the primary when none is set) - two QR codes side by side:
- **competitiongroups.com** - links to the competitor's personal schedule using their `registrantId`
- **WCA Live** - links to the competitor's live results page using the WCA Live internal person ID (looked up via `wcaLivePersonIds[registrantId]`); falls back to the WCA Live homepage if the mapping is unavailable

### QR code modes (`nametagQrMode`)

| Value | Front panel | Back panel |
|---|---|---|
| `back-only` (default) | Duty assignments | QR codes |
| `both-sides` | QR codes (primary language) | QR codes (secondary language) |

`both-sides` is useful when the logo takes enough space that assignments become hard to read, or when the organiser simply prefers QR codes on both sides.

### Logo modes (`nametagLogoMode`)

Available whenever a logo will be rendered - either a custom upload or the bundled Speedcubing Canada default (when `useDefaultLogo` is true). Has no effect when both sources are unavailable.

| Value | Header row |
|---|---|
| `hidden` | Competition name text |
| `with-name` | Small logo (20 pt) + competition name text side by side |
| `logo-only` | Large logo (28 pt) centred, no competition name text; QR codes are 65 pt instead of 75 pt to compensate |

### Name font size (name tags)

```
fontSize = clamp(9, floor((panelW − 14) / (name.length × 0.55)), 20)
```

The 0.55 factor approximates Helvetica regular character width. The 20 pt cap prevents short names from becoming disproportionately large compared to competitors with longer names.

### Duty assignment font size

Duties are rendered as a flex-wrap row of items. Font size scales down for competitors with many assignments to prevent overflow:

```
dutyFs = clamp(5, 7.5 − max(0, totalItems − 8) × 0.12, 7.5)
```

where `totalItems` is the total count of duty strings across all four roles. An entry with 8 or fewer duties uses the full 7.5 pt; each item beyond 8 reduces the size by 0.12 pt, bottoming out at 5 pt.

When the estimated natural height of the duty rows is below 65% of the available panel height, `justifyContent: space-evenly` is applied so the rows spread to fill the space. Otherwise rows stack from the top with 3 pt gaps to avoid the overflow that `space-evenly` causes when content is dense.

### QR code rendering

QR codes are rendered as native react-pdf SVG elements (`<Svg>` / `<Rect>`) rather than as rasterised images. Consecutive dark modules in each row are collapsed into horizontal bars to minimise the number of SVG elements. This produces sharp, resolution-independent QR codes without any external image dependency.

### Development helper

`generate-nametags.mjs` is a standalone Node.js ESM script that generates a name-tag PDF from a local legacy data file without needing a browser or a running dev server. Run it with:

```
node generate-nametags.mjs              # vertical layout (default)
node generate-nametags.mjs --horizontal # horizontal layout
```

Output is written to `../current-output/`.

---

## First-timer slip PDF

`{id}_first_timers.pdf` is **opt-in**: enable *Print first-timer slips* in Advanced settings (off by default - most delegates don't need it). When on, it prints one confirmation slip per **newcomer** - an accepted competitor with no WCA ID. The delegate cuts the slips apart and uses each one to confirm the competitor's personal details (so their results can be linked to a freshly-created WCA profile). The component is `src/pdf/FirstTimerSlipDocument.tsx`.

The slip follows the hand-made original (`original-output/… First-Timer Slips.pdf`): a flowing, vertically-stacked checklist with no borders or cut lines (slips are separated by whitespace and cut apart). Each slip is rendered `wrap={false}` so it is never split across a page. Layout: left margin 36pt, top 38pt, 10pt Helvetica (`SLIP_FONT_SIZE`), fixed 13pt line pitch (`SLIP_LINE_H`), bold values, and a small bordered square as the tick box (standard PDF Helvetica has no ☐ glyph). The gap between consecutive slips is `SLIP_MARGIN_BOTTOM` = 31 pt - the base 18 pt plus one extra blank line (`SLIP_LINE_H` = 13 pt) so the cut point between slips is obvious (Sarah's feedback). The font + line pitch were reduced from 11/14 to 10/13 so that **three large slips (4–5 events) still reliably fit one page** even with the larger inter-slip gap; short single-event slips fit five per page.

Each slip lists, in order:

1. The "please check the boxes / let us know if anything is incorrect" intro.
2. *This is my first WCA competition* · *My preferred name is …* · *My gender identity is …*
3. *My birthdate is …* - **only when the WCIF exposes the birthdate** (see below).
4. *I hold citizenship in …* (country name localized from `countryIso2`).
5. *I have permission from a parent/guardian/caregiver to compete* - **only for a minor** (birthdate present and age < 18).
6. The registered events - a single *I can solve the …* line, or an *I can solve all these puzzles/events:* header followed by one bulleted line per event.

**Language:** the slip is rendered in the **primary** language only (no bilingual merge). Strings live in `FirstTimerSlipStrings` / `getFirstTimerSlipStrings` in `src/lib/i18n.ts` (en / fr / es / pt). Dates and country names are localized via `Intl.DateTimeFormat` / `Intl.DisplayNames`.

**Birthdate availability:** the app requests only the `public manage_competitions` OAuth scope (no `dob`). Birthdates appear in the WCIF for competitions the authenticated user manages; when a birthdate is absent, both the birthdate line and the parental-consent line are omitted gracefully.

### Development helper

`generate-first-timer-slips.mjs` renders the slip PDF from a fixture (the real newcomers reconstructed from the original Gros Jouets PDF, including birthdates) for layout verification against `original-output/`:

```
node generate-first-timer-slips.mjs   # → ../current-output/GrosJouetsaMontreal2026_first_timers.pdf
```

---

## WCIF parsing

The parser (`src/lib/wcif-parser.ts`) reads the competition's WCIF (WCA Interchange Format) JSON and produces a `ParsedWCIF` object:

```ts
interface ParsedWCIF {
  firstRound:   ScorecardData[];
  intermediate: ScorecardData[];
  semis:        ScorecardData[];
  finals:       ScorecardData[];
  nametags:     NametTagEntry[];
  extras:       ScorecardData[];     // one blank scorecard per round per event
  scheduleDays: ScheduleDay[];       // chronological schedule tracker data
  // Rounds (≥ 2) that already have real competitor group assignments - empty for a
  // standard pre-competition WCIF. Drives the generation-scope prompt.
  laterRoundsWithAssignments: { eventId: string; roundNum: number }[];
}
```

Every `ScorecardData` entry also carries a `roundNum` (1-based; `0` for custom events) so the generation-scope filter can select cards by event + round.

### What is skipped

- **FMC (`333fm`)** - no scorecard format exists for this event; it is silently ignored throughout.
- **Multi-Blind (`333mbf`)** - treated specially: always `bo2` format (2 attempts), result cell shows "X out of X / Time / ___" template. Named assignments are skipped (delegates handle MBF manually).
- **Persons** with `registration.status !== 'accepted'` are ignored.

### Round categorisation

```
firstRound   - roundNum === 1 for any event
intermediate - roundNum in [2, N-1] AND event has N >= 3 rounds total
semis        - roundNum === N-1 AND event has N >= 4 rounds total
finals       - roundNum === N AND N >= 2 (i.e., the event has more than one round)
```

A 2-round event's second round goes directly to finals, never to intermediate. A 3-round event contributes round 2 to intermediate and round 3 to finals.

### Scorecard format selection

The WCIF `round.format` field maps to a scorecard layout:

| WCIF format | Cutoff? | Scorecard format |
|---|---|---|
| `a` (average of 5) | no | `avg5` (5 rows) |
| `a` | yes | `bo2-avg5` (2 pre-cutoff + 3 post-cutoff rows) |
| `3` or `m` (mean/best-of-3) | no | `mo3` (3 rows) |
| `3` or `m` | yes | `bo1-mo3` (1 pre-cutoff + 2 post-cutoff rows) |
| `2` (best-of-2) | - | `bo2` (2 rows) |

**Override: blind events.** `444bf` and `555bf` are always forced to `mo3` / `bo1-mo3` (3 attempts) regardless of what the WCIF says for `round.format`. This is because the WCIF sometimes reports these as `2` but the WCA regulations require a mean-of-3 attempt structure.

**Override: Multi-Blind.** `333mbf` is always `bo2` (2 attempts). The result cell content ("`___ out of ___`") is driven by `eventId === '333mbf'`, not by the format code, because 6×6 and 7×7 also use `bo2` and must not show the MBF template.

**Note on 3×3 Blindfolded.** `333bf` uses `avg5` format as of 2026 and is treated as a standard event. It is not in the blind-events override set.

### Timeslot ordering

The parser assigns each child activity a short timeslot key (e.g., `A01`, `B03`) derived from the activity's start time and room name. These keys are used as the primary sort key for all three output buckets, ensuring scorecards print in schedule order. Multiple rooms active at the same time get different stage prefixes (first letter of the room name) but the same numeric slot.

### Group labels

Group labels are built from the activity code's group number and the room/stage name. If the stage name matches a room name prefix, it is replaced with `"Group"`. Falls back to `"Group {N}"` if the heuristic does not match. Labels are translated into the primary language (`Groupe X de Y` in French).

**Greyed "of Y".** On scorecards (and cover cards), the trailing connector + total of every "X of Y" label - the `of 2` in `Group 1 of 2`, the `de 3` in `Tour 1 de 3`, etc. - is rendered in grey (`#808080`) to de-emphasise it and draw attention to the current group/round number (Sarah's feedback). The connector word per language is `ofConnector` in `src/lib/i18n.ts` (`of` for EN, `de` for FR/ES/PT); `splitLabelTotal(label, connector)` splits the label on the **last** connector occurrence (so colour/stage names like `Bleu 1 de 2` keep their colour black) and returns `tail: null` for labels with no connector (e.g. `Final Round` / `Tour Final`), which render entirely in the normal colour. The `LabelWithGreyTotal` component in `src/pdf/ScorecardDocument.tsx` does the rendering.

For a final that is a single group in a single stage (`totalGroups === 1 && numStages <= 1`), station numbers replace group labels on the blank cards: `Station 01`, `Station 02`, … (`Estación 01`, … in Spanish). The event and round already identify the stack, so a `Group 1 of 1` label would be redundant noise.

**Stationary rounds.** When a competitor's assignment carries a `stationNumber`, the visible group label becomes a station label instead (`Station 01`, … / `Estação 01`, … in Portuguese), so the stage/colour is not shown on the card. Each entry still keeps the stage as a separate sort key, and `finalizeEntries` sorts by `timeslot → eventId → stage → group → …`. This keeps every stage's cards in one contiguous pile (all of one stage, then the next) instead of interleaving stages whose stations happen to be numbered across stages. The per-stack cover card identifies each stage. For rotation rounds the stage key is a no-op, since the stage is already the prefix of the group label.

### Advancement condition and blank count

When the previous round has `advancementCondition.type === 'ranking'`, the number of blank scorecards per group in finals/intermediate is `ceil(level / totalGroups) + 2` (a small buffer above the exact cut). Otherwise 16 blanks are printed per group.

### New competitors

Persons without a `wcaId` get a placeholder. In French the placeholder is gendered: `Nouvelle Compétitrice` for female competitors, `Nouveau Compétiteur` for male/other.

### Nametag entries (`NametTagEntry`)

Each accepted person produces one `NametTagEntry`. The `buildDuties` function converts WCIF assignment codes (e.g., `competitor`, `staff-scrambler`, `staff-judge`, `staff-runner`) into human-readable duty strings of the form `"EventName: Group label"`. Duties are grouped into four arrays (`compete`, `scramble`, `judge`, `run`) and sorted alphabetically within each group.

Entries are sorted in this order: **Delegates → Organizers → Returning competitors → New competitors** (persons without a WCA ID), each sub-group alphabetically by name. New competitors are placed at the end so their nametags can be separated at check-in for first-timer orientation.

The `registrantId` field is the sequential person ID used by competitiongroups.com and as the key into `wcaLivePersonIds` to resolve the WCA Live competitor URL. `wcaUserId` is the WCA website account ID. These are different numbers and must not be confused - WCA Live uses its own internal person IDs (neither `registrantId` nor `wcaUserId`).

### Extra / spare scorecards (`extras`)

One blank `ScorecardEntry` is generated per round per event (excluding `333fm`, which has no scorecard format). The extra scorecards are sorted by schedule order - using the earliest child-activity start time for each round as the sort key, then by event ID as a tiebreaker. The list is padded to a multiple of 4 (with empty cover placeholders) but is **not** quadrant-reordered: extras are handled as a loose stack, not a cut-and-stack bundle.

Group labels follow the same rules as regular scorecards: single-group rounds use `"Group 1 of 1"` and multi-group rounds use `"Group _ of N"` (a blank placeholder indicating the group number is to be written in by hand). FMC is excluded because no printed scorecard format exists for it.

### Schedule tracker (`scheduleDays`)

The schedule tracker is built in **day-primary, chronological order**: the output is a list of `ScheduleDay` objects, each representing one calendar date. Each day contains a list of `ScheduleStage` objects (one per room that has events on that day), and each stage holds `ScheduleRow` entries sorted by start time.

Day labels (`"Day 1 - Monday"`, `"Day 2 - Tuesday"`, …) are computed from a global date→day-number map built across all rooms, so "Day 1" always refers to the earliest calendar date in the entire competition regardless of which room's activities you're looking at.

Times are formatted in the venue's local timezone (from `wcif.schedule.venues[0].timezone`) using `Intl.DateTimeFormat` with `hour12: false`. Event round labels in the schedule tracker always use English event names regardless of the scorecard language setting, since the tracker is a staff document.

`333fm` is **included** in the schedule tracker (staff still need to track it), unlike extras and scorecards where it is excluded.

`ScheduleRow.breakBefore` marks the first round after a scheduled lunch, which the tracker
renders as a thick rule - see **The lunch rule** above.

### Checking sheet (`checkingDays`)

Built in the same pass as `scheduleDays`: each room's activities are reduced to
`RoundSlot`s (round code, start, end, the set of group activity codes) by `slotsOf`, and
`buildRows` turns a slot list into both row shapes, since they share the filtering and the
event+round labelling. The tracker builds one table per room from that room's slots; the
checklist concatenates **every** room's slots for the date and runs them through
`mergeSlots`, giving one table per day. See **The Round Checklist** above for the columns,
the group-count rule and **One table per day**.

`CheckingRow` adds two fields on top of the schedule row's start/end/event: `preChecked`
(true for `roundNum === 1`, printing the groups and scorecards boxes already ticked) and
`breakBefore` (shared with `ScheduleRow`, the lunch rule).

---

## Custom events (Advanced settings)

The **Advanced** section of the Settings page lets organisers add custom events - side puzzles or bonus events that are not part of the official WCIF schedule. The editor itself is the shared `src/components/CustomEventEditor.tsx` component (also used by the custom-competition builder). By default each custom event produces a separate PDF containing **4 blank scorecards** with the event name pre-filled but group, name, and all result fields left blank; an optional **round label** and an optional **competitor CSV** change that (below).

### Scorecard format

Each custom event has these options:

| UI field | Values | Effect |
|---|---|---|
| Format | Average of 5 (default) / Mean of 3 / Best of 3 / Best of 2 / Best of 1 | Sets the number of attempt rows |
| Cutoff | Empty (no cutoff) / `M:SS` string | Converts avg5/mo3/bo3 to the split `bo2-avg5` / `bo1-mo3` layouts and prints the cutoff line. Hidden (and cleared) for Best of 2 / Best of 1, which have no post-cutoff phase |
| Time limit | Empty (no limit) / `M:SS` string | Printed in the result-column header |
| Round label | Empty / free text (e.g. `Final`) | Printed in the card's round field (blank by default) |
| Competitors (CSV) | Optional file upload | One named scorecard per row instead of 4 blanks (see below) |

The `ScorecardFormat` derivation (`resolveCustomFormat` in `src/lib/customScorecards.ts`) mirrors the standard rounds - Best of 3 uses the same 3-row layout as Mean of 3 (exactly how WCIF format `'3'` is handled), and `bo1` is a dedicated single-row layout added for custom events:

| Format radio | Cutoff set? | Resulting `ScorecardFormat` |
|---|---|---|
| Average of 5 | No | `avg5` |
| Average of 5 | Yes | `bo2-avg5` |
| Mean of 3 / Best of 3 | No | `mo3` |
| Mean of 3 / Best of 3 | Yes | `bo1-mo3` |
| Best of 2 | (ignored) | `bo2` |
| Best of 1 | (ignored) | `bo1` |

### Competitor CSV

Uploading a CSV for an event switches its PDF from 4 identical blanks to **one named scorecard per row**, padded with blank cards of the same event to fill the last 4-card page (spares for cutting). Parsed by `src/lib/parseCompetitorCsv.ts`:

```
# one competitor per line, WCA ID optional
Alice Martin
Bob Tremblay,2021TREM02
```

- Format: `Name` or `Name,WCAID` - no quoting needed; a comma-containing name works as long as the WCA ID (if any) is the last field (`Doe, John,2019DOEJ01`).
- The WCA ID is recognised by shape (`4 digits + 4 letters + 2 digits`) and upper-cased; rows without one print an empty WCA ID field.
- Blank lines and `#` comments are ignored; an optional `Name,...` header row is skipped; a leading UTF-8 BOM is stripped; duplicate rows are kept (two rows = two cards).

### Icon selection

Each custom event can have an icon that appears in the top-left of the scorecard, next to the event name. Two options are available:

- **WCA icon** - select one of the 17 standard WCA event icons shown in the picker grid. Clicking an already-selected icon deselects it.
- **Custom image** - upload any image file; it is stored as a base64 data URL and embedded directly in the PDF.

If no icon is selected, the event-name cell expands to fill the full width (same behaviour as events without icons in the standard scorecard renderer).

### Output

Each custom event is rendered using the same `ScorecardDocument` component as regular scorecards (`buildCustomEntries` in `src/lib/customScorecards.ts` builds the entries). The output filename is `{competitionId}_custom_{sanitized_name}.pdf`, where `sanitized_name` replaces non-alphanumeric characters with underscores (max 40 chars).

---

## Custom competitions (non-WCA)

The competition picker's **"Create a custom competition"** tile opens `/custom` (`src/pages/CustomCompetitionPage.tsx`), a builder for unofficial competitions that don't exist on the WCA website. The user names the competition and defines events with the same editor as above - every option (format, cutoff, time limit, icon, round label, competitor CSV) is available. Continue requires a non-empty name and at least one named event.

Because there is no WCIF, the flow skips `/scope` and goes straight to Settings. The builder writes the standard sessionStorage contract (`selected_competition_id` = `custom_` + slugified name, `selected_competition_name`, `competition_has_groups: 'true'`, a scorecards-only `generation_scope`, `generation_detection: { showSecondRoundMode: false }`) plus two custom keys: `custom_competition: 'true'` and `custom_competition_events` (the JSON event list).

Downstream behaviour when `custom_competition` is set:

- **SettingsPage** shows only Language, Paper format, and Logo. The WCA Live, scramble double-check, subsequent-rounds, name-tag, and Advanced custom-event sections are hidden (events were already defined on `/custom`); the WCA Live auto-detect fetch is skipped. On submit it forces `wcaLiveId: null`, `hideWcaLiveId: true`, and `isCustomCompetition: true` - custom competitions are unofficial, so the `WCA Live:` line **never** appears on their scorecards. The back button returns to `/custom` (entries are preserved).
- **GeneratePage** skips the WCIF fetch entirely (`emptyParsedWcif()` from `src/lib/wcif-parser.ts`) and renders one PDF per custom event; the scorecard/page stats count the custom cards (`customEventPageCount`).
- Selecting a WCA competition on the picker clears both custom keys, so a stale custom flag can never leak into a WCA flow.

---

## PDF rendering constraints

### Web Worker

All PDF rendering happens inside `src/pdf/scorecardWorker.ts` (a Vite module worker). The worker receives the parsed data over `postMessage` and posts progress events back to the main thread. This prevents the UI from freezing during rendering, which can take several seconds for large competitions.

### `bufferPolyfill.ts` must be the first import

`@react-pdf/renderer` and its dependencies (`pdfkit`, `fontkit`) use Node.js `Buffer` and call DOM APIs (`document.createElement`, `window`, etc.) at module initialisation time - before any user code runs. The polyfill file sets `globalThis.Buffer`, `globalThis.window`, and a stub `globalThis.document` before any other module loads. If it is not the first import in the worker, react-pdf crashes with errors like `Buffer is not defined` or `document.querySelector is not a function`.

### PNG decoding synchronous override

`png-js` (used internally by pdfkit for PNG images) calls `fflate.unzlib` asynchronously, which internally spawns a **nested Web Worker**. Nested workers in a worker context do not reliably deliver messages back to the outer worker - the PDF stream never emits `end` and rendering hangs indefinitely. The polyfill patches `PNG.prototype.decodePixels` to use `fflate.unzlibSync` instead, making PNG decoding synchronous. The patch must run before `@react-pdf/renderer` imports `png-js`, which is guaranteed because `bufferPolyfill.ts` is the first import.

### ZIP compression level

`fflate.zipSync` is called with `{ level: 0 }` (store, no compression). PDF files are already compressed internally; re-compressing them adds CPU time and produces no meaningful size reduction. When only one PDF was rendered, `zipSync` is not called at all - the worker transfers that PDF's buffer straight to the main thread.

### Hyphenation disabled

`Font.registerHyphenationCallback((word) => [word])` tells react-pdf never to hyphenate any word. Without this, react-pdf hyphenates long names mid-word, which looks wrong on scorecards and name tags.

---

## Language support

The printed-output language is chosen on the SettingsPage as a **mandatory primary language** plus an **optional second language**, in any combination - not a fixed list of presets. Both selectors are driven by the shared `LANGUAGES` registry (`src/i18n/index.ts`), and the per-language strings live in the `LOCALES` table in `src/lib/i18n.ts`.

| Setting | Effect |
|---|---|
| `language` | Primary language (mandatory). Currently one of `en`, `fr`, `es`, `pt`. Defaults to the current interface language (falling back to the first supported language). |
| `secondaryLanguage` | Optional second language (`null` = single-language output). Defaults to `null`. |

In the SettingsPage UI the two rows of language tiles share the same fixed columns (one language per column). The secondary row mirrors the primary row, except the column under the currently-selected primary becomes the **None** tile - so the columns never shift when the primary changes, and each column always represents exactly one language. This selector logic lives in `src/lib/languageSelector.ts` (`resolveDefaultPrimaryLanguage`, `secondaryLanguageRow`).

**Adding a language** is a one-entry-per-store change: add a string bundle to `LOCALES` in `src/lib/i18n.ts`, and add a `LANGUAGES` entry + UI translation JSON (registered in `resources`/`supportedLngs`) in `src/i18n/index.ts`. No getter, merge, or settings-form code needs touching.

When a second language is set, scorecard column headers and the result header each contain both languages separated by a newline (primary first), and the cut-off and provisional lines are likewise bilingual. Event names, group labels, round labels, station labels and the cover card always use the **primary** language only. The schedule tracker and name-tag duty labels also use the primary language only.

Name tag role badges use the primary language on the **front** panel and the secondary language on the **back** panel (falling back to the primary when no second language is set). For example, primary `fr` + secondary `en` reproduces the previous default: French titles on front, English on back.

> The retired `bilingual-fr` / `bilingual-en` presets map onto this model as primary `fr` + secondary `en` and primary `en` + secondary `fr` respectively; `GeneratePage` migrates any persisted legacy value automatically.

---

## Project structure

```
src/
  auth/
    pkce.ts               - PKCE code verifier / challenge generation
    wca.ts                - OAuth endpoints, token exchange, WCA API helpers
    AuthContext.tsx        - React context: token + user, persisted in sessionStorage
  lib/
    wcif-parser.ts         - WCIF → ParsedWCIF (scorecards, nametags, schedule + checking days)
    pdfJobs.ts             - Which PDFs to render and what the download is called (bare PDF vs ZIP)
    generationScope.ts     - GenerationScope / DocumentSelection: what to generate, and filtering by it
    i18n.ts                - Printed-output strings and event names, one bundle per locale
    languageSelector.ts    - Primary/secondary language row logic for the SettingsPage tiles
    logo.ts                - Resolves which logo to render: custom upload, SCC default, or none
    pageEstimate.ts        - Page-count estimate shown before generating
    customScorecards.ts    - Builds scorecard entries for custom (non-WCA) events
    parseCompetitorCsv.ts  - Competitor CSV for custom events
    parseDoubleCheckOverrides.ts - "always double-check this person" CSV overrides
    wcifCache.ts           - Caches fetched WCIFs for the session
    useIsMobile.ts         - Viewport hook driving the responsive layout
    downloadButtonFontSize.ts - Shrinks the download button label to fit
  changelog.ts             - "What's new" entries, all four locales (single edit point)
  components/              - Shared UI: Header, Tooltip, Skeleton, WarningBanner, AboutDialog, PrintGuide, …
  i18n/                    - Interface translations (en/fr/es/pt.json) + the LANGUAGES registry
  theme/                   - Light/dark ThemeContext (localStorage-persisted)
  presets/                 - Regional presets: one JSON per region + index.ts (build-time glob)
    ontario.json           - Add a region by dropping a JSON file here - no code changes
    quebec.json
    british-columbia.json
    index.ts               - Loads, validates (whitelist) and exposes PRESETS
  pages/
    LoginPage.tsx
    AuthCallbackPage.tsx
    CompetitionPickerPage.tsx
    CustomCompetitionPage.tsx - Builder for custom (non-WCA) competitions
    RoundScopePage.tsx     - "What to generate": presets, document types, round scope
    SettingsPage.tsx
    GeneratePage.tsx       - Fetches WCIF, drives the worker, renders download button
  pdf/
    bufferPolyfill.ts      - MUST be first import in worker; patches Buffer, window, document, PNG
    ScorecardDocument.tsx  - react-pdf component: scorecard cards + cover cards + document shell
    NametTagDocument.tsx   - react-pdf component: name tag panels with QR codes and duty assignments
    ScheduleTrackerDocument.tsx - Per-day schedule tracker
    CheckingSheetDocument.tsx   - The Round Checklist (one table per day)
    FirstTimerSlipDocument.tsx  - First-timer slips
    firstTimerSlipLines.ts - Slip copy, per locale
    layoutConstants.ts     - Shared page geometry (paper sizes, margins, grids)
    scorecardWorker.ts     - Web Worker: renders all PDFs sequentially, zips them (unless there's only one), posts result
  types/
    settings.ts            - CompetitionSettings interface (language, paper, logo, nametag modes)
    wcif.ts                - WCIF type definitions
  assets/
    events/                - PNG event icons (one colour + one grey per WCA event ID)
    events.ts              - Maps event IDs to their icon data URLs (Vite ?inline imports)
    SC_Logo.png            - Bundled Speedcubing Canada logo (black & white)
    scc-logo.ts            - Re-exports SC_Logo.png as a data URL for the PDF worker
generate-nametags.mjs      - Dev-only Node.js scripts to render a PDF locally without a browser
generate-first-timer-slips.mjs
generate-scorecards-test.mjs
```
