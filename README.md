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

The production build is a static SPA that can be served from any CDN or static host, but it requires one server-side endpoint: **`POST /wca-token`**. This endpoint must:

1. Accept the same `application/x-www-form-urlencoded` body the browser sends.
2. Append `client_secret` from a server-side environment variable.
3. Forward the request to `https://www.worldcubeassociation.org/oauth/token`.
4. Return the response verbatim.

In development, `vite.config.ts` provides this endpoint as a Vite dev-server middleware. In production you need a real server-side proxy (a serverless function, nginx `proxy_pass`, etc.). The WCA token endpoint has no CORS headers, which is why the browser cannot call it directly even without the secret concern.

---

## Application flow

```
LoginPage → CompetitionPickerPage → SettingsPage → GeneratePage (download)
```

- **LoginPage** — initiates WCA OAuth PKCE; stores the code verifier in `sessionStorage`.
- **AuthCallbackPage** — exchanges the code for a token; stores the token in `sessionStorage`.
- **CompetitionPickerPage** — lists competitions managed by the logged-in user (WCA API `?managed_by_me=true`).
- **SettingsPage** — collects paper format, language, logo, WCA Live ID, and nametag layout options; stores settings in `sessionStorage`.
- **GeneratePage** — fetches the WCIF, parses it, and renders the download button. PDF rendering runs inside a Web Worker to keep the UI responsive.

Settings and auth state live in `sessionStorage` only — they are cleared when the tab is closed and are never sent to any server.

---

## Settings reference

| Field | Type | Description |
|---|---|---|
| `language` | `en \| fr \| bilingual-en \| bilingual-fr` | Scorecard language |
| `paperFormat` | `A4 \| LETTER` | Page size for all PDFs |
| `secondRoundMode` | `prefilled \| blanks` | How intermediate-round scorecards are printed |
| `logoDataUrl` | `string \| null` | Base64 data URL of the competition logo, used on scorecards and optionally on name tags |
| `wcaLiveId` | `string \| null` | Numeric WCA Live competition ID (e.g. `9667`) used to generate per-competitor WCA Live QR codes on name tag backs |
| `nametagLogoMode` | `hidden \| with-name \| logo-only` | How the logo appears on name tags (see Name tag section) |
| `nametagQrMode` | `back-only \| both-sides` | Which panels get QR codes (see Name tag section) |

---

## PDF output structure

Each download is a ZIP containing one PDF per round stage plus a name-tag PDF if the competition has nametag data. Most competitions produce 2–3 PDFs; a competition with 4-round events (e.g., a large 3×3×3) produces 4 scorecard PDFs.

| File | Contents |
|---|---|
| `{id}_round1.pdf` | Named scorecards for every competitor assigned to round 1, plus one cover card per group |
| `{id}_round2.pdf` | Round 2 of events with 3 or more rounds; prefilled or blank depending on the setting |
| `{id}_semis.pdf` | Round 3 of events with 4 rounds (semi-finals); always blank |
| `{id}_finals.pdf` | Final round of every multi-round event; always blank scorecards |
| `{id}_nametags.pdf` | Landscape sheet of competitor name tags (omitted if no nametag data is available) |

A PDF is omitted from the ZIP if it would be empty (e.g., all events have only one round → no finals PDF). 2-round events skip straight from round 1 to finals; they never produce a round2 or semis PDF.

---

## Scorecard PDF

### Intermediate round modes

Controlled by the `secondRoundMode` setting:

- **Prefilled** — N cover cards (one per group) followed by all round-1 participants with a blank group placeholder (`Group _ of N`). Staff sorts the advancing competitors into groups manually and pulls their cards from the stack.
- **Blanks** — fully blank scorecards per group, same as finals.

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

Available width is ~175 pt when a logo is present, ~235 pt when no logo is used.

### Logo vs competition name

If a logo data URL is provided in settings, the logo occupies the left portion of the scorecard header and the competition name is **not printed** anywhere on the scorecard. If no logo is provided, the competition name is printed vertically in a narrow cell on the left. The two are mutually exclusive.

---

