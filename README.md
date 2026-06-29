# WCA Scorecard Generator v2

A browser-only React app that generates competition scorecards and competitor name tags as print-ready PDFs for WCA (World Cube Association) events. Delegates and organizers log in with their WCA account, pick a competition they manage, configure options, and download a ZIP of PDFs — one per round stage plus one name-tag sheet.

## Stack

- **React 19 + TypeScript + Vite** — SPA, no backend required for normal use
- **`@react-pdf/renderer` v4 (browser build)** — renders scorecards and name tags to PDF entirely in the browser
- **`fflate`** — bundles all PDFs into a single ZIP for download
- **WCA OAuth 2.0 (PKCE)** — authenticates the user against the WCA API

---

## Getting started

### Environment variables

Create a `.env` file at the project root:

```
VITE_WCA_CLIENT_ID=your_wca_oauth_client_id
WCA_CLIENT_SECRET=your_wca_oauth_client_secret
VITE_WCA_REDIRECT_URI=http://localhost:5173/auth/callback   # optional, defaults to origin/auth/callback
```

`VITE_WCA_CLIENT_ID` is bundled into the client. `WCA_CLIENT_SECRET` is **never** bundled — see the section on the token proxy below.

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
2. Appends `client_secret` from `process.env.WCA_CLIENT_SECRET` (loaded into the App Engine instance from Secret Manager — never bundled into the browser).
3. Forwards the request to `https://www.worldcubeassociation.org/oauth/token`.
4. Returns the response verbatim.

In development, `vite.config.ts` provides this endpoint as a Vite dev-server middleware. The WCA token endpoint has no CORS headers, which is why the browser cannot call it directly even without the secret concern.

---

## Application flow

```
LoginPage → CompetitionPickerPage → RoundScopePage → SettingsPage → GeneratePage (download)
```

- **LoginPage** — initiates WCA OAuth PKCE; stores the code verifier in `sessionStorage`.
- **AuthCallbackPage** — exchanges the code for a token; stores the token in `sessionStorage`.
- **CompetitionPickerPage** — lists competitions managed by the logged-in user (WCA API `?managed_by_me=true`). An **"About this tool"** info button (ℹ) sits next to the heading; the same explainer is reachable from the login page (see below).
- **RoundScopePage** — fetches the WCIF up front and detects whether any round ≥ 2 already has real group assignments (groups generated mid-competition). If not (the normal pre-competition case), it auto-advances straight to Settings. If so, it asks **what to generate** — latest round only (default) / everything / select specific event+rounds — and stores the choice. The WCIF is cached in memory (`lib/wcifCache.ts`) so GeneratePage reuses it without a second fetch. It also records whether groups have been generated yet (`parsed.hasGroups`) in `sessionStorage` under `competition_has_groups`, so the Settings page can warn without re-fetching.
- **SettingsPage** — collects paper format, language, logo, etc.; auto-detects the WCA Live competition ID and per-competitor person IDs from the WCA Live API; stores settings in `sessionStorage`. It adapts to the scope: when generating scorecards only (scope ≠ everything) it shows just scorecard-relevant options and hides the name-tag and custom-event sections; it also hides the Round 2 prefilled/blanks control once Round 2 has real groups (so the choice no longer matters). When no groups have been generated for the competition yet, it shows a **"no groups assigned"** warning banner.
- **GeneratePage** — gets the WCIF (cache or fetch), parses it, applies the chosen scope, and renders the download button. PDF rendering runs inside a Web Worker to keep the UI responsive. Before downloading, it shows preview stats — scorecards, cover cards, PDFs in the ZIP, **estimated total pages**, and paper size — and repeats the "no groups assigned" warning when `parsed.hasGroups` is false.

Settings and auth state live in `sessionStorage` only — they are cleared when the tab is closed and are never sent to any server.

---

## User interface

### Interface language

The header (and the login page) carries a **language dropdown** (`src/components/LanguageSelect.tsx`) that switches the *interface* language via `i18next`. The available languages are defined once in `src/i18n/index.ts` as the exported `LANGUAGES` registry (code + native label) — this same registry also drives the scorecard language pickers on the SettingsPage, so adding a locale there (plus its translation JSON) makes it appear in both places automatically, no per-language wiring needed. The chosen interface language is persisted by `i18next-browser-languagedetector` under the `i18nextLng` localStorage key.

