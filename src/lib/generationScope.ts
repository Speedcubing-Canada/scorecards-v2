import type { ParsedWCIF, ScorecardData } from './wcif-parser';
import { finalizeEntries } from './wcif-parser';

export interface DocumentSelection {
  scorecards: boolean;
  scheduleTracker: boolean;
  nametags: boolean;
  firstTimerSlips: boolean;
}

// What the user chose to generate.
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
// rendered prefilled/blank, and the `secondRoundMode` choice actually matters). An assigned
// Round 2 is named and appears in `laterRoundsWithAssignments`; an unassigned one does not.
export function hasUnassignedIntermediate(parsed: ParsedWCIF): boolean {
  const assigned = new Set(
    parsed.laterRoundsWithAssignments.map(r => `${r.eventId}-${r.roundNum}`),
  );
  return parsed.intermediate.some(
    e => e.eventId !== '' && !assigned.has(`${e.eventId}-${e.roundNum}`),
  );
}

// Produce a ParsedWCIF restricted to the chosen scope.
// Round filtering (latest/selected) applies to scorecard buckets only.
// Document flags control which artifact types survive, regardless of mode.
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
    firstRound:   documents.scorecards      ? result.firstRound   : [],
    intermediate: documents.scorecards      ? result.intermediate : [],
    semis:        documents.scorecards      ? result.semis        : [],
    finals:       documents.scorecards      ? result.finals       : [],
    extras:       documents.scorecards      ? result.extras       : [],
    nametags:     documents.nametags        ? result.nametags     : [],
    scheduleDays: documents.scheduleTracker ? result.scheduleDays : [],
    firstTimers:  documents.firstTimerSlips ? result.firstTimers  : [],
  };
}
