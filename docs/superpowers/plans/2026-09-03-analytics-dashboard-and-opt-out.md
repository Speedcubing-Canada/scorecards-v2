# Handoff: analytics dashboard + telemetry opt-out

Two independent jobs. **Task B is the one that touches this repo** and is fully
specified. Task A is GCP/Looker Studio configuration with no code in it, beyond one
optional SQL file.

Do them in either order. Task B needs no GCP access; Task A needs no repo access.

---

## Background

Anonymous usage analytics shipped on 2026-09-02 (commit `ebec3e5`, "adding
analytics", now on `main`). The whole pipeline is deployed and verified working
end to end:

```
GeneratePage / AuthContext          src/lib/analytics.ts
  → navigator.sendBeacon('/api/event')
      → server.js  (sanitised by analytics.js, console.log of one JSON line)
          → Cloud Logging            (App Engine forwards stdout, free)
              → sink `scorecards-analytics`
                  → BigQuery `scorecards-v2-prod.analytics.stdout`
                      → Looker Studio report  ← BROKEN, see Task A
```

Read `README.md` § "Usage analytics" and `.github/workflows/README.md` § 6 before
starting. Three events exist: `generate`, `error`, `session`. Everything is
anonymous by design: no WCA user id, no competitor names, no WCIF content, no
uploaded logo. `src/lib/analytics.test.ts` asserts that none of those can reach the
payload; keep it that way.

**Verified state as of 2026-09-02:** sink exists with the right filter, the
`analytics` dataset exists, the sink's writer identity
(`service-903378894116@gcp-sa-logging.iam.gserviceaccount.com`) holds
`roles/bigquery.dataEditor`, and the live endpoint returns 204. One `generate` row
had landed at that point. More has accumulated since.

### The report

Existing Looker Studio report (owner: aondet@speedcubingcanada.org):
`https://datastudio.google.com/u/0/reporting/081c58ee-cda3-4df2-b083-23b29ac34f1a/page/9Vw7F/edit`

Its map renders nothing, even zoomed in, and that is the presenting complaint.

---

## Task A: make the dashboard work and keep itself current

### A0. Re-authenticate first

`gcloud`/`bq` credentials for `scorecards-v2-prod` were expired at handoff time.
The user must run this themselves, it cannot be done non-interactively:

```bash
gcloud auth login
```

Then confirm you can read the data:

```bash
bq --project_id=scorecards-v2-prod query --use_legacy_sql=false \
  'SELECT jsonPayload.event AS event, COUNT(*) AS n,
          COUNTIF(jsonPayload.comp.lat IS NOT NULL) AS with_coords
   FROM `scorecards-v2-prod.analytics.stdout` GROUP BY event'
```

### A1. Diagnose the empty map by bisecting

Do not guess at map settings. In the report, build a throwaway **table** chart with
`latlng` as its only dimension and Record Count as its metric.

- **Table shows coordinate strings** (`45.494054,-73.563587`) → the data path is
  fine and the fault is in the map chart. Go to A2.
- **Table is empty** → the fault is in the data source, the date range, or a chart
  filter. Go to A3.

### A2. If the data reaches the table but not the map

In likelihood order:

1. **The bubble Size metric is zero.** This is the most probable cause. Early rows
   come from competitions with no groups assigned yet, so `scorecards`,
   `group_count`, `stage_count` and `day_count` are all `0`, and a bubble sized by
   a zero metric has zero radius, i.e. it is invisible. **Set Size to Record
   Count.**
2. **Wrong chart type.** The legacy **Geo chart** only accepts country/region/city
   and will never plot coordinates. It must be **Google Maps → Bubble map**.
3. **`latlng` is not typed as a geo field.** In the data source field list its Type
   must be **Geo → Latitude, Longitude**. A plain text field is silently ignored by
   the map.
4. **Stale cache.** Looker caches BigQuery results up to 12 h. Three-dot menu on
   the chart → Refresh data.

### A3. If the table is empty too

1. Report date range control excludes the rows (they are recent, but check the
   report timezone).
2. A chart or report filter references a renamed field, so it matches nothing.
3. The data source points at the wrong table. It must be
   `scorecards-v2-prod.analytics.stdout`.

### A4. Create the BigQuery view (recommended, removes the whole class of problem)

The raw table is painful in Looker: Cloud Logging **lowercases** every field name
(`covercards`, `paperformat`, `uilanguage`, `secondarylanguage`, `hidewcaliveid`,
`scrambledoublecheck`, `nametaglayout`, `nametaglogomode`, `nametagqrmode`,
`secondroundmode`, `scorecardcheckmode`, `customevents`), nests everything under
`jsonPayload.`, and offers no single lat/lng field.

A view fixes all of it at once, is version-controlled, and can be iterated from the
CLI without touching the report. **This SQL is verified to run** against the real
table:

```sql
CREATE OR REPLACE VIEW `scorecards-v2-prod.analytics.events` AS
SELECT
  timestamp,
  jsonPayload.event                       AS event,
  jsonPayload.comp.id                     AS competition_id,
  jsonPayload.comp.country                AS country,
  jsonPayload.comp.custom                 AS is_custom,
  CONCAT(CAST(jsonPayload.comp.lat AS STRING), ",",
         CAST(jsonPayload.comp.lng AS STRING))           AS latlng,
  jsonPayload.size.competitors            AS competitors,
  jsonPayload.size.events                 AS event_count,
  jsonPayload.size.rounds                 AS round_count,
  jsonPayload.size.groups                 AS group_count,
  jsonPayload.size.stages                 AS stage_count,
  jsonPayload.size.days                   AS day_count,
  jsonPayload.output.pdfs                 AS pdfs,
  jsonPayload.output.pages                AS pages,
  jsonPayload.output.scorecards           AS scorecards,
  jsonPayload.output.covercards           AS cover_cards,
  jsonPayload.settings.language           AS language,
  jsonPayload.settings.secondarylanguage  AS secondary_language,
  jsonPayload.settings.uilanguage         AS ui_language,
  jsonPayload.settings.paperformat        AS paper_format,
  jsonPayload.settings.preset             AS preset,
  jsonPayload.settings.logo               AS logo,
  jsonPayload.settings.nametaglayout      AS nametag_layout,
  jsonPayload.scope.mode                  AS scope_mode,
  ARRAY_TO_STRING(jsonPayload.scope.documents, ", ") AS documents
FROM `scorecards-v2-prod.analytics.stdout`
```

`groups`, `events` and `days` are reserved words in BigQuery, hence the `_count`
suffixes. Do not drop them.

Apply with `bq query --use_legacy_sql=false < the file`. Save the statement to
`docs/analytics-view.sql` in this repo and reference it from
`.github/workflows/README.md` § 6, so it is reproducible.

Then repoint the Looker data source at `analytics.events` (Edit connection →
select the view). The only manual step left is setting `latlng`'s type to
**Geo → Latitude, Longitude** once, because Looker cannot infer a geo type from a
string.

### A5. Automatic refresh

This is a data source setting, not a schedule you have to build. The sink writes to
BigQuery continuously, so the only staleness is Looker's own cache.

Data source → **Data freshness** → change from the 12 hour default to **1 hour**
(or 15 minutes). At this volume the BigQuery cost stays inside the free tier: 1 TiB
of queries per month, against a table measured in kilobytes.

Do not build a scheduled query or a materialised table. There is no volume problem
to solve, and either one is a second thing that can silently stop.

### A6. Charts worth having

Once the map works: events over time, competitions by `competitors`, breakdowns by
`language` / `paper_format` / `preset` / `documents`, and `event = "error"` as a
failure rate. Add a report-level filter `event = "generate"` to the map page, since
`session` and `error` rows carry no coordinates.

### A7. Note for whoever does this

Looker Studio has **no authoring API**. Its public API covers asset permissions and
metadata only, so no CLI and no MCP can create or edit a chart. A1 through A3 and
A5 through A6 are hand-work in the browser. Only A4 is automatable.

---

## Task B: telemetry opt-out

The original design deliberately shipped without one, on the reasoning that the
README and About dialog disclosure were enough. The user has since asked for a real
opt-out. Build it.

**Default stays opted in.** This is an opt-out, not an opt-in: switching the
default off would collect nothing and defeat the feature that was just built.

### B1. Storage and the guard

In `src/lib/analytics.ts`:

```ts
const OPT_OUT_KEY = 'analytics_opt_out';

export function isOptedOut(): boolean { /* localStorage, try/catch → false */ }
export function setOptedOut(optedOut: boolean): void { /* try/catch, no-op on failure */ }
```

- **`localStorage`, not `sessionStorage`.** The choice has to outlive the tab, or
  it is not an opt-out. Note that this is the fourth `localStorage` key in the app,
  alongside `changelog_seen`, `scorecard_theme` and `i18nextLng`.
- Wrap every read and write in `try/catch`. Private-mode browsers throw on access,
  and the existing storage callers in this codebase all do this. A throw here must
  never reach a page that is mid-render.
- Add the early return to `send()`, next to the existing `import.meta.env.PROD`
  guard:
  ```ts
  if (!import.meta.env.PROD || isOptedOut()) return;
  ```
  One guard in `send()` covers all three events and every call site. Do not add
  checks at the call sites.

### B2. UI

Put the toggle in **`src/components/AboutDialog.tsx`**, directly under the existing
`about.privacy_body` paragraph. That dialog is the right home for two reasons: it
already carries the privacy disclosure this toggle belongs to, and it is reachable
from the login page, which has no `Header`, so a signed-out organizer can still
find it.

Copy the checkbox pattern already used in `src/pages/RoundScopePage.tsx:324-331`
(a `<label>` wrapping `<input type="checkbox">` plus a text div). `AboutDialog`
currently holds only its `open` state; add a `useState` seeded from `isOptedOut()`
and write through to `setOptedOut` on change.

Design constraints, enforced by `src/components/design-system.test.ts`, which
reads component sources and will fail the build:

- Font weights **400/500/700 only**. No 600, no 800.
- Icons from **lucide-react** only. No inline `<svg>`, no emoji.
- Colours and radii from the CSS variable tokens (`var(--surface)`,
  `var(--border-strong)`, `var(--text-muted)`, `var(--radius-sm)`, …), never
  hard-coded hex.
- Follow `DESIGN_GUIDELINES.md`.

### B3. Copy, in all four locales

Add one key, `about.privacy_optout`, to **each** of `src/i18n/{en,fr,es,pt}.json`,
placed next to the existing `privacy_title` / `privacy_body` pair.

Suggested English, phrased so the checked state means opted out:
> "Don't send anonymous usage statistics from this browser"

**No em dashes anywhere in on-screen copy.** Use a comma, a colon, or two
sentences. `src/i18n/locale-parity.test.ts` enforces both key parity across the
four locales and the em dash ban, and it will fail the build.

### B4. Changelog, in all four locales

This clears the bar in `CLAUDE.md`: it is a real user-visible feature that changes
what leaves the browser. Add one bullet to `src/changelog.ts` in **en, fr, es and
pt**, newest first.

Today's id is `2026-09-03`. If an entry with that id already exists, append to it
rather than adding a second. The suffix convention (`2026-09-03b`) is only for a
genuinely separate second entry the same day. No em dashes.

### B5. Documentation

Update `README.md` § "Usage analytics" to state that organizers can opt out from
the About dialog, and that the choice is stored per browser in `localStorage`.

### B6. Tests

`src/lib/analytics.test.ts` exists and passes; extend it, do not replace it.

- Test `isOptedOut` / `setOptedOut` directly. **Do not try to test `send()`** for
  this: it already returns early because `import.meta.env.PROD` is false under
  Vitest, so such a test would pass whether or not the opt-out works.
- Vitest runs in the `node` environment here (`vitest.config.ts`) with no jsdom, so
  stub storage with the `vi.stubGlobal` + `Map` pattern from
  `src/lib/flowState.test.ts:16-25`, and `beforeEach(() => store.clear())`.
- Cover: default is opted **in**; `setOptedOut(true)` then `isOptedOut()` is true;
  round-trips false again; a throwing `localStorage` degrades to opted in rather
  than propagating.

---

## Constraints that apply to both tasks

From `CLAUDE.md` at the repo parent, plus what the guard tests enforce:

- **No em dashes in on-screen copy.** Not in i18n bundles, not in `changelog.ts`.
  Source comments, the README and developer docs are exempt.
- Significant user-visible changes get a `src/changelog.ts` entry in all four
  locales. Bug fixes, refactors and minor tweaks do not.
- After discovering a new constraint or bug, add or update a test so it cannot be
  forgotten.
- Update the README after adding a feature.
- Comment only what the code cannot say: constraints, sentinel meanings, non-obvious
  why. Never restate the code. One line where possible.

## Verification

The CI gate, run from `scorecards-v2/`, is exactly what
`.github/workflows/deploy.yml` runs on every PR:

```bash
npm run lint && npx tsc -b && npm test
```

At handoff: 26 test files, 658 tests, all passing, roughly 3 s.

For Task B specifically:

1. `npm run build && npm start`, then walk the wizard and generate. Confirm a 204
   on `/api/event` and one JSON line on the server's stdout.
2. Tick the opt-out in the About dialog, generate again, and confirm **no** request
   and **no** log line.
3. Reload the page and confirm the checkbox is still ticked, i.e. it really is in
   `localStorage`.
4. Untick, generate, confirm the event returns.
5. `npm run dev` must never emit an event regardless of the toggle.

Do not deploy. Pushing to `main` deploys automatically via
`.github/workflows/deploy.yml`, so open a PR and let the user merge.