This is independent of the printed-output `language` / `secondaryLanguage` *settings* on the SettingsPage, which control the language(s) printed on the scorecards themselves.

### Dark mode

A theme toggle (🌙/☀️) sits next to the language dropdown in the header and on the login page. Theming is implemented with **CSS custom properties**:

- `src/index.css` defines the full token set under `:root` (light) and `[data-theme='dark']` (dark) — surfaces, text shades, borders, brand, status colors, and shadows. All UI components reference these via `var(--token)` rather than hardcoded hex.
- `src/theme/ThemeContext.tsx` (`ThemeProvider` + `useTheme`) sets the `data-theme` attribute on `<html>`. It defaults to the OS `prefers-color-scheme` and, while no explicit choice is stored, follows live OS changes. Once the user toggles, the choice is persisted under the `theme` localStorage key and wins over the OS preference.
- `src/theme/theme.ts` holds the pure `resolveInitialTheme(stored, prefersDark)` helper (covered by `theme.test.ts`).

The SCC logo's wordmark and lines are black and would vanish on the dark background, so `src/components/Logo.tsx` swaps to a white-recolored variant (`public/scc-logo-dark.svg`) in dark mode. That variant is `public/scc-logo.svg` with every `#000000` replaced by `#ffffff`; `logo-asset.test.ts` guards that the two stay in sync (regenerate the dark file if the source logo ever changes).

Dark mode affects the on-screen UI only. The generated PDFs (`src/pdf/*`) use `@react-pdf/renderer`'s own isolated `StyleSheet` with white backgrounds and are intentionally unaffected, so printed output is identical in either theme.

### Responsive / mobile layout

The UI adapts to phone-sized screens at a single breakpoint of **600px** (viewports `≤ 600px` get the mobile layout; wider viewports keep the unchanged desktop layout). Because every component styles itself with inline `React.CSSProperties` objects rather than CSS classes, CSS `@media` queries can't override those inline styles — so the breakpoint is read in JavaScript via `src/lib/useIsMobile.ts`. That module exposes the `useIsMobile()` hook (backed by `window.matchMedia`, updates live on resize), the `MOBILE_BREAKPOINT` constant, and a pure `isMobileWidth(width)` helper that is unit-tested in `useIsMobile.test.ts`.

Components call `useIsMobile()` and spread a small mobile-only style override into their existing style object. The notable adaptations:

- **Header** (`src/components/Header.tsx`) — on mobile the language dropdown, theme toggle, user info, and sign-out collapse behind a **hamburger button** that opens a dropdown panel (closes on outside click / sign-out). The desktop header markup is unchanged.
- **Login** — card padding is reduced so it fits a narrow screen.
- **Competition picker** — the card grid drops to a single column.
- **Generate** — the stats grid goes from five columns to two, with a smaller value font.
- **Settings** — the custom-event "format" and "cutoff / time-limit" rows stack vertically.

### "About this tool" dialog

`src/components/AboutDialog.tsx` is a self-contained explainer (trigger + modal) that tells newcomers what the tool is, what the **WCIF** is, and where this tool sits in the workflow — it is the *final* step, turning a competition's already-assigned groups into print-ready, cuttable PDFs. It renders either a circular ℹ icon button (default) or a text link (`as="text"`). It is placed on the **login page** (text link under the sign-in button) and the **competition picker page** (icon next to the heading). All copy lives under the `about.*` i18n keys.

### "No groups assigned" warning

When a competition's groups have not been generated yet, scorecard counts read 0, which confused early users. The parser now exposes `parsed.hasGroups` (true once the schedule contains group child-activities). `src/components/WarningBanner.tsx` (amber notice, matching the login setup warning) surfaces the `warnings.no_groups` message on both the Settings and Generate pages, explaining that groups must be assigned upstream (Groupifier / the WCA website) first, while the schedule tracker and name tags can still be generated.

### Page-count estimate

