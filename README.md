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
what to print, and download the PDFs. The PDFs are built entirely in the browser: the WCIF is
never uploaded, and there is no database. One anonymous usage event is sent per generation so
we can see which competitions the tool is used on and which settings people pick, see
[Usage analytics](#usage-analytics).

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
| `npm test` | Vitest, no network |
| `npm run test:coverage` | The same run, with coverage and its thresholds enforced |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` (also the first half of `npm run build`) |
| `npm run render:fixtures` | Render every PDF headlessly to `../current-output/` (override with `FIXTURE_OUT_DIR`) |
| `scripts/checkFixtures.sh` | Re-render the fixtures and pixel-diff them against `tests/pdf-baseline/` |
| `scripts/updateFixtureBaseline.sh` | Refresh that baseline, after an intentional PDF change |

Lint, typecheck and `test:coverage` run in CI **once per commit**: on every PR, and on pushes
to `main`. There is no staging environment, so that job is the only thing between a branch and
production. A second job, `pdf-fixtures`, runs the pixel diff alongside it. The PR run tests the
branch merged with `main` rather than the branch head, which is what actually lands. A branch
with no PR open gets no CI - open the PR.

`main` is protected: that job must be green and the branch must be up to date with `main`
before a PR can merge, and force-pushes and deletion are blocked. Admins are not bound by it,
so an emergency fix can still go straight in.

Run `npm run test:coverage`, not `npm test`, before pushing: only the former enforces the
coverage thresholds, so it is the one that matches CI.

### Coverage is a ratchet

`npm run test:coverage` fails if coverage falls below the thresholds committed in
`vitest.config.ts`, and Vitest's `thresholds.autoUpdate` rewrites them **upward** whenever a run
improves on them. So: add tests, commit the raised numbers, and the floor never slips back.
Never lower them by hand. Uncovered files are included on purpose, so the number is the honest
one; only `src/assets`, `src/types`, `src/main.tsx` and the test helpers are excluded.

### Writing tests

Tests run in Node. A test that mounts a page opts into a DOM per file with a
`// @vitest-environment jsdom` docblock and renders through `renderWithProviders`
(`src/test/render.tsx`), which wires the router, the theme and the auth context and stubs
`matchMedia`, which jsdom does not implement. `src/test/fixtures.ts` has `testSettings()` (a
complete `CompetitionSettings`) and `sampleWcif()` (a one-day competition that fills every
bucket `parseWCIF` produces); `scripts/renderFixtures.ts` uses the same settings builder.

Four files cover seams rather than single modules, because the halves either side of each are
tested on their own and the joint is what breaks:

- `src/pages/wizard.integration.test.tsx` drives the real routes (`AppRoutes`) through picker →
  scope → settings → generate, using only the UI. The wizard's steps share no React state, so
  this is what proves they agree about the same competition. `flowState.test.ts` still owns the
  sessionStorage layer, and each page test still owns its own rendering.
- `src/pdf/render.integration.test.ts` renders every job kind `buildPdfJobs` can emit through the
  real documents with `renderToBuffer`. It asserts only that a valid PDF comes out, never layout:
  the `*-layout.test.ts` files own the measurements, and `scripts/checkFixtures.sh` owns the pixels.
- `src/pdf/renderBundle.test.ts` covers the orchestration around that - which jobs run, bare PDF
  versus zip, progress, what happens when one document throws - with the renderer stubbed, so it
  does not re-render what the file above already renders.
- `server.test.js` starts the real express app on an ephemeral port and asserts the things that
  live in headers and status codes: the CSP directives, and `/api/event` answering 204 to
  everything so a prober learns nothing.

### PDF output regression

`scripts/checkFixtures.sh` re-renders the fixture PDFs and pixel-diffs each page against
`tests/pdf-baseline/`, catching what the measurement tests cannot see: a changed colour, a
shifted margin, a dropped glyph. It needs `poppler-utils` and `graphicsmagick`. Every input it
uses lives in the repo (`tests/fixtures/`, `tests/pdf-baseline/`), so a fresh checkout can run
it.

It passes below a max page MAE of `0.002` (override with `FIXTURE_MAE_TOLERANCE`) rather than
demanding pixel identity, because the CI runner's poppler and font stack are not the ones a
baseline was rendered on. For scale, a 1pt padding change measures about `0.02`. The CI job runs
`continue-on-error` until that tolerance has proved itself across a few PRs; promote it to a
required check by dropping that line and adding it to `deploy.needs`.

When it fails, look at the red-highlighted diff images it points at (CI uploads them as the
`pdf-fixture-diff` artifact). If the change was intended, run `scripts/updateFixtureBaseline.sh`
and commit the new baseline - never refresh it without opening the diffs first.

## How it works

```
LoginPage → CompetitionPickerPage → RoundScopePage → SettingsPage → GeneratePage (download)
                   └→ CustomCompetitionPage ──────────────↑   (custom competitions skip /scope)
```

- Auth and settings live in `sessionStorage` only, cleared when the tab closes, never sent anywhere.
- Going back re-opens a step with the choices already made on it (`src/lib/flowState.ts`), so
  nothing is retyped; picking a different competition resets them. `/settings` goes back to
  `/scope`, or to `/custom` for a custom competition.
- One anonymous event per sign-in, generation, and failure goes to `POST /api/event` (see below).
- PDF rendering runs in a Web Worker (`src/pdf/scorecardWorker.ts`) so the UI stays responsive.
- `/scope` picks which documents and which rounds to generate; regional presets there seed
  defaults for a province, and everything stays editable afterwards.
- **Live results** exist in two flavours, and name tag QR codes point at whichever the
  competition runs on. `/settings` preselects it from the competition's `scoretaking_software`
  field (`internal` means ILR, the WCA's integrated live results) and lets the organizer
  override. WCA Live needs a numeric competition ID and a person-ID map fetched off its GraphQL
  API; ILR needs neither, since its URLs are built from the WCA competition ID and each
  competitor's `registration.wcaRegistrationId`, both already in the WCIF.
- **Scramble double-checking** adds a second scrambler-signature column to the scorecards that
  need it, picked by any of three rules OR'd together: by round; by ranking (world top 50 by
  default, plus an optional national or continental threshold, read from the WCIF personal bests);
  and by an uploaded `WCAID,event1,event2` CSV. The ranking and CSV rules apply in every round and
  only to named cards, since a blank card has no competitor to look up. The round rule starts
  unticked, except Finals when the competition name reads as a championship, because the ranking
  rules already cover who needs it. The thresholds mirror
  [regulation 11i](https://www.worldcubeassociation.org/regulations/#11i), which only owes a
  replacement attempt for a regional record, a personal record in the world top 50, or a
  championship final scrambled by two scramblers. 11i binds every competition, so there is no
  switch to turn the feature on: it is on for every WCA competition, its rules live under
  **Advanced** at the bottom of `/settings`, and "off" is unticking both ranking rules with no
  round and no CSV. Custom (non-WCA) competitions never get it, having no WCIF to rank against.
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
  *fits* its column. A failing sweep means the text is genuinely too long, shorten it. A page
  test that has to find a control by its accessible name looks the name up through `i18n.t()`,
  so it follows a rewording instead of breaking on it.

## Contributing

- **UI work** follows [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md) (Montserrat at 400/500/700,
  lucide-react icons only, CSS-variable tokens); `src/components/design-system.test.ts` enforces
  the hard rules.
- **No em dash in on-screen copy**, in any locale. Use a comma, a colon, or two sentences.
- **Adding a region** is a JSON file drop in `src/presets/` with no code changes, see
  [`src/presets/README.md`](src/presets/README.md).
- **Adding a language** is two entries: a bundle in `LOCALES` (`src/lib/i18n.ts`, printed output)
  and a `LANGUAGES` entry plus UI JSON (`src/i18n/`, interface).
- **Adding a WCA event** touches five files: the `EventId` union (`src/types/wcif.ts`),
  `WCA_EVENT_ORDER` (`src/lib/wcif-parser.ts`, which is also the sort order), `EVENT_ICONS`
  (`src/assets/events.ts`), the name tables in `src/lib/i18n.ts` (`SHORT_NAMETAG_NAMES_BASE`
  plus `EVENT_NAMES_EN/FR/ES/PT`), and `WCA_EVENT_LABELS` (`src/components/CustomEventEditor.tsx`).
  Only the union fails at compile time; `i18n.test.ts` catches the rest. The icon is a
  165x165 RGBA PNG, glyph `#212121` on white, traced from
  [cubing/icons](https://github.com/cubing/icons/tree/main/src/svg). Keep the printed name
  short: the Round Checklist event column has ~136pt of content width on A4, which is why
  FTO is named "FTO" and not "Face-Turning Octahedron".
- **User-visible changes** get a bullet in `src/changelog.ts` in all four locales, newest first.
  Returning organizers see it as a "What's new" dialog, so the bar is high: no refactors, bug
  fixes or small tweaks.
- Run `scripts/checkFixtures.sh` after touching anything under `src/pdf/`. These PDFs get
  printed and cut, so layout regressions are expensive.

## Deploying

Merging to `main` deploys automatically via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) once the test job passes. A pull
request runs the same test job and stops there. One-time
GCP setup lives in [`.github/workflows/README.md`](.github/workflows/README.md). For an emergency
manual deploy: `VITE_WCA_CLIENT_ID=… npm run build && ./deploy.sh`.

## Usage analytics

The tool is used well beyond Canada now, and nothing used to record that. One anonymous JSON
event is posted to `POST /api/event` on sign-in, on a successful generation, and on a failure.
`server.js` sanitises it and writes it to stdout; App Engine forwards stdout to Cloud Logging,
a log sink carries `component: "analytics"` lines into BigQuery, and a Looker Studio report
draws the map and the charts. There is no database and no read API.

**Collected:** the public WCA competition id, the venue's country and coordinates, how big the
competition is (competitors, events, rounds, groups, stages, days), what was produced (PDFs,
pages, scorecards, cover cards), and the settings chosen (languages, paper format, name tag
options, logo choice, check mode, regional preset, generation scope).

**Not collected:** WCA user ids, competitor names, anything from the WCIF, and the uploaded
logo. `src/lib/analytics.test.ts` asserts that none of it can reach the payload.

**Opting out:** organizers can tick a box under "Your data" in the About dialog ("What is
this?"), which is reachable from the login page too. The choice lives in `localStorage` under
`analytics_opt_out`, so it is per browser and survives reloads, and `send()` checks it in one
place so it covers every event.

Nothing is sent from `npm run dev` or `npm run render:fixtures`: `send()` is a no-op unless
`import.meta.env.PROD`. `analytics.js` is the sanitiser both `server.js` and the tests use, and
it is structural rather than a field whitelist so the payload can grow without drifting.

One-time GCP setup for the sink and the dashboard is in
[`.github/workflows/README.md`](.github/workflows/README.md).

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
| `analytics.js` | Server-side sanitiser for the usage events, next to `server.js` |

For anything deeper, [ask DeepWiki](https://deepwiki.com/Speedcubing-Canada/scorecards-v2) or read
the file: both track the code, this README does not.
