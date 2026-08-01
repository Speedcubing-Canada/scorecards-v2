# Document Type Selection - Design Spec
Date: 2026-06-14

## Problem

When a competition is already ongoing, the app forces generating scorecards for
all selected rounds. There is no way to generate just specific document types
(e.g., only the schedule tracker or only nametags). Users need this for
mid-competition reprinting scenarios.

## Intended Outcome

The RoundScopePage becomes the central "what to generate" hub for both pre-
and mid-competition flows. Users pick which document types to include on this
page. The round-scope picker (existing) remains for mid-competition scorecard
targeting.

---

## Architecture

### Routing

No change to `App.tsx` routes. The `/scope` route already exists. Currently
`RoundScopePage` auto-redirects to `/settings` when there are no
`laterRoundsWithAssignments`. That early redirect is removed - the page now
always renders.

### Data Model (`src/lib/generationScope.ts`)

Add a `documents` field to `GenerationScope`:

```typescript
interface DocumentSelection {
  scorecards: boolean
  scheduleTracker: boolean
  nametags: boolean
  firstTimerSlips: boolean
}

type GenerationScope =
  | { mode: 'everything'; documents: DocumentSelection }
  | { mode: 'latest'; documents: DocumentSelection }
  | { mode: 'selected'; rounds: RoundRef[]; documents: DocumentSelection }
```

`filterParsedByScope()` is updated to use `scope.documents.*` flags instead
of checking `mode === 'everything'` when deciding whether to clear nametags,
scheduleDays, and firstTimers. This decouples document type from round scope.

### CompetitionSettings (`src/types/settings.ts`)

Remove `firstTimerSlips: boolean` - its responsibility moves to
`GenerationScope.documents.firstTimerSlips`.

---

## RoundScopePage Changes (`src/pages/RoundScopePage.tsx`)

The page is restructured into two conditional sections:

**Section 1 - Round scope** (mid-competition only, i.e., when
`laterRoundsWithAssignments` is non-empty):
- Existing radio buttons: Latest assigned round / All rounds / Select specific rounds
- Hidden/disabled when Scorecards document type is unchecked

**Section 2 - Document types** (always shown):
- Scorecards checkbox
- Schedule Tracker checkbox
- Nametags checkbox
- First-Timer Slips checkbox

**Defaults:**

| Document | Pre-competition | Mid-competition |
|---|---|---|
| Scorecards | ✓ | ✓ |
| Schedule Tracker | ✓ | ✗ |
| Nametags | ✓ | ✗ |
| First-Timer Slips | ✗ | ✗ |

The Continue button is enabled as long as at least one document type is
selected.

---

## SettingsPage Changes (`src/pages/SettingsPage.tsx`)

- Remove the Advanced section first-timer slips toggle (moved to scope page)
- Change nametag config section visibility: from `mode === 'everything'` check
  to `scope.documents.nametags === true`. This allows nametag configuration
  even when in 'latest' or 'selected' round scope mode.
- Remove `firstTimerSlips` from the `CompetitionSettings` object built on
  submit (line ~215)

---

## Worker (`src/pdf/scorecardWorker.ts`)

The worker builds PDFs from `ParsedWCIF`. Since `filterParsedByScope` handles
clearing unused document arrays, the worker requires no logic changes. Verify
that no reference to `settings.firstTimerSlips` remains after removing it from
`CompetitionSettings`.

---

## Tests

Update tests in `src/lib/generationScope.test.ts`:
- Add cases for the `documents` field in all three scope modes
- Verify `filterParsedByScope` respects `documents.nametags`, `documents.scheduleTracker`,
  and `documents.firstTimerSlips` flags independently of `mode`
- Verify mid-competition defaults produce scorecards-only selection

---

## Verification

1. Run `npm test` - all existing tests pass, new scope tests pass
2. Start dev server, pick a pre-competition comp:
   - Scope page shows only document type checkboxes, no round-scope section
   - All except First-Timer Slips are checked by default
   - Uncheck Schedule → generate → zip contains no schedule PDF
3. Pick a mid-competition comp:
   - Scope page shows round-scope section + document type checkboxes
   - Only Scorecards is checked by default
   - Check Nametags → nametag config appears in Settings
   - Generate → zip contains scorecards + nametags but no schedule
4. Confirm first-timer slips Advanced toggle is gone from Settings