The Generate-page stats include an **estimated total number of printed pages** so organizers can gauge the real print volume before downloading. `src/lib/pageEstimate.ts` (`estimateTotalPages`) computes it from the scope-filtered parse: exact for scorecards and name tags (both four-per-page — the per-page constants live in `src/pdf/layoutConstants.ts` and are shared with the PDF documents so they cannot drift), one page for the schedule tracker, and a greedy height-based estimate for first-timer slips (which auto-flow). The estimator is pure and deliberately free of any `@react-pdf` import so it stays out of the main bundle.

---

## Settings reference

| Field | Type | Description |
|---|---|---|
| `language` | `en \| fr \| bilingual-en \| bilingual-fr` | Scorecard language |
| `paperFormat` | `A4 \| LETTER` | Page size for all PDFs |
| `secondRoundMode` | `prefilled \| blanks` | How intermediate-round scorecards are printed |
| `logoDataUrl` | `string \| null` | Base64 data URL of a custom competition logo. When set, takes precedence over `useDefaultLogo` |
| `useDefaultLogo` | `boolean` | If `true` and no custom logo is uploaded, the bundled Speedcubing Canada logo (`src/assets/SC_Logo.png`) is rendered next to the competition name. Defaults to `true`; disable for competitions outside Canada |
| `wcaLiveId` | `string \| null` | Numeric WCA Live competition ID (e.g. `9667`). Auto-detected from the WCA Live API on the Settings page; can be overridden manually. Used to generate per-competitor WCA Live QR codes on name tags |
| `wcaLivePersonIds` | `Record<number, string> \| null` | Map of `registrantId → WCA Live internal person ID`, fetched automatically after `wcaLiveId` is resolved. The WCA Live person ID differs from the WCA website user ID and is required for correct competitor QR code URLs |
| `hideWcaLiveId` | `boolean` | When `true`, suppresses the `WCA Live: …` line on scorecard headers. Useful when generating blank scorecards where no competitor ID has been assigned yet. Defaults to `false` |
| `nametagLogoMode` | `hidden \| with-name \| logo-only` | How the logo appears on name tags (see Name tag section) |
| `nametagQrMode` | `back-only \| both-sides` | Which panels get QR codes (see Name tag section) |
| `nametagLayout` | `vertical \| horizontal` | Card orientation: `vertical` (default) uses a landscape page 4×2 grid with portrait cards; `horizontal` uses a portrait page 2×4 grid with landscape cards sized for 90×55 mm badge holders |
| `customEvents` | `CustomEvent[]` | Zero or more custom/bonus events (see Advanced section) |
| `scrambleDoubleCheck` | `boolean` | Enables the optional second scrambler-signature column (see Scramble double-checking) |
| `scrambleDoubleCheckRounds` | `DoubleCheckRound[]` | Which round categories get the column: `firstRound \| intermediate \| semis \| finals`. Defaults to `['finals']` |
| `scrambleDoubleCheckOverrides` | `Record<string, string[]>` | Map of `WCA ID → event IDs` that are always double-checked for that competitor, in every round (named cards only) |

---

## Scramble double-checking

For major championships, scrambles are often double-checked: a second scrambler
independently confirms the scramble and signs for it. When enabled, scorecards gain a
second scrambler-signature column (header "Check") immediately to the right of the
existing **Scrambler** column. Its 13% width is taken entirely from the result column
(52% → 39%); the card's outer size, the other columns, and the 4-up cut lines are
unchanged, so a double-check card and a normal card can sit on the same sheet.

A scorecard gets the column when **either**:

1. **Round rule** — its round category is selected in `scrambleDoubleCheckRounds`
   (default: Finals only). The four categories map 1:1 to the generated PDFs
   (`round1` / `round2` / `semis` / `finals`). A single-round event's only round is
   treated as a final, so selecting "Finals" also covers it.
2. **Per-competitor override** — the competitor's WCA ID + event appears in the uploaded
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

Each download is a ZIP containing one PDF per round stage plus a name-tag PDF if the competition has nametag data. Most competitions produce 2–3 PDFs; a competition with 4-round events (e.g., a large 3×3×3) produces 4 scorecard PDFs.

