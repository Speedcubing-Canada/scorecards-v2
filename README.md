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

### Tests and CI

```
npm test          # vitest, ~5s, no network and no PDF rendering
npm run test:watch
npm run lint      # eslint
npx tsc -b        # typecheck (also the first half of npm run build)
```

All three run in CI on every pull request and every push to `main`, as the `test` job in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The deploy job `needs: test`, so a red test never reaches production; on a pull request the deploy job is skipped entirely.

**Tests never assert a translated value.** Rewording a printed string is routine editorial work and must not turn CI red, so the guards around `src/lib/i18n.ts` (printed output) and `src/i18n/*.json` (interface) are structural:

| Guarded by | What it enforces |
|---|---|
| `src/lib/i18n.test.ts` | Every locale carries every field (recursively, functions included); interpolation still lands its argument; the bilingual merge stacks the right fields and leaves the rest primary-only; gendered titles differ outside English; no em dash. |
| `src/i18n/locale-parity.test.ts` | Same key parity, non-empty leaves and no-em-dash rule for the interface JSON bundles. |
| `src/pdf/*-layout.test.ts` | Whether the string still **fits**: header and column width sweeps across all four locales and both paper sizes, measured against a Helvetica AFM glyph table. |

So a translation edit only fails CI when it breaks something real: a field missing from one locale, a lost `\n` in a two-line column header, or text too wide for its column. If a width sweep does fail, the string is genuinely too long for the printed layout - shorten it rather than loosening the test. A character absent from the glyph table is measured at the widest Helvetica glyph, so an unlisted accent errs towards failing rather than silently passing; add its real width to both tables if you hit that.

The few remaining wording assertions are *negative* and encode decisions rather than words, e.g. the Round Checklist's two pre-round tick columns must never read as "collected" or "checked".

### Production deployment