## Name tag PDF

### Physical layout

Name tags are printed on landscape pages. Each page holds **4 front/back panel pairs** — 8 panels total in a 4-column × 2-row grid:

```
row 0: [Front_A] [Back_A] [Front_B] [Back_B]
row 1: [Front_C] [Back_C] [Front_D] [Back_D]
```

When cut between column pairs and folded front-to-back, each pair becomes one double-sided name tag.

| Paper | Panel size | Margin | Gap |
|---|---|---|---|
| LETTER | 189 × 292 pt | 12 pt | 4 pt H, 4 pt V |
| A4 | 201 × 283 pt | 12 pt | 4 pt H, 4 pt V |

### Panel contents

Every panel (front and back) starts with the same top section:

- **Logo or competition name** — controlled by `nametagLogoMode` (see below)
- **Competitor name** — auto-sized to fill available width (see formula below)
- **Role badge** — DÉLÉGUÉ / COMPÉTITEUR / COMPÉTITRICE / NOUVEAU COMPÉTITEUR / etc. (or English equivalents on the back panel), coloured by role
- **Event icons** — one icon per registered event
- **WCA ID** — or a blank placeholder for first-timers

**Front panel** (French title) — duty assignments grouped by role:
- `Concourir:` — events and groups the competitor competes in
- `Mélanger:` — scrambling assignments
- `Juger:` — judging assignments
- `Courir:` — running assignments

**Back panel** (English title) — two QR codes side by side:
- **competitiongroups.com** — links to the competitor's personal schedule using their registrant ID
- **WCA Live** — links to the competitor's live results page if a WCA Live ID is configured; falls back to the WCA Live homepage otherwise

### QR code modes (`nametagQrMode`)

| Value | Front panel | Back panel |
|---|---|---|
| `back-only` (default) | Duty assignments | QR codes |
| `both-sides` | QR codes (French title) | QR codes (English title) |

`both-sides` is useful when the logo takes enough space that assignments become hard to read, or when the organiser simply prefers QR codes on both sides.

### Logo modes (`nametagLogoMode`)

Only available when a logo has been uploaded. Has no effect otherwise.

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
node generate-nametags.mjs
```

Output is written to `../current-output/`.

---

## WCIF parsing

The parser (`src/lib/wcif-parser.ts`) reads the competition's WCIF (WCA Interchange Format) JSON and produces a `ParsedWCIF` object with four buckets:

```ts
interface ParsedWCIF {
  firstRound:   ScorecardData[];
  intermediate: ScorecardData[];
  semis:        ScorecardData[];
  finals:       ScorecardData[];
  nametags:     NametTagEntry[];
}
```

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

The `registrantId` field is the sequential person ID used by competitiongroups.com; `wcaUserId` is the WCA user account ID used by WCA Live. These two IDs are kept separate because they appear in different QR code URLs.

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

| Code | Description |
|---|---|
| `en` | English only |
| `fr` | French only |
| `bilingual-en` | English primary, French secondary (EN on top) |
| `bilingual-fr` | French primary, English secondary (FR on top) |

In bilingual mode, column headers and the result header each contain both languages separated by a newline. The cut-off line and provisional line are also bilingual. Event names and group labels use the primary language only.

Name tag role badges always use the panel language: French titles on front panels, English titles on back panels, regardless of the scorecard language setting.

---

## Planned features

- **First-timer slips** — a small slip printed for competitors who have no WCA ID, given to the delegate to attach to their scorecard after the first solve. Lists the competitor's name and registrant ID so their results can be linked to a new WCA profile.

- **Extra / spare scorecards** — a set of blank scorecards not tied to any specific group, used when a competitor shows up without their assigned card or needs a replacement.

- **Mystery event scorecards** — scorecards for an unannounced bonus event revealed on the day, whose event ID is not in the WCIF at generation time.

- **Schedule tracker** — a one-page grid showing all events and rounds across all days and rooms, used by staff to track which groups have been scrambled, competed, and entered.

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
generate-nametags.mjs      — Dev-only Node.js script to render a local name-tag PDF without a browser
```
