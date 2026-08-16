<h1 align="center">WCA Scorecard Generator</h1>

<p align="center">
  Print-ready scorecards, name tags and staff sheets for WCA competitions, generated in the browser.
</p>

<p align="center">
  <a href="https://scorecards.speedcubingcanada.org/"><img alt="Live app" src="https://img.shields.io/badge/live-scorecards.speedcubingcanada.org-2563eb"></a>
  <a href="https://github.com/Speedcubing-Canada/scorecards-v2/actions/workflows/deploy.yml"><img alt="CI" src="https://github.com/Speedcubing-Canada/scorecards-v2/actions/workflows/deploy.yml/badge.svg"></a>
  <a href="https://deepwiki.com/Speedcubing-Canada/scorecards-v2"><img alt="Ask DeepWiki" src="https://deepwiki.com/badge.svg"></a>
</p>

Delegates and organizers sign in with their WCA account, pick a competition they manage, choose
what to print, and download the PDFs. Everything runs client-side: the WCIF never leaves the
browser, and there is no database.

---

## What it generates

| File | Contents |
|---|---|
| `{id}_round1.pdf` | Named scorecards for round 1, plus delegate/scoretaker cover cards |
| `{id}_round2.pdf` | Round 2 of events with 3+ rounds; named, prefilled or blank |
| `{id}_semis.pdf` | Round 3 of events with 4 rounds |
| `{id}_finals.pdf` | Final round of every multi-round event |
| `{id}_extras.pdf` | One blank spare scorecard per round per event |
| `{id}_checklist.pdf` | Round Checklist: one table per day tracking each round's data flow |
| `{id}_schedule.pdf` | Schedule tracker: estimated times, blank columns for actuals |
| `{id}_nametags.pdf` | Competitor name tags with duty assignments and QR codes |
| `{id}_first_timers.pdf` | Confirmation slips for competitors with no WCA ID |
| `{id}_custom_{name}.pdf` | One file per custom/bonus event |

Empty documents are omitted. Two or more files download as `{id}_pdfs.zip`; a single file
downloads on its own so it can be printed straight away.

## Quick start

```bash
npm install
npm run dev
```

`.env` at the project root:

```
VITE_WCA_CLIENT_ID=your_wca_oauth_client_id
WCA_CLIENT_SECRET=your_wca_oauth_client_secret
VITE_WCA_REDIRECT_URI=http://localhost:5173/auth/callback   # optional, defaults to origin/auth/callback
```

Only the client ID is bundled. The secret stays server-side: both the Vite dev server and
`server.js` expose one endpoint, `POST /wca-token`, that appends the secret and forwards to the
WCA token endpoint (which sends no CORS headers, so the browser cannot call it directly anyway).

| Command | |
|---|---|
| `npm test` | Vitest, ~5s, no network and no PDF rendering |
| `npm run lint` | ESLint |
| `npx tsc -b` | Typecheck (also the first half of `npm run build`) |
| `npm run render:fixtures` | Render every PDF headlessly to `../current-output/` |

The first three run in CI on every PR and every push to `main`.

## How it works

```
LoginPage → CompetitionPickerPage → RoundScopePage → SettingsPage → GeneratePage (download)
                   └→ CustomCompetitionPage ──────────────↑   (custom competitions skip /scope)
```

- Auth and settings live in `sessionStorage` only, cleared when the tab closes, never sent anywhere.
- PDF rendering runs in a Web Worker (`src/pdf/scorecardWorker.ts`) so the UI stays responsive.
- `/scope` picks which documents and which rounds to generate; regional presets there seed
  defaults for a province, and everything stays editable afterwards.
- Scorecards come out in **cut-and-stack order**: print, cut each sheet into 4, keep the four
  positions separated, stack them in order, and the deck is already sorted. The download page
  spells this out per document.

## Gotchas

Non-obvious constraints that look arbitrary in the code but break real output if undone:

- **`bufferPolyfill.ts` must be the first import in the worker.** react-pdf touches `Buffer`,
  `window` and `document` at module load, and the polyfill also forces PNG decoding synchronous
  (the async path spawns a nested worker that never reports back, hanging the render).
- **Never `wrap={false}` on the Round Checklist day block.** react-pdf squashes an oversized
  non-breaking block instead of paginating it, collapsing every tick box into a sliver.
- **Horizontal name tags are sized to 90×55 mm badge holders**, so A4 and LETTER use the same
  card. Not a per-paper-size number, do not "optimise" it.
- **Never filter scorecard entries after `finalizeEntries`.** It sorts, pads to a multiple of 4
  and quadrant-reorders; removing entries downstream corrupts the printed pile order. Cover
  cards are gated at emission time in `pushCover` for exactly this reason.
- **`gcp-build` is a deliberate no-op.** App Engine's Cloud Build has no `VITE_WCA_CLIENT_ID`;
  rebuilding there ships `client_id=undefined` over the good `dist/`.
- **No test asserts a translated string.** Rewording printed copy must never turn CI red, so the
  guards are structural: key parity across locales, and width sweeps that check a string still
  *fits* its column. A failing sweep means the text is genuinely too long, shorten it.

## Contributing

- **UI work** follows [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md) (Montserrat at 400/500/700,
  lucide-react icons only, CSS-variable tokens); `src/components/design-system.test.ts` enforces
  the hard rules.
- **No em dash in on-screen copy**, in any locale. Use a comma, a colon, or two sentences.
- **Adding a region** is a JSON file drop in `src/presets/` with no code changes, see
  [`src/presets/README.md`](src/presets/README.md).
- **Adding a language** is two entries: a bundle in `LOCALES` (`src/lib/i18n.ts`, printed output)
  and a `LANGUAGES` entry plus UI JSON (`src/i18n/`, interface).
- **User-visible changes** get a bullet in `src/changelog.ts` in all four locales, newest first.
  Returning organizers see it as a "What's new" dialog, so the bar is high: no refactors, bug
  fixes or small tweaks.
- Run `npm run render:fixtures` (and `scripts/checkFixtures.sh <baseline>` to pixel-diff) after
  touching anything under `src/pdf/`. These PDFs get printed and cut, so layout regressions are
  expensive.

## Deploying

Pushing to `main` deploys automatically via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) once the test job passes. One-time
GCP setup lives in [`.github/workflows/README.md`](.github/workflows/README.md). For an emergency
manual deploy: `VITE_WCA_CLIENT_ID=… npm run build && ./deploy.sh`.

## Where things live

| Path | |
|---|---|
| `src/pages/` | One file per wizard step |
| `src/components/` | Shared UI: header, dialogs, tooltip, skeletons, print guide |
| `src/pdf/` | react-pdf documents, shared layout constants, the render worker |
| `src/lib/` | WCIF parsing, generation scope, PDF job list, printed-output strings |
| `src/i18n/` | Interface translations and the language registry |
| `src/presets/` | Regional presets, one JSON per region |
| `src/theme/` | Light/dark theme context |
| `scripts/` | Headless fixture rendering and pixel diffing |

For anything deeper, [ask DeepWiki](https://deepwiki.com/Speedcubing-Canada/scorecards-v2) or read
the file: both track the code, this README does not.