Deploys run automatically from [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on every push to `main`, after the `test` job passes. The workflow builds the bundle on a GitHub-hosted runner (injecting `VITE_WCA_CLIENT_ID` from the repo variable of the same name), then uploads the prebuilt `dist/` to App Engine via Workload Identity Federation. One-time GCP setup (WIF pool, service account, IAM bindings) is documented in [`.github/workflows/README.md`](.github/workflows/README.md).

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

The UI styles itself with per-component inline `React.CSSProperties` objects (no CSS
framework), so a set of **CSS custom properties** in `src/index.css` is what keeps those
inline styles consistent: a type scale (`--fs-*`), spacing (`--space-1`..`--space-8`), radii,
the theme colours, and a global `:focus-visible` ring. Reference the tokens, not magic
numbers.

Typeface is **Montserrat**, in exactly **three weights**: 400 body, 500 controls, 700
headings and primary buttons. `index.html` loads only `@400;500;700` - do not reintroduce
600/800. **Icons** come exclusively from `lucide-react`; the WCA event PNGs in
`src/assets/events.ts` are artwork for the PDFs, not UI chrome.

The hard rules here are enforced by `src/components/design-system.test.ts`, and the full
guidance is in [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md).

Shared primitives: `Tooltip.tsx` (dependency-free, hover + keyboard, for any icon-only or
jargon control), `PrintGuide.tsx` (the download page's per-document
[print-and-cut guide](#print-and-cut-guide)), and `Skeleton.tsx` (loading placeholders that
mirror the eventual layout rather than bare text; respects `prefers-reduced-motion`).

### Regional presets

The "What to generate" step offers an optional **preset** column seeding the options a region
usually prints. **Default** is selected out of the box, so ignoring presets gives the
behaviour described everywhere else in this README.

A preset only **seeds defaults** - everything stays editable afterwards, and switching presets
re-seeds from base rather than accumulating the previous choice. Because it spans two steps,
`/scope` stashes the settings half under `preset_settings` and `SettingsPage` reads it as its
initial state; `CompetitionPickerPage` clears it on mount so a preset never leaks into the
next competition.

Presets are plain JSON in **`src/presets/`**, globbed at build time, so **adding a region is a
file drop plus a PR - no `.ts`/`.tsx` changes**. `parsePreset()` whitelists keys and values,
so a contributor's typo is dropped rather than written into `CompetitionSettings`. Shipped:
Ontario, Quebec, British Columbia. Field reference and contributor guide:
[`src/presets/README.md`](src/presets/README.md).

### Interface language

A dropdown in the header (and on the login page) switches the *interface* language via
`i18next`, persisted under `i18nextLng`. The available languages come from the `LANGUAGES`
registry in `src/i18n/index.ts`, which also drives the scorecard language pickers - so adding
a locale there plus its JSON makes it appear in both places with no further wiring.

This is independent of the printed-output `language` / `secondaryLanguage` settings.

### Dark mode

Implemented with the CSS custom properties above: `:root` for light, `[data-theme='dark']`
for dark. `src/theme/ThemeContext.tsx` sets the attribute on `<html>`, defaulting to the OS
`prefers-color-scheme` and following live OS changes until the user toggles, after which the
choice persists under the `theme` key and wins. `resolveInitialTheme` in `src/theme/theme.ts`
is the pure helper, covered by `theme.test.ts`.

The SCC wordmark is black and would vanish on dark, so `Logo.tsx` swaps to
`public/scc-logo-dark.svg` - the same file with `#000000` replaced by `#ffffff`.
`logo-asset.test.ts` guards that the two stay in sync; regenerate the dark file if the source
logo changes.

Dark mode is on-screen only. The PDFs use `@react-pdf`'s isolated `StyleSheet` with white
backgrounds, so printed output is identical in either theme.

### Responsive / mobile layout

One breakpoint, **600px**. Because components style themselves inline, CSS `@media` cannot
override those styles, so the breakpoint is read in JS via `src/lib/useIsMobile.ts` (hook,
`MOBILE_BREAKPOINT`, and a pure `isMobileWidth` that is unit-tested). Components spread a
mobile-only override into their existing style object.

The notable adaptations: the header collapses behind a hamburger; the competition grid drops
to one column; the Generate stat grid goes five columns to two; and the Settings custom-event
rows stack.

### "About this tool" dialog

`AboutDialog.tsx` explains what the tool is, what the **WCIF** is, and where this sits in the
workflow - it is the *final* step, turning already-assigned groups into print-ready PDFs. It
renders as an icon button or a text link (`as="text"`), and appears on the login page and the
competition picker. Copy lives under the `about.*` keys.

### Feedback and bug reports

Bug reports go to the
[issue tracker](https://github.com/Speedcubing-Canada/scorecards-v2/issues) or
**software@speedcubingcanada.org**. `ContactLinks.tsx` puts both in the header on every
signed-in page and at the bottom of the About dialog, which is what covers the signed-out
login page (it has no header). The URL and address are exported constants in that one file;
import them rather than retyping, and `contact-links.test.ts` enforces the single copy.

The GitHub mark is `public/github-mark.svg` in an `<img>`, not a lucide icon: lucide 1.x
dropped brand icons and the design-system guard forbids inline SVG in `src/components`. Same
asset escape hatch `Logo.tsx` uses.

### "What's new" changelog

Organizers typically return once per competition, months apart, so `WhatsNewDialog.tsx` shows
what shipped since their last visit. No account or analytics data: `localStorage` holds one
key, `changelog_seen`, with the id of the newest entry read.

It **opens by itself** on the first load where unseen entries exist, and closing marks
everything read, so it opens once even though the header remounts on every wizard page.
Afterwards a sparkles icon reopens it with the three most recent entries. A visitor with no
marker sees it, so the existing user base does not silently miss the first entry.

**The feature switches itself off once the newest entry is over a year old** (`isStale`),
rather than greeting organizers with last year's highlights. Shipping a new entry brings it
back.

Entries live in **`src/changelog.ts`**, newest first:

```ts
{
  id: '2026-09-12',                     // YYYY-MM-DD, unique; second same-day entry -> '2026-09-12b'
  items: {
    en: ['Short organizer-facing bullet.'],           // required
    fr: ['Puce courte destinée aux organisateurs.'],  // optional, falls back to en
  },
}
```

Ids drive the newer-than-seen comparison, so they must stay sortable and strictly descending;
`changelog.test.ts` enforces that plus uniqueness and non-empty text in every locale provided.
Entry text is deliberately **not** in the i18n bundles, so a release never needs four full
translations - only the dialog chrome (`whats_new.*`) is localised.

### "No groups assigned" warning

When groups have not been generated yet, scorecard counts read 0, which confused early users.
`parsed.hasGroups` drives a `WarningBanner` on the Settings and Generate pages explaining that
groups must be assigned upstream (Groupifier or the WCA website) first, while the schedule
tracker and name tags can still be generated.

### Page-count estimate

`estimateTotalPages` in `src/lib/pageEstimate.ts` gives organizers the real print volume
before they download. Exact for scorecards and name tags (four per page, using the same
`layoutConstants.ts` values the documents use, so the two cannot drift), one page for the
schedule tracker and checklist, and a greedy height-based estimate for the auto-flowing
first-timer slips. It is pure and deliberately free of any `@react-pdf` import so the PDF
engine stays out of the main bundle.


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

An **opt-in document** chosen on `/scope` (`DocumentSelection.roundChecklist`, default
**false**). `filterParsedByScope` empties `checkingDays` unless it is selected, so every
downstream consumer gates on `checkingDays.length > 0` alone.

Rendered by `src/pdf/CheckingSheetDocument.tsx` from `ParsedWCIF.checkingDays`: **one table
per day, one row per round**, whatever room or stage the round ran in. (Internals still use
the earlier "checking sheet" names.) Columns are Start time, Event, Groups created,
Scorecards ready, Data entry, Double-check, and Scorecards taken by; their widths and the
reasoning behind each are in `CHECKING_FLEX` in `src/pdf/layoutConstants.ts`.

**The columns record work, not custody.** *Groups created* means the groups were made on
competitiongroups; *scorecards ready* means they were printed or hand-written. Both happen
before the competition for a first round, so both boxes print already ticked on every
`roundNum === 1` row (`CheckingRow.preChecked`); later rounds print blank. Ticks are drawn
with `Svg`/`Polyline`, not typeset - Helvetica has no U+2713.

*Data entry* and *double-check* take initials **and** a tick box: either can span several
passes, so the cell accumulates initials and the box is ticked only when the round is
finished. The box is pinned right; the writing space beside it is held at >= 40 pt by the
layout test.

`checkingDays` is built unconditionally and is independent of `scorecardCheckMode` - cover
cards and the checklist do not influence each other. Group counts come from `groupUnitsOf`,
so a later round with no real groups still reports the count implied by its scramble-set
count, and rounds with no groups yet report `0`. `333fm` **is** included: results entry
happens for it even though it never gets cover cards.

### One table per day

**The checklist has no room dimension.** A round produces one pile of scorecards however many
rooms or stages it runs across, and the pile is what this document tracks, so every room's
rounds for a date go into one table in start-time order. `CheckingDay` is
`{ dayLabel, rows }` - there is no stage level.

Merging unions the rounds' **group activity codes** rather than adding per-room counts: two
stages running one logical group share that group's code, and a later round synthesizes the
same `g1..gN` in every room it occupies, so summing would double both. The merged row spans
earliest start to latest end, and a round holding two blocks of a day collapses to one row.
See `mergeSlots` in `wcif-parser.ts`.

**The schedule tracker is unaffected** and keeps one table per room: it records when each
stage actually runs, which is exactly what merging throws away.

#### Page breaks

A day's table is as long as the day, so it can outgrow a page - around 20 rounds on LETTER
(`checking-sheet-layout.test.ts` pins the arithmetic). The day block therefore **wraps**, and
the non-obvious constraints are:

- **Never `wrap={false}` on the day block.** @react-pdf *squashes* an oversized non-breaking
  block rather than moving it to its own page - at 30 rounds every tick box collapses into an
  unusable sliver.
- Each `DataRow` is `wrap={false}`, so a break never lands inside a row (a split row loses its
  cell borders and its start time).
- The day heading, column header and **first** data row form one atomic group, which is why
  the table is drawn as two bordered pieces (`tableHead` + `tableRest`, joined by dropping the
  shared border). `minPresenceAhead` alone does not achieve this.
- Known limit: a day spanning two pages does not repeat the column header on the second. A
  `fixed` header would also draw on the common single-page case, so it loses on balance.

### The lunch rule

Both this document **and** the schedule tracker draw a thick rule (`CHECKING_BREAK_RULE`,
1.5 pt) where lunch splits a day. `breakBefore` is set on the first round starting after a
scheduled lunch; the first row of a table never carries one, since the header border is
already above it.

Lunch is detected **explicitly, never inferred from a gap**: an activity counts when it is not
a round activity and either its `activityCode` is `other-lunch` or its name matches
`LUNCH_NAME_RE` (lunch / dîner / déjeuner / almuerzo / almoço / comida) - delegates routinely
file lunch under `other-misc` with a localised name. Only lunch draws a rule; awards and
tutorials would clutter a busy day. Lunch activities are collected across **every** room of
the day, since a competition typically breaks once while the rule belongs on every table. The
lunch activity itself never becomes a row.

`checking-sheet-layout.test.ts` pins the geometry: every header, in every locale, on both
LETTER and A4, must fit its column at 8 pt Helvetica-Bold; the event column must additionally
fit the longest event + round label at 10 pt regular; and the initials columns must keep
>= 40 pt of writing space beside their tick box.


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

`secondRoundMode` picks how a **not yet assigned** later round is printed:

- **Prefilled** - one cover card per group, then every round-1 participant with a blank group
  placeholder (`Group _ of N`). Staff sort the advancing competitors and pull their cards.
- **Blanks** - fully blank scorecards per group, as for finals.

Two wrinkles the WCIF forces on this, both implemented in `src/lib/wcif-parser.ts`:

- **Later rounds scheduled without groups.** The buckets are built from the schedule's group
  child-activities, but some organizers schedule a later round as a bare time block. The
  parser then synthesizes as many implicit groups as the round has scramble sets
  (`Round.scrambleSetCount`, floor 1). Rounds >= 2 with no real groups anywhere only, and it
  never flips `parsed.hasGroups`. See `groupUnitsOf`.
- **Sizing them (the advancement chain).** Round 1's field is the accepted registration count;
  each later round applies the previous round's advancement condition - `ranking` takes the
  top X, `percent` takes `floor(level/100 * previous)`. Blank stacks hold
  `ceil(field / groups) + 2` per group. An `attemptResult` or absent condition makes the
  field unknowable, so those fall back to a flat **16** blanks. See `roundFieldSize`.

### Mid-competition generation (live group assignments)

When the parser finds real `competitor` assignments for a round >= 2 - the organizer assigned
groups mid-competition and re-exported the WCIF - it emits **named** scorecards with the
actual group, routed to the matching bucket instead of the prefilled/blank output above.
Unassigned rounds still use the fallback.

Detection happens up front on `RoundScopePage`, right after picking the competition, not at
download time. If at least one later round has assignments, that page asks a **scope**
question:

- **Latest round only** *(default)* - only the most recent round that has groups. Best
  mid-competition: you do not reprint earlier rounds.
- **Everything** - all rounds, using assigned groups where available.
- **Select rounds** - pick individual event + round combinations.

The scoped modes emit scorecards only; name tags, the schedule tracker and extras are
pre-competition artifacts, so they are skipped and the Settings page hides those sections.
With a normal pre-competition WCIF there is no prompt and the page auto-advances.

Independently, the same page carries a **Document types** checklist (`DocumentSelection`):

| Key | Label | Default |
|---|---|---|
| `scorecards` | Scorecards | on |
| `scheduleTracker` | Schedule Tracker | on (off mid-competition) |
| `nametags` | Nametags | on (off mid-competition) |
| `roundChecklist` | Round Checklist | **off** |
| `firstTimerSlips` | First-Timer Slips | off |

`filterParsedByScope` applies these by **emptying the corresponding arrays**, so everything
downstream just checks `.length > 0` and needs no knowledge of the selection. Continue is
disabled when nothing is ticked. Scope logic lives in `src/lib/generationScope.ts`; the
chosen scope persists on `CompetitionSettings.generationScope`.

### Print layout (quad-reorder / cut-and-stack)

Four cards per page, deliberately **not** in reading order. They are interleaved so that
after printing, cutting the centre lines and stacking the half-sheets, each stack is already
in distribution order: input 0 goes to page 1 top-left, input 1 to page 2 top-left, and so
on, so all top-left cards come first, then all top-right. `reorderQuadrants` in
`src/lib/wcif-parser.ts` implements it, and entries are padded to a multiple of 4 first so
the stacking arithmetic holds.

### Page geometry

Cards preserve the original HTML scorecards' aspect ratio (561:726 = 0.773) and are
absolutely positioned so the cutting gaps are exact.

| Paper | Card size | Positions (left, top in pt) |
|---|---|---|
| LETTER (612x792 pt) | 282x365 pt | (12,12), (318,12), (12,415), (318,415) |
| A4 (595x842 pt) | 274x354 pt | (12,36), (309,36), (12,452), (309,452) |

### Bilingual result header

With a secondary language, both the result prefix and its suffix are two lines. Concatenating
them naively gives four lines in a narrow column, so they are split on `\n` and interleaved -
prefix line 1 + suffix line 1, then prefix line 2 + suffix line 2 - keeping the header at
exactly two lines.

### Name font size

Auto-scaled to fit one line in the name cell; see `nameFontSize` in
`src/pdf/ScorecardDocument.tsx` for the formula and its bounds. Available width depends on
the header mode below (~158 pt with a logo cell, ~210 pt without).

### Logo vs competition name

Three mutually exclusive header modes, resolved by `src/lib/logo.ts`:

| `logoDataUrl` | `useDefaultLogo` | State | Header content |
|---|---|---|---|
| set | - | `custom` | Uploaded logo alone in an 80 pt cell; competition name **not printed** |
| `null` | `true` (default) | `default` | Competition name + bundled SCC logo side by side, 80 pt cell |
| `null` | `false` | `none` | Competition name only, printed vertically in a narrow 26 pt cell |

`default` is the standard for Canadian competitions; competitions elsewhere turn
`useDefaultLogo` off to get the `none` layout.


---

## Name tag PDF

### Physical layout

Both layouts produce 8 panels (4 front/back pairs) per page, but differ in page orientation
and card size. Exact slot sizes, margins and gaps live in `CONFIGS` / `H_CONFIGS` at the top
of `src/pdf/NametTagDocument.tsx`.

**Vertical** (`nametagLayout: 'vertical'`, default) - landscape page, 4 columns x 2 rows:

```
row 0: [Front_A] [Back_A] [Front_B] [Back_B]
row 1: [Front_C] [Back_C] [Front_D] [Back_D]
```

Cut between column pairs (each front/back pair is adjacent) and fold front-to-back.

**Horizontal** (`nametagLayout: 'horizontal'`) - portrait page, 2 columns x 4 rows, one
person per row:

```
row 0: [Front_A] [Back_A]
row 1: [Front_B] [Back_B]
row 2: [Front_C] [Back_C]
row 3: [Front_D] [Back_D]
```

Cut horizontally between rows and vertically down the centre; each row pair goes into the
holder front-and-back.

The constraint that fixes horizontal card size: **90 x 55 mm badge holders**, with ~2 mm
clearance per edge. That is dictated by the holder, not the paper, so LETTER and A4 use the
same 244 x 147 pt card. Do not "optimise" it per paper size.

The 147 pt card height is also why compact mode compresses the top section and moves the WCA
ID to the back panel only, and why event icons are dropped from the QR side - see
`eventIconsVisible` in `src/pdf/layoutConstants.ts`, the single source of truth for that rule.

Known limit: in compact mode the top section is top-packed with equal gaps so the role badge
lands at the same Y on both panels, but a very dense duty list can still push the front
taller and break that alignment.

### Panel contents

Every panel opens with the same top section: logo or competition name (per
`nametagLogoMode`), competitor name (auto-sized), role badge (coloured by role, pinned to a
fixed Y so it does not move with name length), event icons, and the WCA ID or a first-timer
placeholder.

The **front** carries duty assignments in the primary language, grouped as compete /
scramble / judge / run. The **back** uses the secondary language (or the primary when none is
set) and carries two QR codes: competitiongroups.com, keyed by `registrantId`; and WCA Live,
keyed by `wcaLivePersonIds[registrantId]`, falling back to the WCA Live homepage when that
mapping is unavailable.

### QR code modes (`nametagQrMode`)

| Value | Front panel | Back panel |
|---|---|---|
| `back-only` (default) | Duty assignments | QR codes |
| `both-sides` | QR codes (primary language) | QR codes (secondary language) |

`both-sides` helps when the logo squeezes the assignments, or simply on preference.

### Logo modes (`nametagLogoMode`)

Applies whenever a logo will render - a custom upload, or the bundled Speedcubing Canada
default when `useDefaultLogo` is set. No effect when neither is available.

| Value | Header row |
|---|---|
| `hidden` | Competition name text |
| `with-name` | Small logo (20 pt) beside the competition name |
| `logo-only` | Large logo (28 pt) centred, no name; QR codes shrink 75 -> 65 pt to compensate |

### Auto-sizing

Both the name and the duty-list font size are computed, not fixed - see `nameFontSize` and
the duty sizing in `src/pdf/NametTagDocument.tsx`, which carry the constants and the reason
for each bound. The short version: names cap at 20 pt so a short name does not dwarf a long
one, and duties shrink past 8 items, bottoming out at 5 pt.

### QR code rendering

QR codes are native react-pdf SVG (`<Svg>` / `<Rect>`), not rasterised images, so they stay
sharp at any print resolution with no image dependency. Consecutive dark modules in a row are
merged into one bar to keep the element count down.

### Development helper

`npm run render:fixtures` renders the name tags (among all six documents) from the real Gros
Jouets export in `example-comp/`, without a browser or a running dev server:

```
npm run render:fixtures                  # vertical layout (default)
npm run render:fixtures -- --horizontal  # horizontal layout
```

Output is written to `../current-output/`. See [Rendering PDFs outside the browser](#rendering-pdfs-outside-the-browser).


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

`npm run render:fixtures` also renders the slip PDF, from a fixture of the real newcomers reconstructed from the original Gros Jouets PDF (birthdates included), for layout verification against `original-output/`:

```
npm run render:fixtures   # → ../current-output/GrosJouetsaMontreal2026_first_timers.pdf
```

---

## WCIF parsing

`src/lib/wcif-parser.ts` turns the competition's WCIF JSON into a `ParsedWCIF`: the four
scorecard buckets, plus name tags, first-timers, extras, and the schedule/checklist day
lists. Read the interface at the top of that file for the current shape - it is commented
per field, and this section only records the decisions the types cannot show.

### What is skipped

- **FMC (`333fm`)** - no scorecard format exists, so it is skipped for scorecards and
  extras. It *is* included in the schedule tracker, which staff still need.
- **Multi-Blind (`333mbf`)** - named assignments are skipped; delegates handle MBF by hand.
- **Persons** whose `registration.status` is not `accepted`.

### Round categorisation

```
firstRound   - roundNum === 1 for any event
intermediate - roundNum in [2, N-1] AND the event has N >= 3 rounds
semis        - roundNum === N-1 AND the event has N >= 4 rounds
finals       - roundNum === N AND N >= 2
```

A 2-round event's second round goes straight to finals, never to intermediate.

### Scorecard format selection

| WCIF format | Cutoff? | Scorecard format |
|---|---|---|
| `a` (average of 5) | no | `avg5` (5 rows) |
| `a` | yes | `bo2-avg5` (2 pre-cutoff + 3 post-cutoff rows) |
| `3` or `m` (mean/best-of-3) | no | `mo3` (3 rows) |
| `3` or `m` | yes | `bo1-mo3` (1 pre-cutoff + 2 post-cutoff rows) |
| `2` (best-of-2) | - | `bo2` (2 rows) |

Two overrides the WCIF cannot express:

- **`444bf` / `555bf` are forced to `mo3` / `bo1-mo3`.** The WCIF sometimes reports these
  as format `2`, but the regulations require a mean-of-3 structure.
- **`333mbf` is always `bo2`.** Its "`___ out of ___`" result template keys off
  `eventId`, not the format code - 6x6 and 7x7 are also `bo2` and must not show it.

`333bf` uses `avg5` as of 2026 and is *not* in the blind-events override set.

### Ordering and labels

Entries sort by `timeslot -> eventId -> stage -> group -> kind -> name`, where the timeslot
key (`A01`, `B03`, ...) encodes start time and room so cards print in schedule order.

The stage sort key is what keeps a **stationary round** (assignments carrying a
`stationNumber`, shown as `Station 01` instead of a group label) in one contiguous pile per
stage rather than interleaving stages whose stations are numbered across them. For rotation
rounds it is a no-op, since the stage already prefixes the group label.

A final that is a single group in a single stage uses station numbers on its blank cards -
the event and round already identify the stack, so `Group 1 of 1` would be noise.

The trailing "of Y" of every `X of Y` label renders grey; `splitLabelTotal` in
`src/lib/i18n.ts` documents how it splits, including why it splits on the *last* connector.

### Counts

When the previous round has an `advancementCondition` of type `ranking`, blanks per group in
finals/intermediate are `ceil(level / totalGroups) + 2`. Otherwise 16 per group.

### Name tags

Sorted **Delegates -> Organizers -> Returning competitors -> New competitors**, alphabetical
within each group, so first-timers can be separated at check-in.

Three different person IDs are in play and must not be confused:

| Field | What it is | Used for |
|---|---|---|
| `registrantId` | sequential per competition | competitiongroups.com URLs, and the key into `wcaLivePersonIds` |
| `wcaUserId` | WCA website account ID | nothing in the QR codes |
| WCA Live person ID | WCA Live's own internal ID | the WCA Live URL, resolved via `fetchWcaLivePersonIds` |

### Extras

One blank card per round per event, in schedule order, padded to a multiple of 4 but **not**
quadrant-reordered - extras are a loose stack, not a cut-and-stack bundle.

### Schedule tracker and checklist

Both are built in one pass: each room's activities reduce to `RoundSlot`s, and `buildRows`
turns a slot list into either row shape. The tracker keeps one table per room per day; the
checklist concatenates every room's slots for the date and runs `mergeSlots`, giving one
table per day. See **The Round Checklist** above.

Day labels come from a global date-to-day-number map across all rooms, so "Day 1" is the
competition's earliest date whichever room you are looking at. Times use the venue timezone
(`wcif.schedule.venues[0].timezone`), 24-hour. Round labels in the tracker are always
English - it is a staff document.


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

`Font.registerHyphenationCallback((word) => [word])` tells react-pdf never to hyphenate any word. Without this, react-pdf hyphenates long names mid-word, which looks wrong on scorecards and name tags. It is a global registration on the shared `Font` object, so it lives in `src/pdf/fontSetup.ts` and each document imports that module for its side effect.

### Rendering PDFs outside the browser

`npm run render:fixtures` renders every document from the **real** components, headlessly, to `../current-output/`:

```
npm run render:fixtures                  # all six documents
npm run render:fixtures -- --horizontal  # name tags in the horizontal layout
```

`scripts/renderFixtures.ts` imports the actual `.tsx` documents and calls `renderToBuffer`. It runs under `vite-node` because the components are JSX, which Node's native type stripping does not handle. Name tags and first-timer slips use the real Gros Jouets data from `example-comp/` with the same settings as the originals, so their output is directly comparable to `original-output/`; the scorecard, schedule and checklist fixtures are synthetic and chosen to exercise the hand-tuned constants.

`scripts/checkFixtures.sh <baseline-dir>` re-renders all six and pixel-diffs them against a saved baseline, exiting non-zero on any difference. Use it whenever a change touches `layoutConstants.ts`, `fontSetup.ts`, or `lib/i18n.ts` - the layout unit tests assert measurements and cannot see a changed border colour or row tint.

Add new cases to `renderFixtures.ts` rather than writing a separate script. A generator that re-declares a component's styles reports "no change" for edits it never saw, which is how the previous `generate-*.mjs` scripts drifted from the components they were meant to verify.

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
    AuthContext.tsx        - AuthProvider: token + user, persisted in sessionStorage
    useAuth.ts             - The context object and its hook (kept out of the .tsx for fast refresh)
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
    events/                - PNG event icons (one per WCA event ID)
    events.ts              - Maps event IDs to their icon data URLs (Vite ?inline imports)
    SC_Logo.png            - Bundled Speedcubing Canada logo (black & white)
    scc-logo.ts            - Re-exports SC_Logo.png as a data URL for the PDF worker
scripts/
  renderFixtures.ts        - Renders every PDF from the real components, headlessly (vite-node)
  checkFixtures.sh         - Re-renders and pixel-diffs all six against a saved baseline
```
