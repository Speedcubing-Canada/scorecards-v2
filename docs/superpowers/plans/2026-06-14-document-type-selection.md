# Document Type Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose which document types to generate (scorecards, schedule tracker, nametags, first-timer slips) on the RoundScopePage — which now always appears, even pre-competition.

**Architecture:** Add a `documents: DocumentSelection` field to `GenerationScope`; update `filterParsedByScope` to use it instead of the hardcoded `mode === 'everything'` check. The RoundScopePage always renders (removes its early /settings redirect for pre-comp), shows document-type checkboxes for all flows, and the round-scope radio buttons only appear mid-competition. The firstTimerSlips boolean moves out of CompetitionSettings entirely (it's now a documents flag), so the Advanced section toggle in SettingsPage is removed.

**Tech Stack:** TypeScript, React, Vitest

---

## File Map

| File | Change |
|---|---|
| `src/lib/generationScope.ts` | Add `DocumentSelection` interface; add `documents` to all `GenerationScope` variants; rewrite `filterParsedByScope` |
| `src/lib/generationScope.test.ts` | Update existing tests for new type; add document-flag tests |
| `src/types/settings.ts` | Remove `firstTimerSlips: boolean` |
| `src/pdf/scorecardWorker.ts` | Remove `settings.firstTimerSlips &&` guard (line 153) |
| `src/pages/GeneratePage.tsx` | Backfill `documents` in `loadSettings`; remove `settings.firstTimerSlips` from pdfCount |
| `src/pages/RoundScopePage.tsx` | Remove pre-comp redirect; add document-type checkbox state + UI; conditional round-scope section |
| `src/pages/SettingsPage.tsx` | Remove `firstTimerSlips` state/UI; change nametag section gate |
| `src/i18n/en.json` + fr/es/pt | Add new scope keys |

---

## Task 1: Update GenerationScope type and filterParsedByScope (TDD)

**Files:**
- Modify: `src/lib/generationScope.ts`
- Modify: `src/lib/generationScope.test.ts`

- [ ] **Step 1.1: Write failing tests**

Replace the `filterParsedByScope` describe block in `src/lib/generationScope.test.ts` with:

```typescript
describe('filterParsedByScope', () => {
  const allDocs = { scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: true };
  const base = mkParsed({
    firstRound: [sc('333', 1, 'A'), sc('333', 1, 'B')],
    intermediate: [sc('333', 2, 'A'), cover('333', 2)],
    finals: [sc('333', 3)],
    nametags: [{ name: 'x' } as never],
    firstTimers: [{ name: 'y' } as never],
    extras: [sc('333', 1)],
    scheduleDays: [{ dayLabel: 'Day 1', stages: [] }],
    laterRoundsWithAssignments: [{ eventId: '333', roundNum: 2 }],
  });

  it('everything with all docs → returns equivalent data', () => {
    const out = filterParsedByScope(base, { mode: 'everything', documents: allDocs });
    expect(out).toEqual(base);
  });

  it('everything with nametags:false → clears nametags', () => {
    const out = filterParsedByScope(base, {
      mode: 'everything',
      documents: { ...allDocs, nametags: false },
    });
    expect(out.nametags).toHaveLength(0);
    expect(out.scheduleDays).toHaveLength(1);
  });

  it('everything with scheduleTracker:false → clears scheduleDays', () => {
    const out = filterParsedByScope(base, {
      mode: 'everything',
      documents: { ...allDocs, scheduleTracker: false },
    });
    expect(out.scheduleDays).toHaveLength(0);
  });

  it('everything with firstTimerSlips:false → clears firstTimers', () => {
    const out = filterParsedByScope(base, {
      mode: 'everything',
      documents: { ...allDocs, firstTimerSlips: false },
    });
    expect(out.firstTimers).toHaveLength(0);
  });

  it('everything with scorecards:false → clears all scorecard buckets and extras', () => {
    const out = filterParsedByScope(base, {
      mode: 'everything',
      documents: { ...allDocs, scorecards: false },
    });
    expect(out.firstRound).toHaveLength(0);
    expect(out.intermediate).toHaveLength(0);
    expect(out.finals).toHaveLength(0);
    expect(out.extras).toHaveLength(0);
    expect(out.nametags).toHaveLength(1); // nametags unaffected
  });

  it('latest + all docs → keeps only latest assigned round, keeps nametags/schedule', () => {
    const out = filterParsedByScope(base, { mode: 'latest', documents: allDocs });
    expect(realScs(out.firstRound)).toHaveLength(0);
    expect(realScs(out.intermediate).map(s => s.name).sort()).toEqual(['A']);
    expect(realScs(out.finals)).toHaveLength(0);
    expect(out.extras).toHaveLength(0);
    expect(out.nametags).toHaveLength(1);
    expect(out.scheduleDays).toHaveLength(1);
    expect(out.firstTimers).toHaveLength(1);
  });

  it('latest + nametags:false → keeps latest round scorecards, clears nametags', () => {
    const out = filterParsedByScope(base, {
      mode: 'latest',
      documents: { ...allDocs, nametags: false },
    });
    expect(realScs(out.intermediate)).toHaveLength(1);
    expect(out.nametags).toHaveLength(0);
    expect(out.scheduleDays).toHaveLength(1);
  });

  it('latest + only schedule → clears scorecards but keeps schedule', () => {
    const out = filterParsedByScope(base, {
      mode: 'latest',
      documents: { scorecards: false, scheduleTracker: true, nametags: false, firstTimerSlips: false },
    });
    expect(out.firstRound).toHaveLength(0);
    expect(out.intermediate).toHaveLength(0);
    expect(out.scheduleDays).toHaveLength(1);
  });

  it('selected + all docs → keeps only the chosen event+round pairs', () => {
    const out = filterParsedByScope(base, {
      mode: 'selected',
      rounds: [{ eventId: '333', roundNum: 1 }, { eventId: '333', roundNum: 3 }],
      documents: allDocs,
    });
    expect(realScs(out.firstRound).map(s => s.name).sort()).toEqual(['A', 'B']);
    expect(realScs(out.intermediate)).toHaveLength(0);
    expect(realScs(out.finals)).toHaveLength(1);
    expect(out.nametags).toHaveLength(1);
  });

  it('pads each non-empty kept bucket to a multiple of 4', () => {
    const out = filterParsedByScope(base, {
      mode: 'selected',
      rounds: [{ eventId: '333', roundNum: 1 }],
      documents: allDocs,
    });
    expect(out.firstRound.length % 4).toBe(0);
    expect(out.firstRound.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
cd scorecards-v2 && npm test -- --run src/lib/generationScope.test.ts 2>&1 | tail -30
```

Expected: multiple failures because `GenerationScope` variants don't have `documents` yet.

- [ ] **Step 1.3: Update generationScope.ts**

Replace the contents of `src/lib/generationScope.ts` with:

```typescript
import type { ParsedWCIF, ScorecardData } from './wcif-parser';
import { finalizeEntries } from './wcif-parser';

export interface DocumentSelection {
  scorecards: boolean;
  scheduleTracker: boolean;
  nametags: boolean;
  firstTimerSlips: boolean;
}

export type GenerationScope =
  | { mode: 'everything'; documents: DocumentSelection }
  | { mode: 'latest'; documents: DocumentSelection }
  | { mode: 'selected'; rounds: RoundRef[]; documents: DocumentSelection };

export interface RoundRef {
  eventId: string;
  roundNum: number;
}

const SCORECARD_BUCKETS = ['firstRound', 'intermediate', 'semis', 'finals'] as const;

// Padding covers (added to round each bucket to a multiple of 4) carry an empty eventId.
// Strip them before re-filtering so finalizeEntries can re-pad cleanly.
function realEntries(entries: ScorecardData[]): ScorecardData[] {
  return entries.filter((e) => e.kind === 'scorecard' || e.eventId !== '');
}

// Every distinct (eventId, roundNum) that produces scorecards, in bucket → encounter order.
// Drives the per-event+round checklist shown for the "select" scope.
export function availableRounds(parsed: ParsedWCIF): RoundRef[] {
  const seen = new Set<string>();
  const out: RoundRef[] = [];
  for (const bucket of SCORECARD_BUCKETS) {
    for (const e of parsed[bucket]) {
      if (e.kind === 'cover' && e.eventId === '') continue;
      const key = `${e.eventId}-${e.roundNum}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ eventId: e.eventId, roundNum: e.roundNum });
    }
  }
  return out;
}