| File | Contents |
|---|---|
| `{id}_round1.pdf` | Named scorecards for every competitor assigned to round 1, plus one cover card per group |
| `{id}_round2.pdf` | Round 2 of events with 3 or more rounds; named when groups are assigned in the WCIF, otherwise prefilled or blank depending on the setting |
| `{id}_semis.pdf` | Round 3 of events with 4 rounds (semi-finals); named when groups are assigned, otherwise blank |
| `{id}_finals.pdf` | Final round of every multi-round event; named when groups are assigned, otherwise blank scorecards |
| `{id}_extras.pdf` | One blank spare scorecard per round per event (sorted by schedule order) |
| `{id}_schedule.pdf` | Schedule tracker table: estimated start/end times with blank columns for actual times and competitor count |
| `{id}_nametags.pdf` | Sheet of competitor name tags — portrait (2×4 grid) for horizontal layout, landscape (4×2 grid) for vertical layout; omitted if no nametag data is available |
| `{id}_first_timers.pdf` | Confirmation slips for newcomers (competitors with no WCA ID); only when enabled in Advanced settings, omitted if there are none |
| `{id}_custom_{name}.pdf` | 4 blank scorecards for a custom/bonus event (one file per custom event added in Advanced settings) |

A PDF is omitted from the ZIP if it would be empty (e.g., all events have only one round → no finals PDF). 2-round events skip straight from round 1 to finals; they never produce a round2 or semis PDF.

---

## Scorecard PDF

### Intermediate round modes

Controlled by the `secondRoundMode` setting:

- **Prefilled** — N cover cards (one per group) followed by all round-1 participants with a blank group placeholder (`Group _ of N`). Staff sorts the advancing competitors into groups manually and pulls their cards from the stack.
- **Blanks** — fully blank scorecards per group, same as finals.

These two modes only apply to a round that has **not** been assigned yet — see below.

### Mid-competition generation (live group assignments)

Scorecards are normally generated before a competition, when the WCIF only contains
competitor group assignments for Round 1. During the competition the organizer typically
assigns groups for the next round in their grouping tool and re-exports the WCIF. When the
parser finds real `competitor` assignments for a round ≥ 2, it produces **named** scorecards
with the actual group for that round (routed to the matching `intermediate` / `semis` /
`finals` PDF), instead of the prefilled/blank output described above. The blank/prefilled
fallback is still used for any round that has not been assigned.

Detection happens **up front** on `RoundScopePage` (right after picking the competition), not
at download time. When at least one later round has real assignments, that page asks a
**scope** question:

