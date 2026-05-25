# WCA Scorecard Generator v2

A browser-only React app that generates competition scorecards as print-ready PDFs for WCA (World Cube Association) events. Delegates and organizers log in with their WCA account, pick a competition they manage, configure options, and download a ZIP of PDFs — one per round stage.

## Stack

- **React 19 + TypeScript + Vite** — SPA, no backend required for normal use
- **`@react-pdf/renderer` v4 (browser build)** — renders scorecards to PDF entirely in the browser
- **`fflate`** — bundles the per-round PDFs into a single ZIP for download
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
- **SettingsPage** — collects paper format, language, logo, and intermediate-round mode; stores settings in `sessionStorage`.
- **GeneratePage** — fetches the WCIF, parses it, and renders the download button. PDF rendering runs inside a Web Worker to keep the UI responsive.

Settings and auth state live in `sessionStorage` only — they are cleared when the tab is closed and are never sent to any server.

---

## PDF output structure

Each download is a ZIP containing one PDF per round stage. Most competitions produce 2–3 PDFs; a competition with 4-round events (e.g., a large 3x3x3) produces 4.

| File | Contents |
|---|---|
| `{id}_round1.pdf` | Named scorecards for every competitor assigned to round 1, plus one cover card per group |
| `{id}_round2.pdf` | Round 2 of events with 3 or more rounds; prefilled or blank depending on the setting |
| `{id}_semis.pdf` | Round 3 of events with 4 rounds (semi-finals); always blank, same structure as finals |
| `{id}_finals.pdf` | Final round of every multi-round event; always blank scorecards |

A PDF is omitted from the ZIP if it would be empty (e.g., all events have only one round → no finals PDF). 2-round events skip straight from round 1 to finals; they never produce a round2 or semis PDF.

### Intermediate round modes

Controlled by the `secondRoundMode` setting:

- **Prefilled** — N cover cards (one per group) followed by all round-1 participants with a blank group placeholder (`Group _ of N`). Staff sorts the advancing competitors into groups manually and pulls their cards from the stack.
- **Blanks** — fully blank scorecards per group, same as finals.

### Print layout (quad-reorder / cut-and-stack)

Each page holds 4 scorecards. Cards are **not** laid out in reading order. Instead they are interleaved so that after printing, cutting along the centre lines, and stacking the half-sheets on top of each other, each resulting stack is already sorted in the correct order for distribution. This is called a cut-and-stack or quadrant reorder.

Concretely: input position 0 → page 1 top-left, input position 1 → page 2 top-left, input position 2 → page 3 top-left, etc. All "top-left" cards come first, then all "top-right", and so on. The `reorderQuadrants` function in `wcif-parser.ts` implements this mapping.

The number of entries is always padded to a multiple of 4 (with empty cover placeholders) before reordering so that every page is full and the stacking math works out.

---

## WCIF parsing constraints

The parser (`src/lib/wcif-parser.ts`) reads the competition's WCIF (WCA Interchange Format) JSON. Key decisions and non-obvious behaviour:

### What is skipped

- **FMC (`333fm`)** — no scorecard format exists for this event; it is silently ignored throughout.
- **Multi-Blind (`333mbf`)** — treated specially: always `bo2` format (2 attempts), result cell shows "X out of X / Time / ___" template. Named assignments are skipped (delegates handle MBF manually).
- **Persons** with `registration.status !== 'accepted'` are ignored.

### Round categorisation

