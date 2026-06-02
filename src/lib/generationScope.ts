import type { ParsedWCIF, ScorecardData } from './wcif-parser';
import { finalizeEntries } from './wcif-parser';

// What the user chose to generate. Only relevant when the WCIF contains real group
// assignments for rounds 2+ (mid-competition). Otherwise generation is always 'everything'.
export type GenerationScope =
  | { mode: 'everything' }
  | { mode: 'latest' }
  | { mode: 'selected'; rounds: RoundRef[] };

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

// Produce a ParsedWCIF restricted to the chosen scope. Scoped modes ('latest'/'selected')
// emit scorecard PDFs only — nametags, schedule tracker, and extras are pre-competition
// artifacts and are cleared. Each kept bucket is re-finalized (sorted + padded + quad-
// reordered) so the cut-and-stack print order stays valid after filtering.
export function filterParsedByScope(parsed: ParsedWCIF, scope: GenerationScope): ParsedWCIF {
  if (scope.mode === 'everything') return parsed;

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

  return {
    ...parsed,
    firstRound: filterBucket(parsed.firstRound),
    intermediate: filterBucket(parsed.intermediate),
    semis: filterBucket(parsed.semis),
    finals: filterBucket(parsed.finals),
    extras: [],
    nametags: [],
    scheduleDays: [],
  };
}