- **Latest round only** *(default)* — print only the most recent round that has groups. Best
  during a competition (you don't reprint earlier rounds).
- **Everything** — print all rounds (plus name tags, schedule, etc.), using assigned groups
  where available.
- **Select rounds** — pick individual event + round combinations.

The scoped modes (`latest` / `selected`) emit scorecard PDFs only — name tags, the schedule
tracker, and extras are pre-competition artifacts and are skipped, and the Settings page hides
those sections accordingly. When no later round has assignments (the normal pre-competition
WCIF) there is no prompt, the page auto-advances to Settings, and output is unchanged.

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

For bilingual languages, both `resultPrefix` and the result suffix have two lines (one per language). Concatenating them naively produces four lines in the narrow result column header. Instead, the two strings are split on `\n` and interleaved: line 1 of the prefix + space + line 1 of the suffix, then line 2 of the prefix + space + line 2 of the suffix. This keeps the header to exactly two lines.

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
| set | — | `custom` | Uploaded logo alone in an 80 pt cell; competition name is **not printed** on the card |
| `null` | `true` (default) | `default` | Competition name text + bundled Speedcubing Canada logo side by side in an 80 pt cell |
| `null` | `false` | `none` | Competition name only, printed vertically in a narrow 26 pt cell on the left |

The `default` state is intended as the standard for Canadian competitions; competitions outside Canada toggle `useDefaultLogo` off to fall back to the legacy `none` layout.

---

## Name tag PDF

### Physical layout

The two layouts use **different page orientations and card sizes**; both produce 8 panels (4 front/back pairs) per page.

**Vertical layout** (`nametagLayout: 'vertical'`, default) — landscape page, 4-column × 2-row grid:

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

**Horizontal layout** (`nametagLayout: 'horizontal'`) — portrait page, 2-column × 4-row grid. Each row holds one person's front and back side-by-side:

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

Cards are sized to fit **90 × 55 mm badge holders** (the same holder as vertical, rotated sideways) with ~2 mm clearance per edge. Both paper formats use the same card size since it is holder-dictated, not paper-dictated. No rotation is applied — cards are rendered as landscape and slot directly into the portrait grid. Cut horizontally between rows and vertically down the centre; each row pair is then inserted into the badge holder front-and-back.

In horizontal mode the top section is compressed (≈ 58 pt vs 127–146 pt) and the WCA ID is shown only on the back panel to fit the shorter (147 pt) card height.

### Panel contents

Every panel (front and back) starts with the same top section:

- **Logo or competition name** — controlled by `nametagLogoMode` (see below)
- **Competitor name** — auto-sized to fill available width (see formula below)
- **Role badge** — DÉLÉGUÉ / COMPÉTITEUR / COMPÉTITRICE / NOUVEAU COMPÉTITEUR / etc. (or English equivalents on the back panel), coloured by role. The badge is pinned at a fixed vertical position within the top section so it appears at the same height regardless of name length
- **Event icons** — one icon per registered event
- **WCA ID** — or a blank placeholder for first-timers

**Front panel** (French title) — duty assignments grouped by role:
- `Concourir:` — events and groups the competitor competes in
- `Mélanger:` — scrambling assignments
- `Juger:` — judging assignments
- `Courir:` — running assignments

**Back panel** (English title) — two QR codes side by side:
- **competitiongroups.com** — links to the competitor's personal schedule using their `registrantId`
- **WCA Live** — links to the competitor's live results page using the WCA Live internal person ID (looked up via `wcaLivePersonIds[registrantId]`); falls back to the WCA Live homepage if the mapping is unavailable

### QR code modes (`nametagQrMode`)

| Value | Front panel | Back panel |
|---|---|---|
| `back-only` (default) | Duty assignments | QR codes |
| `both-sides` | QR codes (French title) | QR codes (English title) |

`both-sides` is useful when the logo takes enough space that assignments become hard to read, or when the organiser simply prefers QR codes on both sides.

### Logo modes (`nametagLogoMode`)

Available whenever a logo will be rendered — either a custom upload or the bundled Speedcubing Canada default (when `useDefaultLogo` is true). Has no effect when both sources are unavailable.

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

`{id}_first_timers.pdf` is **opt-in**: enable *Print first-timer slips* in Advanced settings (off by default — most delegates don't need it). When on, it prints one confirmation slip per **newcomer** — an accepted competitor with no WCA ID. The delegate cuts the slips apart and uses each one to confirm the competitor's personal details (so their results can be linked to a freshly-created WCA profile). The component is `src/pdf/FirstTimerSlipDocument.tsx`.

The slip follows the hand-made original (`original-output/… First-Timer Slips.pdf`): a flowing, vertically-stacked checklist with no borders or cut lines (slips are separated by whitespace and cut apart). Each slip is rendered `wrap={false}` so it is never split across a page. Layout: left margin 36pt, top 38pt, 11pt Helvetica, fixed 14pt line pitch, bold values, and a small bordered square as the tick box (standard PDF Helvetica has no ☐ glyph). The vertical spacing is tightened relative to the original so that **three large slips (4–5 events) reliably fit one page** (the original wasted paper, dropping to two big slips per page); slips flow and pack, so short single-event slips fit four per page.

Each slip lists, in order:

1. The "please check the boxes / let us know if anything is incorrect" intro.
2. *This is my first WCA competition* · *My preferred name is …* · *My gender identity is …*
3. *My birthdate is …* — **only when the WCIF exposes the birthdate** (see below).
4. *I hold citizenship in …* (country name localized from `countryIso2`).
5. *I have permission from a parent/guardian/caregiver to compete* — **only for a minor** (birthdate present and age < 18).
6. The registered events — a single *I can solve the …* line, or an *I can solve all these puzzles/events:* header followed by one bulleted line per event.

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
  // Rounds (≥ 2) that already have real competitor group assignments — empty for a
  // standard pre-competition WCIF. Drives the generation-scope prompt.
  laterRoundsWithAssignments: { eventId: string; roundNum: number }[];
}
```

Every `ScorecardData` entry also carries a `roundNum` (1-based; `0` for custom events) so the generation-scope filter can select cards by event + round.

### What is skipped

- **FMC (`333fm`)** — no scorecard format exists for this event; it is silently ignored throughout.
- **Multi-Blind (`333mbf`)** — treated specially: always `bo2` format (2 attempts), result cell shows "X out of X / Time / ___" template. Named assignments are skipped (delegates handle MBF manually).
- **Persons** with `registration.status !== 'accepted'` are ignored.

### Round categorisation

```
firstRound   — roundNum === 1 for any event
intermediate — roundNum in [2, N-1] AND event has N >= 3 rounds total
semis        — roundNum === N-1 AND event has N >= 4 rounds total
finals       — roundNum === N AND N >= 2 (i.e., the event has more than one round)
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
| `2` (best-of-2) | — | `bo2` (2 rows) |

**Override: blind events.** `444bf` and `555bf` are always forced to `mo3` / `bo1-mo3` (3 attempts) regardless of what the WCIF says for `round.format`. This is because the WCIF sometimes reports these as `2` but the WCA regulations require a mean-of-3 attempt structure.

**Override: Multi-Blind.** `333mbf` is always `bo2` (2 attempts). The result cell content ("`___ out of ___`") is driven by `eventId === '333mbf'`, not by the format code, because 6×6 and 7×7 also use `bo2` and must not show the MBF template.

**Note on 3×3 Blindfolded.** `333bf` uses `avg5` format as of 2026 and is treated as a standard event. It is not in the blind-events override set.

### Timeslot ordering

The parser assigns each child activity a short timeslot key (e.g., `A01`, `B03`) derived from the activity's start time and room name. These keys are used as the primary sort key for all three output buckets, ensuring scorecards print in schedule order. Multiple rooms active at the same time get different stage prefixes (first letter of the room name) but the same numeric slot.

### Group labels

Group labels are built from the activity code's group number and the room/stage name. If the stage name matches a room name prefix, it is replaced with `"Group"`. Falls back to `"Group {N}"` if the heuristic does not match. Labels are translated to French for `fr` / `bilingual-fr` languages (`Groupe X de Y`).

For finals with a single group, seat numbers replace group labels: `Seat 01`, `Seat 02`, … (or `Siège 01`, `Siège 02`, … in French). This is detected when `numGroups[rid] === 1`.

### Advancement condition and blank count

When the previous round has `advancementCondition.type === 'ranking'`, the number of blank scorecards per group in finals/intermediate is `ceil(level / totalGroups) + 2` (a small buffer above the exact cut). Otherwise 16 blanks are printed per group.

### New competitors

Persons without a `wcaId` get a placeholder. In French the placeholder is gendered: `Nouvelle Compétitrice` for female competitors, `Nouveau Compétiteur` for male/other.

### Nametag entries (`NametTagEntry`)

Each accepted person produces one `NametTagEntry`. The `buildDuties` function converts WCIF assignment codes (e.g., `competitor`, `staff-scrambler`, `staff-judge`, `staff-runner`) into human-readable duty strings of the form `"EventName: Group label"`. Duties are grouped into four arrays (`compete`, `scramble`, `judge`, `run`) and sorted alphabetically within each group.

Entries are sorted in this order: **Delegates → Organizers → Returning competitors → New competitors** (persons without a WCA ID), each sub-group alphabetically by name. New competitors are placed at the end so their nametags can be separated at check-in for first-timer orientation.

The `registrantId` field is the sequential person ID used by competitiongroups.com and as the key into `wcaLivePersonIds` to resolve the WCA Live competitor URL. `wcaUserId` is the WCA website account ID. These are different numbers and must not be confused — WCA Live uses its own internal person IDs (neither `registrantId` nor `wcaUserId`).

### Extra / spare scorecards (`extras`)

One blank `ScorecardEntry` is generated per round per event (excluding `333fm`, which has no scorecard format). The extra scorecards are sorted by schedule order — using the earliest child-activity start time for each round as the sort key, then by event ID as a tiebreaker. The list is padded to a multiple of 4 (with empty cover placeholders) but is **not** quadrant-reordered: extras are handled as a loose stack, not a cut-and-stack bundle.

Group labels follow the same rules as regular scorecards: single-group rounds use `"Group 1 of 1"` and multi-group rounds use `"Group _ of N"` (a blank placeholder indicating the group number is to be written in by hand). FMC is excluded because no printed scorecard format exists for it.

### Schedule tracker (`scheduleDays`)

The schedule tracker is built in **day-primary, chronological order**: the output is a list of `ScheduleDay` objects, each representing one calendar date. Each day contains a list of `ScheduleStage` objects (one per room that has events on that day), and each stage holds `ScheduleRow` entries sorted by start time.

Day labels (`"Day 1 — Monday"`, `"Day 2 — Tuesday"`, …) are computed from a global date→day-number map built across all rooms, so "Day 1" always refers to the earliest calendar date in the entire competition regardless of which room's activities you're looking at.

Times are formatted in the venue's local timezone (from `wcif.schedule.venues[0].timezone`) using `Intl.DateTimeFormat` with `hour12: false`. Event round labels in the schedule tracker always use English event names regardless of the scorecard language setting, since the tracker is a staff document.

`333fm` is **included** in the schedule tracker (staff still need to track it), unlike extras and scorecards where it is excluded.

---

## Custom events (Advanced settings)

The **Advanced** section of the Settings page lets organisers add custom events — side puzzles or bonus events that are not part of the official WCIF schedule. Each custom event produces a separate PDF containing **4 blank scorecards** with the event name pre-filled but group, round, name, and all result fields left blank.

### Scorecard format

Each custom event has three format options:

| UI field | Values | Effect |
|---|---|---|
| Format | Average of 5 (default) / Mean of 3 | Sets the number of attempt rows |
| Cutoff | Empty (no cutoff) / `M:SS` string | Converts the format to `bo2-avg5` or `bo1-mo3` and prints the cutoff line |
| Time limit | Empty (no limit) / `M:SS` string | Printed in the result-column header |

The `ScorecardFormat` derivation mirrors the standard rounds:

| Format radio | Cutoff set? | Resulting `ScorecardFormat` |
|---|---|---|
| Average of 5 | No | `avg5` |
| Average of 5 | Yes | `bo2-avg5` |
| Mean of 3 | No | `mo3` |
| Mean of 3 | Yes | `bo1-mo3` |

### Icon selection

Each custom event can have an icon that appears in the top-left of the scorecard, next to the event name. Two options are available:

- **WCA icon** — select one of the 17 standard WCA event icons shown in the picker grid. Clicking an already-selected icon deselects it.
- **Custom image** — upload any image file; it is stored as a base64 data URL and embedded directly in the PDF.

If no icon is selected, the event-name cell expands to fill the full width (same behaviour as events without icons in the standard scorecard renderer).

### Output

Each custom event is rendered using the same `ScorecardDocument` component as regular scorecards. The output filename is `{competitionId}_custom_{sanitized_name}.pdf`, where `sanitized_name` replaces non-alphanumeric characters with underscores (max 40 chars).

---

## PDF rendering constraints

### Web Worker

All PDF rendering happens inside `src/pdf/scorecardWorker.ts` (a Vite module worker). The worker receives the parsed data over `postMessage` and posts progress events back to the main thread. This prevents the UI from freezing during rendering, which can take several seconds for large competitions.

### `bufferPolyfill.ts` must be the first import

`@react-pdf/renderer` and its dependencies (`pdfkit`, `fontkit`) use Node.js `Buffer` and call DOM APIs (`document.createElement`, `window`, etc.) at module initialisation time — before any user code runs. The polyfill file sets `globalThis.Buffer`, `globalThis.window`, and a stub `globalThis.document` before any other module loads. If it is not the first import in the worker, react-pdf crashes with errors like `Buffer is not defined` or `document.querySelector is not a function`.

### PNG decoding synchronous override

`png-js` (used internally by pdfkit for PNG images) calls `fflate.unzlib` asynchronously, which internally spawns a **nested Web Worker**. Nested workers in a worker context do not reliably deliver messages back to the outer worker — the PDF stream never emits `end` and rendering hangs indefinitely. The polyfill patches `PNG.prototype.decodePixels` to use `fflate.unzlibSync` instead, making PNG decoding synchronous. The patch must run before `@react-pdf/renderer` imports `png-js`, which is guaranteed because `bufferPolyfill.ts` is the first import.

### ZIP compression level

`fflate.zipSync` is called with `{ level: 0 }` (store, no compression). PDF files are already compressed internally; re-compressing them adds CPU time and produces no meaningful size reduction.

### Hyphenation disabled

`Font.registerHyphenationCallback((word) => [word])` tells react-pdf never to hyphenate any word. Without this, react-pdf hyphenates long names mid-word, which looks wrong on scorecards and name tags.

---

## Language support

The printed-output language is chosen on the SettingsPage as a **mandatory primary language** plus an **optional second language**, in any combination — not a fixed list of presets. Both selectors are driven by the shared `LANGUAGES` registry (`src/i18n/index.ts`), and the per-language strings live in the `LOCALES` table in `src/lib/i18n.ts`.

| Setting | Effect |
|---|---|
| `language` | Primary language (mandatory). Currently one of `en`, `fr`, `es`, `pt`. Defaults to the current interface language (falling back to the first supported language). |
| `secondaryLanguage` | Optional second language (`null` = single-language output). Defaults to `null`. |

In the SettingsPage UI the two rows of language tiles share the same fixed columns (one language per column). The secondary row mirrors the primary row, except the column under the currently-selected primary becomes the **None** tile — so the columns never shift when the primary changes, and each column always represents exactly one language. This selector logic lives in `src/lib/languageSelector.ts` (`resolveDefaultPrimaryLanguage`, `secondaryLanguageRow`).

**Adding a language** is a one-entry-per-store change: add a string bundle to `LOCALES` in `src/lib/i18n.ts`, and add a `LANGUAGES` entry + UI translation JSON (registered in `resources`/`supportedLngs`) in `src/i18n/index.ts`. No getter, merge, or settings-form code needs touching.

When a second language is set, scorecard column headers and the result header each contain both languages separated by a newline (primary first), and the cut-off and provisional lines are likewise bilingual. Event names, group labels, round labels, seat/station labels and the cover card always use the **primary** language only. The schedule tracker and name-tag duty labels also use the primary language only.

Name tag role badges use the primary language on the **front** panel and the secondary language on the **back** panel (falling back to the primary when no second language is set). For example, primary `fr` + secondary `en` reproduces the previous default: French titles on front, English on back.

> The retired `bilingual-fr` / `bilingual-en` presets map onto this model as primary `fr` + secondary `en` and primary `en` + secondary `fr` respectively; `GeneratePage` migrates any persisted legacy value automatically.

---

## Planned features

- **Horizontal nametags** - Using the files in Sarah-scorecard/Nametags (Horizontal, English Only) to add an option to have different nametags orientations

---

## Project structure

```
src/
  auth/
    pkce.ts               — PKCE code verifier / challenge generation
    wca.ts                — OAuth endpoints, token exchange, WCA API helpers
    AuthContext.tsx        — React context: token + user, persisted in sessionStorage
  lib/
    wcif-parser.ts         — WCIF → ParsedWCIF (scorecards + nametags)
    i18n.ts                — All UI strings and event names for EN / FR / bilingual modes
  pages/
    LoginPage.tsx
    AuthCallbackPage.tsx
    CompetitionPickerPage.tsx
    SettingsPage.tsx
    GeneratePage.tsx       — Fetches WCIF, drives the worker, renders download button
  pdf/
    bufferPolyfill.ts      — MUST be first import in worker; patches Buffer, window, document, PNG
    ScorecardDocument.tsx  — react-pdf component: scorecard cards + cover cards + document shell
    NametTagDocument.tsx   — react-pdf component: name tag panels with QR codes and duty assignments
    scorecardWorker.ts     — Web Worker: renders all PDFs sequentially, zips them, posts result
  types/
    settings.ts            — CompetitionSettings interface (language, paper, logo, nametag modes)
    wcif.ts                — WCIF type definitions
  assets/
    events/                — PNG event icons (one colour + one grey per WCA event ID)
    events.ts              — Maps event IDs to their icon data URLs (Vite ?inline imports)
    SC_Logo.png            — Bundled Speedcubing Canada logo (black & white)
    scc-logo.ts            — Re-exports SC_Logo.png as a data URL for the PDF worker
  lib/
    logo.ts                — Resolves which logo to render: custom upload, SCC default, or none
generate-nametags.mjs      — Dev-only Node.js script to render a local name-tag PDF without a browser
```