```
firstRound   — roundNum === 1 for any event
intermediate — roundNum in [2, N-1] AND event has N >= 3 rounds total
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

**Override: Multi-Blind.** `333mbf` is always `bo2` (2 attempts). The result cell content ("`___ out of ___`") is driven by `eventId === '333mbf'`, not by the format code, because 6x6 and 7x7 also use `bo2` and must not show the MBF template.

**Note on 3x3 Blindfolded.** `333bf` uses `avg5` format as of 2026 and is treated as a standard event. It is not in the blind-events override set.

### Timeslot ordering

The parser assigns each child activity a short timeslot key (e.g., `A01`, `B03`) derived from the activity's start time and room name. These keys are used as the primary sort key for all three output buckets, ensuring scorecards print in schedule order. Multiple rooms active at the same time get different stage prefixes (first letter of the room name) but the same numeric slot.

### Group labels

Group labels are built from the activity code's group number and the room/stage name. If the stage name matches a room name prefix, it is replaced with `"Group"`. Falls back to `"Group {N}"` if the heuristic does not match. Labels are translated to French for `fr` / `bilingual-fr` languages (`Groupe X de Y`).

For finals with a single group, seat numbers replace group labels: `Seat 01`, `Seat 02`, … (or `Siège 01`, `Siège 02`, … in French). This is detected when `numGroups[rid] === 1`.

### Advancement condition and blank count

When the previous round has `advancementCondition.type === 'ranking'`, the number of blank scorecards per group in finals/intermediate is `ceil(level / totalGroups) + 2` (a small buffer above the exact cut). Otherwise 16 blanks are printed per group.

### New competitors

Persons without a `wcaId` get a placeholder. In French the placeholder is gendered: `Nouvelle Compétitrice` for female competitors, `Nouveau Compétiteur` for male/other.

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

`Font.registerHyphenationCallback((word) => [word])` tells react-pdf never to hyphenate any word. Without this, react-pdf hyphenates long names mid-word, which looks wrong on scorecards. Line breaking for the result column header is instead controlled by explicit `\n` characters.

---

## Scorecard layout

### Page geometry

Cards preserve the aspect ratio of the original HTML scorecards (561:726 ≈ 0.773). Absolute positioning is used so that cutting guides (gaps between cards) are exact.

| Paper | Card size | Positions (left, top in pt) |
|---|---|---|
| LETTER (612×792 pt) | 282×365 pt | (12,12), (318,12), (12,415), (318,415) |
| A4 (595×842 pt) | 274×354 pt | (12,36), (309,36), (12,452), (309,452) |

### Bilingual result header

For bilingual languages, both `resultPrefix` and the result suffix have two lines (one per language). Concatenating them naively produces four lines in the narrow result column header. Instead, the two strings are split on `\n` and interleaved: line 1 of the prefix + space + line 1 of the suffix, then line 2 of the prefix + space + line 2 of the suffix. This keeps the header to exactly two lines.

### Name font size

The competitor name is auto-scaled to fit on one line inside the name cell. The formula approximates Helvetica-Bold character width as 0.65 pt per pt of font size per character:

```
fontSize = clamp(7, floor(available / (name.length * 0.65)), 18)
```

Available width is ~175 pt when a logo is present (the competition name cell is replaced by the logo cell), ~235 pt when no logo is used.

### Logo vs competition name

If a logo data URL is provided in settings, the logo occupies the left portion of the scorecard header and the competition name is **not printed** anywhere on the scorecard. If no logo is provided, the competition name is printed vertically in a narrow cell on the left. The two are mutually exclusive.

---

## Language support

| Code | Description |
|---|---|
| `en` | English only |
| `fr` | French only |
| `bilingual-en` | English primary, French secondary (EN on top) |
| `bilingual-fr` | French primary, English secondary (FR on top) |

In bilingual mode, column headers and the result header each contain both languages separated by a newline. The cut-off line and provisional line are also bilingual. Event names and group labels use the primary language only.

---

## Planned features

The original manual tool (Sarah-scorecard) produces several documents that are not yet automated here. The goal is to generate all of them from the same WCIF + settings flow:

- **Nametags** — one badge per registered competitor, showing their name, WCA ID, country flag, and the events they are competing in (greyed-out icon for events they registered for but didn't make it into). Vertical layout, bilingual. Currently produced as an HTML file that must be printed manually.

- **First-timer slips** — a small slip printed for competitors who have no WCA ID, given to the delegate to attach to their scorecard after the first solve. Lists the competitor's name and registrant ID so their results can be linked to a new WCA profile.

- **Extra / spare scorecards** — a set of blank scorecards not tied to any specific group, used when a competitor shows up without their assigned card or needs a replacement.

- **Mystery event scorecards** — scorecards for an unannounced bonus event revealed on the day, whose event ID is not in the WCIF at generation time.

- **Schedule tracker** — a one-page grid showing all events and rounds across all days and rooms, used by staff to track which groups have been scrambled, competed, and entered.

## Project structure

```
src/
  auth/
    pkce.ts              — PKCE code verifier / challenge generation
    wca.ts               — OAuth endpoints, token exchange, WCA API helpers
    AuthContext.tsx       — React context: token + user, persisted in sessionStorage
  lib/
    wcif-parser.ts        — WCIF → ParsedWCIF (three buckets: firstRound, intermediate, finals)
    i18n.ts               — All UI strings and event names for EN / FR / bilingual modes
  pages/
    LoginPage.tsx
    AuthCallbackPage.tsx
    CompetitionPickerPage.tsx
    SettingsPage.tsx
    GeneratePage.tsx      — Fetches WCIF, drives the worker, renders download button
  pdf/
    bufferPolyfill.ts     — MUST be first import in worker; patches Buffer, window, document, PNG
    ScorecardDocument.tsx — react-pdf component: scorecard cards + cover cards + document shell
    scorecardWorker.ts    — Web Worker: renders per-round PDFs, zips them, posts result
  types/
    settings.ts           — CompetitionSettings interface
    wcif.ts               — WCIF type definitions
  assets/
    events/               — SVG event icons (one per WCA event ID)
```