// The highest round number among rounds that have real assignments (the "latest round").
export function latestAssignedRound(parsed: ParsedWCIF): number {
  return parsed.laterRoundsWithAssignments.reduce((m, r) => Math.max(m, r.roundNum), 0);
}

// True when the intermediate bucket holds a Round 2 that has NOT been assigned (so it is
// rendered prefilled/blank, and the `secondRoundMode` choice actually matters).
export function hasUnassignedIntermediate(parsed: ParsedWCIF): boolean {
  const assigned = new Set(
    parsed.laterRoundsWithAssignments.map(r => `${r.eventId}-${r.roundNum}`),
  );
  return parsed.intermediate.some(
    e => e.eventId !== '' && !assigned.has(`${e.eventId}-${e.roundNum}`),
  );
}

// Produce a ParsedWCIF restricted to the chosen scope.
// Round filtering (latest/selected) applies to scorecard buckets.
// Document flags control which artifact types survive regardless of mode.
export function filterParsedByScope(parsed: ParsedWCIF, scope: GenerationScope): ParsedWCIF {
  // Step 1: apply round-level filtering for scorecard buckets
  let result = parsed;
  if (scope.mode !== 'everything') {
    let keep: (e: ScorecardData) => boolean;
    if (scope.mode === 'latest') {
      const latest = latestAssignedRound(parsed);
      keep = (e) => e.roundNum === latest;
    } else {
      const set = new Set(scope.rounds.map((r) => `${r.eventId}-${r.roundNum}`));
      keep = (e) => set.has(`${e.eventId}-${e.roundNum}`);
    }
    const filterBucket = (entries: ScorecardData[]) =>
      finalizeEntries(realEntries(entries).filter(keep));
    result = {
      ...parsed,
      firstRound: filterBucket(parsed.firstRound),
      intermediate: filterBucket(parsed.intermediate),
      semis: filterBucket(parsed.semis),
      finals: filterBucket(parsed.finals),
      extras: [],
    };
  }

  // Step 2: apply document-type flags
  const { documents } = scope;
  return {
    ...result,
    firstRound:    documents.scorecards     ? result.firstRound    : [],
    intermediate:  documents.scorecards     ? result.intermediate  : [],
    semis:         documents.scorecards     ? result.semis         : [],
    finals:        documents.scorecards     ? result.finals        : [],
    extras:        documents.scorecards     ? result.extras        : [],
    nametags:      documents.nametags       ? result.nametags      : [],
    scheduleDays:  documents.scheduleTracker? result.scheduleDays  : [],
    firstTimers:   documents.firstTimerSlips? result.firstTimers   : [],
  };
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
cd scorecards-v2 && npm test -- --run src/lib/generationScope.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 1.5: Commit**

```bash
cd scorecards-v2 && git add src/lib/generationScope.ts src/lib/generationScope.test.ts
git commit -m "feat: add DocumentSelection to GenerationScope; filterParsedByScope uses document flags"
```

---

## Task 2: Remove firstTimerSlips from CompetitionSettings and update downstream

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/pdf/scorecardWorker.ts`
- Modify: `src/pages/GeneratePage.tsx`

- [ ] **Step 2.1: Remove firstTimerSlips from CompetitionSettings**

In `src/types/settings.ts`, delete these two lines (around line 56):

```typescript
  // Print a confirmation slip for each newcomer (competitor with no WCA ID).
  // Off by default — most delegates don't use it.
  firstTimerSlips: boolean;
```

- [ ] **Step 2.2: Update scorecardWorker.ts — remove settings.firstTimerSlips guard**

In `src/pdf/scorecardWorker.ts`, change line 153 from:

```typescript
  if (settings.firstTimerSlips && parsed.firstTimers.length > 0)
```

to:

```typescript
  if (parsed.firstTimers.length > 0)
```

`filterParsedByScope` now clears `firstTimers` when `documents.firstTimerSlips` is false, so the settings guard is redundant.

- [ ] **Step 2.3: Update GeneratePage.tsx — backfill documents + fix pdfCount**

In `src/pages/GeneratePage.tsx`, update the `loadSettings` backfill block (around line 30) from:

```typescript
  if (s.generationScope === undefined) s.generationScope = { mode: 'everything' };
```

to:

```typescript
  if (s.generationScope === undefined) s.generationScope = { mode: 'everything' };
  const gs = s.generationScope as Record<string, unknown>;
  if (gs.documents === undefined) gs.documents = {
    scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: false,
  };
```

Then update the pdfCount calculation (around line 111) from:

```typescript
      + (settings.firstTimerSlips && effectiveParsed.firstTimers.length > 0 ? 1 : 0)
```

to:

```typescript
      + (effectiveParsed.firstTimers.length > 0 ? 1 : 0)
```

- [ ] **Step 2.4: Confirm build passes**

```bash
cd scorecards-v2 && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 2.5: Run full test suite**

```bash
cd scorecards-v2 && npm test -- --run 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 2.6: Commit**

```bash
cd scorecards-v2 && git add src/types/settings.ts src/pdf/scorecardWorker.ts src/pages/GeneratePage.tsx
git commit -m "feat: remove firstTimerSlips from CompetitionSettings; controlled via GenerationScope.documents"
```

---

## Task 3: Add new i18n strings

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/fr.json`
- Modify: `src/i18n/es.json`
- Modify: `src/i18n/pt.json`

- [ ] **Step 3.1: Add to en.json**

Inside the `"scope"` object in `src/i18n/en.json`, add after `"checking"`:

```json
    "intro_pre": "Choose which documents to include. You can configure all options on the next screen.",
    "rounds_heading": "Which rounds?",
    "docs_title": "Document types",
    "doc_scorecards": "Scorecards",
    "doc_schedule": "Schedule Tracker",
    "doc_nametags": "Nametags",
    "doc_first_timers": "First-Timer Slips",
```

- [ ] **Step 3.2: Add to fr.json**

Inside the `"scope"` object in `src/i18n/fr.json`, add the same keys:

```json
    "intro_pre": "Choisissez les documents à inclure. Vous pourrez configurer les options sur l'écran suivant.",
    "rounds_heading": "Quelles rondes ?",
    "docs_title": "Types de documents",
    "doc_scorecards": "Feuilles de compétition",
    "doc_schedule": "Suivi de l'horaire",
    "doc_nametags": "Étiquettes nominatives",
    "doc_first_timers": "Fiches de première participation",
```

- [ ] **Step 3.3: Add to es.json**

```json
    "intro_pre": "Elige qué documentos incluir. Podrás configurar las opciones en la siguiente pantalla.",
    "rounds_heading": "¿Qué rondas?",
    "docs_title": "Tipos de documentos",
    "doc_scorecards": "Hojas de puntuación",
    "doc_schedule": "Seguimiento de horario",
    "doc_nametags": "Etiquetas con nombre",
    "doc_first_timers": "Fichas de primera vez",
```

- [ ] **Step 3.4: Add to pt.json**

```json
    "intro_pre": "Escolha quais documentos incluir. Você pode configurar as opções na próxima tela.",
    "rounds_heading": "Quais rodadas?",
    "docs_title": "Tipos de documentos",
    "doc_scorecards": "Fichas de pontuação",
    "doc_schedule": "Rastreamento de horário",
    "doc_nametags": "Etiquetas de nome",
    "doc_first_timers": "Fichas de estreante",
```

- [ ] **Step 3.5: Commit**

```bash
cd scorecards-v2 && git add src/i18n/en.json src/i18n/fr.json src/i18n/es.json src/i18n/pt.json
git commit -m "feat: add i18n strings for document-type selection on scope page"
```

---

## Task 4: Redesign RoundScopePage

**Files:**
- Modify: `src/pages/RoundScopePage.tsx`

- [ ] **Step 4.1: Add document checkbox state and update persistScope call**

Replace the entire `RoundScopePage.tsx` with:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';
import { fetchWcif } from '../auth/wca';
import { getCachedWcif, setCachedWcif } from '../lib/wcifCache';
import { parseWCIF, type ParsedWCIF } from '../lib/wcif-parser';
import {
  availableRounds, latestAssignedRound, filterParsedByScope, hasUnassignedIntermediate,
  type GenerationScope, type DocumentSelection,
} from '../lib/generationScope';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import Header from '../components/Header';
import { useIsMobile } from '../lib/useIsMobile';

type Status = 'loading' | 'ready' | 'error';

const keyOf = (eventId: string, roundNum: number) => `${eventId}|${roundNum}`;

function persistScope(scope: GenerationScope, showSecondRoundMode: boolean) {
  sessionStorage.setItem('generation_scope', JSON.stringify(scope));
  sessionStorage.setItem('generation_detection', JSON.stringify({ showSecondRoundMode }));
}

export default function RoundScopePage() {
  const { t, i18n } = useTranslation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const competitionId = sessionStorage.getItem('selected_competition_id') ?? '';
  const competitionName = sessionStorage.getItem('selected_competition_name') ?? '';

  const [status, setStatus] = useState<Status>('loading');
  const [statusMsg, setStatusMsg] = useState('');
  const [parsed, setParsed] = useState<ParsedWCIF | null>(null);
  const [isMidComp, setIsMidComp] = useState(false);

  // Round-scope state (mid-competition only)
  const [scopeMode, setScopeMode] = useState<'everything' | 'latest' | 'selected'>('latest');
  const [selectedKeys, setSelectedKeys] = useState<Set<string> | null>(null);

  // Document-type state — pre-comp defaults (overridden to mid-comp defaults in useEffect)
  const [docScorecards, setDocScorecards] = useState(true);
  const [docSchedule, setDocSchedule]     = useState(true);
  const [docNametags, setDocNametags]     = useState(true);
  const [docFirstTimers, setDocFirstTimers] = useState(false);

  useEffect(() => {
    if (!competitionId || !token) return;
    let cancelled = false;

    async function run() {
      try {
        const wcif = getCachedWcif(competitionId) ?? await fetchWcif(competitionId, token!.access_token);
        if (cancelled) return;
        setCachedWcif(competitionId, wcif);

        const uiLang = (i18n.language?.slice(0, 2) ?? 'en') as LocaleCode;
        const detectionSettings: CompetitionSettings = {
          competitionId, competitionName,
          language: uiLang, secondaryLanguage: null,
          paperFormat: 'LETTER', secondRoundMode: 'blanks',
          logoDataUrl: null, useDefaultLogo: true,
          wcaLiveId: null, wcaLivePersonIds: null, hideWcaLiveId: false,
          nametagLogoMode: 'with-name', nametagQrMode: 'back-only', nametagLayout: 'vertical',
          customEvents: [],
          scrambleDoubleCheck: false, scrambleDoubleCheckRounds: [], scrambleDoubleCheckOverrides: {},
          generationScope: { mode: 'everything', documents: { scorecards: true, scheduleTracker: true, nametags: true, firstTimerSlips: false } },
        };
        const result = parseWCIF(wcif, detectionSettings);
        if (cancelled) return;

        const midComp = result.laterRoundsWithAssignments.length > 0;
        setIsMidComp(midComp);

        if (midComp) {
          // Mid-competition defaults: scorecards only
          setDocSchedule(false);
          setDocNametags(false);
        }

        setParsed(result);
        setStatus('ready');
      } catch (e) {
        if (!cancelled) { setStatusMsg(String(e)); setStatus('error'); }
      }
    }

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roundOptions = useMemo(() => {
    if (!parsed) return [] as { key: string; label: string }[];
    const labels = new Map<string, string>();
    for (const bucket of [parsed.firstRound, parsed.intermediate, parsed.semis, parsed.finals]) {
      for (const e of bucket) {
        if (e.kind === 'cover' && !e.eventId) continue;
        const k = keyOf(e.eventId, e.roundNum);
        if (!labels.has(k)) labels.set(k, `${e.eventName} — ${e.roundLabel}`);
      }
    }
    return availableRounds(parsed).map(r => ({
      key: keyOf(r.eventId, r.roundNum),
      label: labels.get(keyOf(r.eventId, r.roundNum)) ?? keyOf(r.eventId, r.roundNum),
    }));
  }, [parsed]);

  const defaultSelected = useMemo(() => {
    if (!parsed) return new Set<string>();
    const latest = latestAssignedRound(parsed);
    return new Set(
      availableRounds(parsed)
        .filter(r => r.roundNum === latest)
        .map(r => keyOf(r.eventId, r.roundNum)),
    );
  }, [parsed]);
  const effectiveSelected = selectedKeys ?? defaultSelected;

  function toggleRound(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev ?? defaultSelected);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleContinue() {
    if (!parsed) return;

    const documents: DocumentSelection = {
      scorecards: docScorecards,
      scheduleTracker: docSchedule,
      nametags: docNametags,
      firstTimerSlips: docFirstTimers,
    };

    const scope: GenerationScope = isMidComp
      ? (scopeMode === 'selected'
          ? {
              mode: 'selected',
              rounds: [...effectiveSelected].map(k => {
                const [eventId, r] = k.split('|');
                return { eventId, roundNum: Number(r) };
              }),
              documents,
            }
          : { mode: scopeMode, documents })
      : { mode: 'everything', documents };

    const showSecondRoundMode = hasUnassignedIntermediate(filterParsedByScope(parsed, scope));
    persistScope(scope, showSecondRoundMode);
    navigate('/settings');
  }

  const noDocsSelected = !docScorecards && !docSchedule && !docNametags && !docFirstTimers;
  const continueDisabled =
    (isMidComp && scopeMode === 'selected' && effectiveSelected.size === 0) || noDocsSelected;

  const docOptions: { key: keyof DocumentSelection; label: string; checked: boolean; set: (v: boolean) => void }[] = [
    { key: 'scorecards',     label: t('scope.doc_scorecards'),  checked: docScorecards,  set: setDocScorecards },
    { key: 'scheduleTracker',label: t('scope.doc_schedule'),    checked: docSchedule,    set: setDocSchedule },
    { key: 'nametags',       label: t('scope.doc_nametags'),    checked: docNametags,    set: setDocNametags },
    { key: 'firstTimerSlips',label: t('scope.doc_first_timers'),checked: docFirstTimers, set: setDocFirstTimers },
  ];

  return (
    <div style={s.page}>
      <Header showBack onBack={() => navigate('/competitions')} showSignOut />

      <main style={{ ...s.main, ...(isMobile ? s.mainMobile : {}) }}>
        <div style={s.compBadge}>{competitionName}</div>
        <h2 style={s.pageTitle}>{t('scope.heading')}</h2>

        {status === 'loading' && (
          <div style={s.statusBox}>
            <span style={{ fontSize: 24 }}>⏳</span>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{t('scope.checking')}</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ ...s.statusBox, ...s.statusError }}>
            <span style={{ fontSize: 24 }}>❌</span>
            <span style={{ fontSize: 14, color: 'var(--danger)' }}>{statusMsg}</span>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p style={s.intro}>{isMidComp ? t('scope.intro') : t('scope.intro_pre')}</p>

            {isMidComp && (
              <>
                <h3 style={s.sectionHeading}>{t('scope.rounds_heading')}</h3>
                <div style={s.optionGroup}>
                  {(['latest', 'everything', 'selected'] as const).map(mode => (
                    <label key={mode} style={{ ...s.optionCard, ...(scopeMode === mode ? s.optionCardActive : {}) }}>
                      <input
                        type="radio"
                        name="scope"
                        checked={scopeMode === mode}
                        onChange={() => setScopeMode(mode)}
                        style={s.radio}
                      />
                      <div>
                        <div style={s.optionLabel}>{t(`scope.${mode}.label`)}</div>
                        <div style={s.optionDesc}>{t(`scope.${mode}.desc`)}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {scopeMode === 'selected' && (
                  <div style={{ ...s.optionGroup, marginTop: 10 }}>
                    {roundOptions.map(o => (
                      <label key={o.key} style={{ ...s.optionCard, ...(effectiveSelected.has(o.key) ? s.optionCardActive : {}) }}>
                        <input
                          type="checkbox"
                          checked={effectiveSelected.has(o.key)}
                          onChange={() => toggleRound(o.key)}
                          style={s.radio}
                        />
                        <div style={s.optionLabel}>{o.label}</div>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            <h3 style={{ ...s.sectionHeading, marginTop: isMidComp ? 24 : 0 }}>{t('scope.docs_title')}</h3>
            <div style={s.optionGroup}>
              {docOptions.map(o => (
                <label key={o.key} style={{ ...s.optionCard, ...(o.checked ? s.optionCardActive : {}) }}>
                  <input
                    type="checkbox"
                    checked={o.checked}
                    onChange={e => o.set(e.target.checked)}
                    style={s.radio}
                  />
                  <div style={s.optionLabel}>{o.label}</div>
                </label>
              ))}
            </div>

            <button
              style={{ ...s.continueBtn, ...(continueDisabled ? s.continueBtnDisabled : {}) }}
              onClick={handleContinue}
              disabled={continueDisabled}
            >
              {t('scope.continue')}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', backgroundColor: 'var(--bg)' },
  main: { maxWidth: 680, margin: '0 auto', padding: '32px 24px' },
  mainMobile: { padding: '24px 16px' },
  compBadge: {
    display: 'inline-block', backgroundColor: 'var(--primary-soft-bg)', color: 'var(--primary-soft-text)',
    borderRadius: 6, padding: '4px 12px', fontSize: 13, fontWeight: 600, marginBottom: 8,
  },
  pageTitle: { margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: 'var(--text)' },
  sectionHeading: { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--text)' },
  intro: { margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)' },
  statusBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '40px 24px', textAlign: 'center', marginBottom: 24,
  },
  statusError: { borderColor: 'var(--danger)', backgroundColor: 'var(--primary-soft-bg)' },
  optionGroup: { display: 'flex', flexDirection: 'column', gap: 8 },
  optionCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    backgroundColor: 'var(--surface)',
    borderWidth: 2, borderStyle: 'solid', borderColor: 'var(--border)',
    borderRadius: 8, padding: '12px 16px', cursor: 'pointer',
  },
  optionCardActive: { borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft-bg)' },
  radio: { marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 },
  optionLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 },
  optionDesc: { fontSize: 13, color: 'var(--text-muted)' },
  continueBtn: {
    display: 'block', marginTop: 24, backgroundColor: 'var(--primary)', color: 'var(--primary-contrast)',
    border: 'none', borderRadius: 8, padding: '16px', fontSize: 15,
    fontWeight: 700, textAlign: 'center', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', letterSpacing: '-0.01em',
  },
  continueBtnDisabled: { backgroundColor: 'var(--primary-disabled)', cursor: 'not-allowed' },
};
```

- [ ] **Step 4.2: Confirm build passes**

```bash
cd scorecards-v2 && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4.3: Commit**

```bash
cd scorecards-v2 && git add src/pages/RoundScopePage.tsx
git commit -m "feat: RoundScopePage always renders; adds document-type checkboxes for pre- and mid-comp flows"
```

---

## Task 5: Update SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 5.1: Remove firstTimerSlips state variable**

Remove line 67 from `src/pages/SettingsPage.tsx`:

```typescript
  const [firstTimerSlips, setFirstTimerSlips] = useState<boolean>(false);
```

- [ ] **Step 5.2: Change nametag section gate**

On line 37 of `src/pages/SettingsPage.tsx`, after `const everything = ...`, add:

```typescript
  const showNametags = generationScope.documents?.nametags !== false;
```

Then on line 501, change:

```typescript
        {everything && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.nametag.title')}</h3>
```

to:

```typescript
        {showNametags && (
        <section style={s.section}>
          <h3 style={s.sectionTitle}>{t('settings.nametag.title')}</h3>
```

- [ ] **Step 5.3: Remove firstTimerSlips from handleSubmit**

In the `handleSubmit` function (around line 231), remove:

```typescript
      firstTimerSlips,
```

- [ ] **Step 5.4: Remove first-timer slips section from Advanced UI**

In the Advanced section (around lines 718–733), remove the entire first-timer slips block:

```typescript
              <h3 style={{ ...s.sectionTitle, marginTop: 24 }}>
                {t('settings.advanced.first_timer_slips_title')}
              </h3>
              <label style={{ ...s.optionCard, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={firstTimerSlips}
                  onChange={e => setFirstTimerSlips(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--primary)', flexShrink: 0 }}
                />
                <div>
                  <div style={s.optionLabel}>{t('settings.advanced.first_timer_slips_enable')}</div>
                  <div style={s.optionDesc}>{t('settings.advanced.first_timer_slips_desc')}</div>
                </div>
              </label>
```

- [ ] **Step 5.5: Confirm build passes**

```bash
cd scorecards-v2 && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 5.6: Run full test suite**

```bash
cd scorecards-v2 && npm test -- --run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5.7: Commit**

```bash
cd scorecards-v2 && git add src/pages/SettingsPage.tsx
git commit -m "feat: remove firstTimerSlips from SettingsPage; nametag config shown when scope includes nametags"
```

---

## Verification

- [ ] **Manual — pre-competition comp:**
  1. Start dev server: `cd scorecards-v2 && npm run dev`
  2. Log in, pick a comp that has NO mid-round assignments
  3. Verify: RoundScopePage appears (not skipped), shows only document-type checkboxes, no "Which rounds?" section
  4. Verify defaults: Scorecards ✓, Schedule ✓, Nametags ✓, First-Timer Slips ✗
  5. Uncheck "Nametags", click Continue → SettingsPage shows NO nametag config section
  6. Click Continue again (Settings) → Generate page, download ZIP → confirm no nametag PDF in ZIP
  7. Repeat with only "Schedule Tracker" checked → ZIP contains only the schedule PDF

- [ ] **Manual — mid-competition comp:**
  1. Pick a comp that already has Round 2+ groups assigned
  2. Verify: RoundScopePage shows "Which rounds?" section AND document checkboxes
  3. Verify defaults: Scorecards ✓, Schedule ✗, Nametags ✗, First-Timer Slips ✗
  4. Check "Schedule Tracker", pick "Latest round only" → download → ZIP has round scorecards + schedule
  5. Check "Nametags" → SettingsPage shows nametag configuration section
  6. Verify "First-Timer Slips" option appears and, when checked, slips appear in the ZIP

- [ ] **Verify first-timer slips toggle is gone from Advanced settings**
  - In SettingsPage Advanced section, confirm no first-timer slips checkbox exists
