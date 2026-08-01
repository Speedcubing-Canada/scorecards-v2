import type { WCIF, Round, EventId, Assignment, ChildActivity } from '../types/wcif';
import type { CompetitionSettings, DoubleCheckRound } from '../types/settings';
import { getStrings, getEventName, getNametTagTitleStrings, getNametTagStrings, getShortNametTagNames, getScheduleStrings, type NametTagTitleStrings } from './i18n';

export type ScorecardFormat = 'avg5' | 'bo2-avg5' | 'mo3' | 'bo1-mo3' | 'bo2' | 'bo1';

// ── Nametag types ─────────────────────────────────────────────────────────────


const WCA_EVENT_ORDER: EventId[] = [
  '333','222','444','555','666','777','333bf','333fm','333oh',
  'clock','minx','pyram','skewb','sq1','444bf','555bf','333mbf',
];

export type NametTagRole = 'delegate' | 'organizer' | 'new-competitor' | 'competitor';

export interface NametTagEntry {
  name: string;
  wcaId: string;
  registrantId: number;
  wcaUserId: number;
  gender: 'm' | 'f' | 'o';
  role: NametTagRole;
  titleFront: string;
  titleBack: string;
  events: EventId[];
  compete: string[];
  scramble: string[];
  judge: string[];
  run: string[];
}

// ── First-timer slip types ───────────────────────────────────────────────────
// One entry per accepted competitor with no WCA ID (a newcomer). Used to print a
// confirmation slip the delegate attaches to the scorecard after the first solve.
export interface FirstTimerEntry {
  name: string;
  gender: 'm' | 'f' | 'o';
  // ISO date (YYYY-MM-DD) or null/undefined when the WCIF doesn't expose DOB.
  birthdate?: string | null;
  countryIso2: string;
  eventIds: EventId[];
}

function buildDuties(
  assignments: Assignment[],
  code: Assignment['assignmentCode'],
  activityCodeMap: Record<number, string>,
  shortNames: Record<string, string>,
  dutyGroup: (groupList: string) => string,
): string[] {
  const byEvent: Record<string, Set<number>> = {};
  for (const a of assignments) {
    if (a.assignmentCode !== code) continue;
    const actCode = activityCodeMap[a.activityId];
    if (!actCode) continue;
    const parts = actCode.split('-');
    if (parts.length < 3) continue;
    const eventId = parts[0];
    const groupNum = parseInt(parts[2].slice(1), 10);
    if (!isFinite(groupNum)) continue;
    if (!byEvent[eventId]) byEvent[eventId] = new Set();
    byEvent[eventId].add(groupNum);
  }

  if (Object.keys(byEvent).length === 0) return [];

  return Object.entries(byEvent)
    .map(([eventId, groups]) => {
      const shortName = shortNames[eventId] ?? eventId;
      const groupList = [...groups].sort((a, b) => a - b).join(' & ');
      return `${shortName}: ${dutyGroup(groupList)}`;
    })
    .sort();
}

export interface ScorecardEntry {
  kind: 'scorecard';
  timeslot: string;
  eventId: string;
  eventName: string;
  roundLabel: string;
  // 1-based round number this card belongs to (0 for custom events). Used by the
  // generation-scope filter to select cards by (eventId, roundNum) without re-parsing labels.
  roundNum: number;
  group: string;
  // Stage/colour sort key (e.g. "bleu", "rouge"). Keeps stages grouped in finalizeEntries
  // when `group` is a station number that omits the stage (stationary rounds). Optional:
  // blank/prefilled entries leave it undefined and fall through to group sorting unchanged.
  stage?: string;
  name: string;
  wcaId: string;
  liveId: string;
  gender: string;
  cutoff: string;
  limit: string;
  format: ScorecardFormat;
  isCumulative: boolean;
  // Overrides EVENT_ICONS lookup when set (used for custom events).
  iconDataUrl?: string;
  // When true, render a second scrambler-signature column (scramble double-checking).
  scrambleDoubleCheck?: boolean;
}

export interface CoverEntry {
  kind: 'cover';
  timeslot: string;
  eventId: string;
  eventName: string;
  roundLabel: string;
  roundNum: number;
  group: string;
  // See ScorecardEntry.stage - keeps a stationary round's cover with its own stage's cards.
  stage?: string;
  numScorecards: number;
  // How many groups this cover accounts for. Always 1 for per-group covers; the collapsed
  // count for 'per-round-card' covers, which render it instead of a group label.
  numGroups: number;
}

export type ScorecardData = ScorecardEntry | CoverEntry;

export interface ScheduleRow {
  startTime: string;
  endTime: string;
  eventRound: string;
}

// One round of the standalone checking sheet. Same chronological (day → room) shape as
// the schedule tracker, but one row per round with the group count the delegate must
// account for; every other column is left blank to be filled in by hand.
export interface CheckingRow {
  startTime: string;
  endTime: string;
  eventRound: string;
  // Groups scheduled for this round in this room. 0 when the WCIF has no groups yet.
  groupCount: number;
}

// One room's rounds within a single day.
export interface CheckingStage {
  stageName: string;
  rows: CheckingRow[];
}

// One calendar day; contains one entry per room that has rounds that day.
export interface CheckingDay {
  dayLabel: string;
  stages: CheckingStage[];
}

// One room's events within a single day.
export interface ScheduleStage {
  stageName: string;
  rows: ScheduleRow[];
}

// One calendar day; contains one entry per room that has events that day.
export interface ScheduleDay {
  dayLabel: string;   // "Day 1 - Saturday"
  stages: ScheduleStage[];
}

export interface ParsedWCIF {
  firstRound: ScorecardData[];
  // Round 2 of events with 3+ rounds.
  // Prefilled: N covers + all round-1 participants (blank group "Group _ of N").
  // Blanks: blank entries per group.
  intermediate: ScorecardData[];
  // Rounds 3..N-1 of events with 4+ rounds (semi-finals). Always blank.
  semis: ScorecardData[];
  // Final round of every event with 2+ rounds. Always blank.
  finals: ScorecardData[];
  nametags: NametTagEntry[];
  // One confirmation slip per accepted newcomer (no WCA ID), sorted by name.
  firstTimers: FirstTimerEntry[];
  // One blank scorecard per round per event (sorted by schedule order).
  extras: ScorecardData[];
  // Schedule tracker data in chronological (day-primary) order.
  scheduleDays: ScheduleDay[];
  // Standalone checking-sheet data, same day/room partition as `scheduleDays` but one
  // row per round. Always built; only rendered when settings.scorecardCheckMode is
  // 'checking-sheet'.
  checkingDays: CheckingDay[];
  // True once groups have been generated for this competition (the schedule has group
  // child-activities). False for a fresh pre-competition WCIF, which is why scorecard
  // counts read 0 - drives the "no groups assigned yet" warning.
  hasGroups: boolean;
  // Rounds (>= 2) that have real competitor group assignments in the WCIF - i.e. groups
  // were generated mid-competition. Empty for a standard pre-competition WCIF. Drives the
  // generation-scope prompt on GeneratePage. Sorted by event order then round number.
  laterRoundsWithAssignments: { eventId: string; roundNum: number }[];
}

// A ParsedWCIF with nothing in it - used by custom (non-WCA) competitions, which
// have no WCIF at all: only settings.customEvents drive the generated PDFs.
export function emptyParsedWcif(): ParsedWCIF {
  return {
    firstRound: [],
    intermediate: [],
    semis: [],
    finals: [],
    nametags: [],
    firstTimers: [],
    extras: [],
    scheduleDays: [],
    checkingDays: [],
    hasGroups: true,
    laterRoundsWithAssignments: [],
  };
}

const EMPTY_COVER: CoverEntry = {
  kind: 'cover', timeslot: 'ZZZ', eventId: '' as EventId,
  eventName: '', roundLabel: '', roundNum: 0, group: '', numScorecards: 0, numGroups: 0,
};

function padToMultipleOfFour(arr: ScorecardData[]): void {
  const rem = arr.length % 4;
  if (rem !== 0) for (let i = 0; i < 4 - rem; i++) arr.push(EMPTY_COVER);
}

// Blind events always show 3 attempt rows regardless of round.format in WCIF.
const BLIND_EVENTS = new Set(['444bf', '555bf']);

function getScorecardFormat(eventId: string, round: Round): ScorecardFormat {
  if (eventId === '333mbf') return 'bo2';
  if (BLIND_EVENTS.has(eventId)) return round.cutoff ? 'bo1-mo3' : 'mo3';
  if (round.format === '2') return 'bo2';
  if (round.format === '3' || round.format === 'm') return round.cutoff ? 'bo1-mo3' : 'mo3';
  return round.cutoff ? 'bo2-avg5' : 'avg5';
}

function reorderQuadrants<T>(items: T[]): T[] {
  const n = items.length;
  if (n === 0) return items;
  const indices = Array.from({ length: n }, (_, i) => i);
  let quadrant = 0;
  for (let i = 1; i < n; i++) {
    let next = indices[i - 1] + 4;
    if (next >= n) { quadrant++; next = quadrant; }
    indices[i] = next;
  }
  const result = new Array<T>(n);
  indices.forEach((out, inp) => { result[out] = items[inp]; });
  return result;
}

// Standard finalize: sort by timeslot → eventId → stage → group → cover-before-scorecard → name.
// The stage key keeps each stage's cards grouped even on stationary rounds, where `group` is a
// station number that omits the stage (otherwise stations numbered across stages interleave).
// For rotation rounds it is a no-op: the stage is already the prefix of the group label.
// Sorting by group before kind keeps each group's cover immediately before its own scorecards,
// so that after quad-reorder the cut-and-stack produces one correctly ordered pile per group.
export function finalizeEntries(entries: ScorecardData[]): ScorecardData[] {
  if (entries.length === 0) return [];
  entries.sort((a, b) => {
    const ts = a.timeslot.localeCompare(b.timeslot);
    if (ts !== 0) return ts;
    const ev = a.eventId.localeCompare(b.eventId);
    if (ev !== 0) return ev;
    const st = (a.stage ?? '').localeCompare(b.stage ?? '');
    if (st !== 0) return st;
    const gr = a.group.localeCompare(b.group);
    if (gr !== 0) return gr;
    const kd = a.kind.localeCompare(b.kind);
    if (kd !== 0) return kd;
    const an = a.kind === 'scorecard' ? a.name : '';
    const bn = b.kind === 'scorecard' ? b.name : '';
    return an.localeCompare(bn, undefined, { sensitivity: 'base' });
  });
  padToMultipleOfFour(entries);
  return reorderQuadrants(entries);
}

// Intermediate prefilled finalize: sort by timeslot → eventId → cover-before-scorecard → name.
// This keeps each event's covers and participant cards as a contiguous block.
function finalizeEntriesIntermediate(entries: ScorecardData[]): ScorecardData[] {
  if (entries.length === 0) return [];
  entries.sort((a, b) => {
    const ts = a.timeslot.localeCompare(b.timeslot);
    if (ts !== 0) return ts;
    const ev = a.eventId.localeCompare(b.eventId);
    if (ev !== 0) return ev;
    const kd = a.kind.localeCompare(b.kind);
    if (kd !== 0) return kd;
    const an = a.kind === 'scorecard' ? a.name : '';
    const bn = b.kind === 'scorecard' ? b.name : '';
    return an.localeCompare(bn, undefined, { sensitivity: 'base' });
  });
  padToMultipleOfFour(entries);
  return reorderQuadrants(entries);
}

export function parseWCIF(wcif: WCIF, settings: CompetitionSettings): ParsedWCIF {
  const { language, secondaryLanguage, secondRoundMode } = settings;
  // Station/seat labels are primary-only, so the secondary language is irrelevant here.
  const strings = getStrings(language);

  // ── Scramble double-checking ────────────────────────────────────────────────
  // Decide per-card whether to add the second scrambler-signature column. The round
  // rule keys off the destination bucket (which maps 1:1 to the emitted PDFs); the
  // override rule matches a named card's WCA ID + event across all rounds.
  const dcEnabled = settings.scrambleDoubleCheck === true;
  const dcRounds = new Set(settings.scrambleDoubleCheckRounds ?? []);
  const dcOverrides = settings.scrambleDoubleCheckOverrides ?? {};
  // `buckets` lists every round-category the card belongs to. A single-round event's
  // only round is both 'firstRound' and 'finals', so selecting either covers it.
  function wantsDoubleCheck(buckets: DoubleCheckRound[], wcaId: string, eventId: string): boolean {
    if (!dcEnabled) return false;
    if (buckets.some(b => dcRounds.has(b))) return true;
    if (!wcaId) return false; // override matches named cards only
    const evs = dcOverrides[wcaId];
    return !!evs && evs.includes(eventId);
  }

  // Front panels use the primary language; back panels use the secondary (or the
  // primary when there is none) - generalizes the old bilingual front/back split.
  const nametTagTitles = getNametTagTitleStrings(language, secondaryLanguage);
  const nametTagDutyStrings = getNametTagStrings(language);
  const shortNametTagNames = getShortNametTagNames(language);

  // ── Real-group pre-pass ─────────────────────────────────────────────────────
  // Round keys ("eventId-rN") that have at least one real group child-activity in the
  // schedule. Drives two things: the hasGroups flag, and the single-implicit-group
  // fallback below (a later round is only synthesized when it has no real groups anywhere).
  const roundsWithRealGroups = new Set<string>();
  for (const venue of wcif.schedule.venues)
    for (const room of venue.rooms)
      for (const activity of room.activities)
        if (activity.childActivities.length > 0) {
          const p = activity.activityCode.split('-');
          if (p.length >= 2) roundsWithRealGroups.add(`${p[0]}-${p[1]}`);
        }

  // Scramble-set count per round id ("333-r2") - used to pick how many implicit groups to
  // synthesize for a bare later round (organizers configure this when setting up the round).
  const roundScrambleSetCount: Record<string, number> = {};
  for (const event of wcif.events)
    for (const round of event.rounds)
      roundScrambleSetCount[round.id] = round.scrambleSetCount;

  // Accepted registrations per event id - the Round-1 field size for the advancement chain.
  const registeredCount: Record<string, number> = {};
  for (const person of wcif.persons) {
    if (!person.registration || person.registration.status !== 'accepted') continue;
    for (const eid of person.registration.eventIds)
      registeredCount[eid] = (registeredCount[eid] ?? 0) + 1;
  }

  // Yield the group-level units for a schedule activity. Normally these are the child
  // activities (one per scheduled group). When a Round >= 2 was scheduled as a bare time
  // block with no groups assigned, fall back to synthesizing implicit groups derived from the
  // round activity itself (as many as the round has scramble sets, min 1), so its blank/
  // prefilled scorecards still generate. Round 1 and rounds that already have real groups are
  // never synthesized. Synthetic ids are deterministic negatives (-(activity.id*100+g)) so the
  // two call sites agree, they never collide with real positive WCA ids, and they stay
  // invisible to the assignment-driven named/cover/nametag loops.
  interface GroupUnit { id: number; activityCode: string; startTime: string; synthetic: boolean; }
  function groupUnitsOf(activity: { id: number; activityCode: string; startTime: string; childActivities: ChildActivity[] }): GroupUnit[] {
    if (activity.childActivities.length > 0)
      return activity.childActivities.map(c => ({
        id: c.id, activityCode: c.activityCode, startTime: c.startTime, synthetic: false,
      }));
    const p = activity.activityCode.split('-');
    if (p.length === 2 && p[1].startsWith('r')) {
      const roundNum = parseInt(p[1].slice(1), 10);
      if (roundNum >= 2 && !roundsWithRealGroups.has(activity.activityCode)) {
        const n = Math.max(1, roundScrambleSetCount[activity.activityCode] ?? 1);
        const units: GroupUnit[] = [];
        for (let g = 1; g <= n; g++)
          units.push({
            id: -(activity.id * 100 + g),
            activityCode: `${activity.activityCode}-g${g}`,
            startTime: activity.startTime,
            synthetic: true,
          });
        return units;
      }
    }
    return [];
  }

  // ── Activity maps ─────────────────────────────────────────────────────────
  const activityCode: Record<number, string> = {};
  const activityStage: Record<number, string> = {};
  const startTimes: Record<string, number[]> = {};
  // Unique group codes (e.g. "g1", "g2") per round key - avoids double-counting when
  // one logical group runs simultaneously across multiple rooms/stages.
  const roundGroupCodes: Record<string, Set<string>> = {};
  const roundStages: Record<string, Set<string>> = {}; // distinct stage colors per round key

  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      // Keep only the identifying part of the room name (everything after the first word).
      // "Scène Rouge" → "rouge", "Stage" → "stage", "Main Stage" → "stage"
      const words = room.name.trim().split(/\s+/);
      const color = (words.length > 1 ? words.slice(1).join(' ') : words[0]).toLowerCase();
      for (const activity of room.activities) {
        let groupCount = 0;
        for (const child of groupUnitsOf(activity)) {
          activityCode[child.id] = child.activityCode;
          activityStage[child.id] = color;
          if (!startTimes[child.startTime]) startTimes[child.startTime] = [];
          startTimes[child.startTime].push(child.id);
          groupCount++;
          // Track unique group codes (g1, g2, …) so that one group split across
          // multiple rooms still counts as one group.
          const cParts = child.activityCode.split('-');
          if (cParts.length >= 3) {
            const rk = `${cParts[0]}-${cParts[1]}`;
            if (!roundGroupCodes[rk]) roundGroupCodes[rk] = new Set();
            roundGroupCodes[rk].add(cParts[2]);
          }
        }
        const parts = activity.activityCode.split('-');
        if (parts.length >= 2) {
          const roundKey = `${parts[0]}-${parts[1]}`;
          if (groupCount > 0) {
            if (!roundStages[roundKey]) roundStages[roundKey] = new Set();
            roundStages[roundKey].add(color);
          }
        }
      }
    }
  }

  // Derived from unique group codes - replaces the old per-room sum.
  const numGroups: Record<string, number> = Object.fromEntries(
    Object.entries(roundGroupCodes).map(([k, s]) => [k, s.size]),
  );

  // Chronological timeslot labels
  const timeslots: Record<number, string> = {};
  let slot = 1;
  for (const time of Object.keys(startTimes).sort()) {
    const stageSlots: Record<string, number[]> = {};
    for (const id of startTimes[time]) {
      const stage = activityStage[id];
      if (!stageSlots[stage]) stageSlots[stage] = [];
      stageSlots[stage].push(id);
    }
    for (const ids of Object.values(stageSlots))
      for (const id of ids) timeslots[id] = `${activityStage[id][0]}${String(slot).padStart(2, '0')}`;
    slot++;
  }

  // ── Round metadata ────────────────────────────────────────────────────────
  const numRounds: Record<string, number> = {};
  const roundCutoff: Record<string, string> = {};
  const roundLimit: Record<string, string> = {};
  const roundFormat: Record<string, ScorecardFormat> = {};
  const roundCumulative: Record<string, boolean> = {};

  for (const event of wcif.events) {
    const eid = event.id;
    if (eid === '333fm') continue;
    numRounds[eid] = event.rounds.length;
    for (const round of event.rounds) {
      const rid = round.id;
      roundCutoff[rid] = round.cutoff ? centisecondsToTime(round.cutoff.attemptResult) : '';
      roundLimit[rid] = eid === '333mbf' ? 'H1b'
        : round.timeLimit ? centisecondsToTime(round.timeLimit.centiseconds) : '';
      roundFormat[rid] = getScorecardFormat(eid, round);
      roundCumulative[rid] = round.timeLimit
        ? round.timeLimit.cumulativeRoundIds.length > 0 : false;
    }
  }

  // Expected field size per round id ("333-r2"), chained forward from event registrations.
  // Round 1's field is the accepted registration count; each later round applies the previous
  // round's advancement condition: ranking → top X (exactly that many advance), percent →
  // floor(level/100 × previous field). The chain stops at an attemptResult/absent condition
  // (downstream field unknown), so those rounds keep the flat blank fallback below.
  const roundFieldSize: Record<string, number> = {};
  for (const event of wcif.events) {
    const eid = event.id;
    if (eid === '333fm') continue;
    let field: number | null = registeredCount[eid] ?? 0;
    for (let j = 0; j < event.rounds.length - 1; j++) {
      const adv = event.rounds[j].advancementCondition;
      if (adv?.type === 'ranking') field = adv.level;
      else if (adv?.type === 'percent') field = Math.floor((adv.level / 100) * field);
      else { field = null; break; }
      roundFieldSize[`${eid}-r${j + 2}`] = field;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function centisecondsToTime(cs: number): string {
    const s = Math.floor(cs / 100);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  function getRoundLabel(eventId: string, roundNum: number): string {
    const total = numRounds[eventId] ?? 1;
    if (roundNum === total) return strings.finalRound;
    return strings.roundName(roundNum, total);
  }

  // Used when a round spans multiple stages: "Rouge 3 of 4", "Rouge 3 de 4", etc.
  function buildGroupLabel(gNum: string, colour: string, total: number): string {
    const c = colour.charAt(0).toUpperCase() + colour.slice(1);
    return strings.colorGroupLabel(c, gNum, total);
  }

  // Used when all groups for a round are in a single stage: "Group 1 of 3".
  function simpleGroupLabel(gNum: string, total: number): string {
    return strings.groupLabel(gNum, total);
  }

  function resolveGroupLabel(rid: string, gNum: string, colour: string, total: number): string {
    // Use stage-colour labels only when there are genuinely multiple logical groups
    // spread across different stages. A single group that runs on two stages
    // simultaneously still counts as one group (total === 1).
    return (roundStages[rid]?.size ?? 1) > 1 && total > 1
      ? buildGroupLabel(gNum, colour, total)
      : simpleGroupLabel(gNum, total);
  }

  function buildBlankGroupLabel(totalGroups: number): string {
    return strings.blankGroupLabel(totalGroups);
  }

  // ── Entry buckets ─────────────────────────────────────────────────────────
  const firstRoundEntries: ScorecardData[] = [];
  const intermediateEntries: ScorecardData[] = [];
  const semisEntries: ScorecardData[] = [];
  const finalsEntries: ScorecardData[] = [];

  // Round-1 participant list per event (for prefilled intermediate cards)
  const round1Participants: Record<string, ScorecardEntry[]> = {};
  // Group sizes per activity (for cover cards), keyed by activityId - covers every
  // round that has real assignments (round 1 always; rounds 2+ only when assigned).
  const namedGroupSizes: Record<number, Set<number>> = {};
  // Rounds (rid like "333-r2") with real competitor assignments and roundNum >= 2.
  // These are rendered as named scorecards and skipped by the blank/prefilled loops.
  const liveRounds = new Set<string>();
  // Whether the intermediate bucket holds any real-assignment named cards (vs prefilled
  // placeholders) - selects the finalize strategy below.
  let intermediateHasNamed = false;

  // ── Cover-card emission ───────────────────────────────────────────────────
  // Every cover in this file goes through `pushCover`, so the mode is decided in one
  // place. Covers must be gated HERE rather than filtered out later: finalizeEntries
  // sorts → pads to a multiple of 4 → quadrant-reorders for cut-and-stack, so removing
  // entries afterwards would corrupt the printed pile order.
  const checkMode = settings.scorecardCheckMode ?? 'per-group-card';
  // Collapsed 'per-round-card' covers, keyed bucket → partition. The partition is the
  // same one the sort uses (event + round + `stage`), so a collapsed cover still lands at
  // the head of its own pile. Named rounds carry `stage` and therefore get one cover per
  // stage; blank buckets have no stage key and get one cover per round.
  const roundCovers = new Map<ScorecardData[], Map<string, CoverEntry>>();

  function pushCover(target: ScorecardData[], cover: Omit<CoverEntry, 'numGroups'>): void {
    if (checkMode === 'checking-sheet' || checkMode === 'none') return;
    if (checkMode === 'per-group-card') {
      target.push({ ...cover, numGroups: 1 });
      return;
    }
    const key = `${cover.eventId}|${cover.roundNum}|${cover.stage ?? ''}`;
    let bucket = roundCovers.get(target);
    if (!bucket) { bucket = new Map(); roundCovers.set(target, bucket); }
    const existing = bucket.get(key);
    if (existing) {
      // Mutated in place - `target` already holds this object, and finalize runs later.
      existing.numScorecards += cover.numScorecards;
      existing.numGroups += 1;
      if (cover.timeslot < existing.timeslot) existing.timeslot = cover.timeslot;
      return;
    }
    // '' sorts before every real group label, keeping the cover ahead of its cards.
    const collapsed: CoverEntry = { ...cover, group: '', numGroups: 1 };
    bucket.set(key, collapsed);
    target.push(collapsed);
  }

  // ── Named scorecard entries from person assignments ───────────────────────
  for (const person of wcif.persons) {
    if (!person.registration || person.registration.status !== 'accepted') continue;

    const name = person.name.replace(/ \(.*\)$/, '');
    const isFemale = person.gender === 'f';
    const wcaId = person.wcaId
      ? person.wcaId
      : isFemale && strings.newCompetitorF !== strings.newCompetitor
        ? strings.newCompetitorF
        : strings.newCompetitor;
    const liveId = String(person.registrantId);

    for (const assignment of person.assignments) {
      if (assignment.assignmentCode !== 'competitor') continue;
      const aid = assignment.activityId;
      const code = activityCode[aid];
      if (!code) continue;

      const parts = code.split('-');
      if (parts.length < 3) continue;
      const [eventId, roundPart, groupPart] = parts;
      if (eventId === '333fm' || eventId === '333mbf') continue;

      const roundNum = parseInt(roundPart.slice(1), 10);
      const rid = `${eventId}-${roundPart}`;
      if (!roundFormat[rid]) continue;

      const total = numRounds[eventId] ?? 1;
      const isFirst = roundNum === 1;
      const isFinal = roundNum === total && total > 1;
      const isRound2 = roundNum === 2 && total >= 3;
      const isSemis = roundNum >= 3 && roundNum < total && total >= 4;

      // Round 1 is always named. Rounds 2+ are named only when groups were assigned
      // mid-competition - i.e. this competitor assignment exists in the WCIF. Route each
      // card to the bucket matching its round (same classification as the schedule loop).
      let targetBucket: ScorecardData[];
      let dcBuckets: DoubleCheckRound[];
      if (isFirst) {
        targetBucket = firstRoundEntries;
        dcBuckets = total === 1 ? ['firstRound', 'finals'] : ['firstRound'];
      } else if (isFinal) {
        targetBucket = finalsEntries;
        dcBuckets = ['finals'];
      } else if (isRound2) {
        targetBucket = intermediateEntries;
        dcBuckets = ['intermediate'];
        intermediateHasNamed = true;
      } else if (isSemis) {
        targetBucket = semisEntries;
        dcBuckets = ['semis'];
      } else {
        continue;
      }

      const gNum = groupPart.slice(1);
      const stage = activityStage[aid]?.toLowerCase() ?? 'hall';
      const totalGroups = numGroups[rid] ?? 1;

      let group: string;
      if (assignment.stationNumber != null) {
        group = strings.stationLabel(String(assignment.stationNumber).padStart(2, '0'));
      } else {
        group = resolveGroupLabel(rid, gNum, stage, totalGroups);
      }

      const entry: ScorecardEntry = {
        kind: 'scorecard',
        timeslot: timeslots[aid] ?? 'Z99',
        eventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, roundNum),
        roundNum,
        group,
        stage,
        name,
        wcaId,
        liveId,
        gender: person.gender,
        cutoff: roundCutoff[rid],
        limit: roundLimit[rid],
        format: roundFormat[rid],
        isCumulative: roundCumulative[rid],
        scrambleDoubleCheck: wantsDoubleCheck(dcBuckets, wcaId, eventId),
      };

      targetBucket.push(entry);
      if (isFirst) {
        if (!round1Participants[eventId]) round1Participants[eventId] = [];
        round1Participants[eventId].push(entry);
      } else {
        liveRounds.add(rid);
      }
      if (!namedGroupSizes[aid]) namedGroupSizes[aid] = new Set();
      namedGroupSizes[aid].add(person.registrantId);
    }
  }

  // ── Cover cards (one per group) for every named round ─────────────────────
  for (const [aidStr, ids] of Object.entries(namedGroupSizes)) {
    const aid = Number(aidStr);
    const code = activityCode[aid];
    if (!code) continue;
    const parts = code.split('-');
    if (parts.length < 3) continue;
    const [eventId, roundPart, groupPart] = parts;
    if (eventId === '333fm') continue;

    const rid = `${eventId}-${roundPart}`;
    const roundNum = parseInt(roundPart.slice(1), 10);
    const total = numRounds[eventId] ?? 1;
    const gNum = groupPart.slice(1);
    const stage = activityStage[aid]?.toLowerCase() ?? 'hall';
    const totalGroups = numGroups[rid] ?? 1;

    const isFinal = roundNum === total && total > 1;
    const isRound2 = roundNum === 2 && total >= 3;
    const isSemis = roundNum >= 3 && roundNum < total && total >= 4;
    const target = roundNum === 1 ? firstRoundEntries
      : isFinal ? finalsEntries
      : isRound2 ? intermediateEntries
      : isSemis ? semisEntries
      : null;
    if (!target) continue;

    pushCover(target, {
      kind: 'cover',
      timeslot: timeslots[aid] ?? 'Z99',
      eventId: eventId as EventId,
      eventName: getEventName(eventId, language),
      roundLabel: getRoundLabel(eventId, roundNum),
      roundNum,
      group: resolveGroupLabel(rid, gNum, stage, totalGroups),
      stage,
      numScorecards: ids.size,
    });
  }

  // ── Collect schedule data for intermediate rounds and finals ──────────────
  interface GroupInfo { gNum: string; stage: string; totalGroups: number; timeslot: string; }
  interface RoundData { eventId: string; roundNum: number; rid: string; groups: GroupInfo[]; minTs: string; }

  const finalsRounds: Record<string, RoundData> = {};
  const round2Rounds: Record<string, RoundData> = {};
  const semisRounds:  Record<string, RoundData> = {};

  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      for (const activity of room.activities) {
        for (const child of groupUnitsOf(activity)) {
          const parts = child.activityCode.split('-');
          if (parts.length < 3) continue;
          const [eventId, roundPart, groupPart] = parts;
          if (eventId === '333fm') continue;

          const roundNum = parseInt(roundPart.slice(1), 10);
          if (roundNum === 1) continue;

          const rid = `${eventId}-${roundPart}`;
          if (!roundFormat[rid]) continue;
          // Already emitted as named scorecards (groups assigned mid-competition) - don't
          // also produce blank/prefilled cards for the same round.
          if (liveRounds.has(rid)) continue;

          const total = numRounds[eventId] ?? 1;
          const isFinal        = roundNum === total && total > 1;
          const isRound2       = roundNum === 2 && total >= 3;
          // Rounds 3..N-1 of 4+ round events (semi-finals), always blank
          const isSemis        = roundNum >= 3 && roundNum < total && total >= 4;

          if (!isFinal && !isRound2 && !isSemis) continue;

          const ts = timeslots[child.id] ?? 'Z99';
          const gNum = groupPart.slice(1);
          const stage = activityStage[child.id]?.toLowerCase() ?? 'hall';
          const totalGroups = numGroups[rid] ?? 1;
          const groupInfo: GroupInfo = { gNum, stage, totalGroups, timeslot: ts };

          const target = isFinal ? finalsRounds : isRound2 ? round2Rounds : semisRounds;
          if (!target[rid]) target[rid] = { eventId, roundNum, rid, groups: [], minTs: ts };
          if (ts < target[rid].minTs) target[rid].minTs = ts;
          target[rid].groups.push(groupInfo);
        }
      }
    }
  }

  // Sort a groups array deterministically: by stage name, then by group number.
  // This ensures consistent 1-based global numbering even when each room numbers
  // its own groups starting from 1 (e.g., Stage A → g1, Stage B → g1, …).
  function sortGroups(groups: GroupInfo[]) {
    return [...groups].sort((a, b) => {
      const s = a.stage.localeCompare(b.stage);
      return s !== 0 ? s : parseInt(a.gNum, 10) - parseInt(b.gNum, 10);
    });
  }

  // ── Finals: blank entries (seat numbers only when single group in single stage) ─
  for (const { eventId, roundNum, rid, groups } of Object.values(finalsRounds)) {
    const totalGroups = groups[0]?.totalGroups ?? groups.length;
    const numStages = roundStages[rid]?.size ?? 1;
    // One logical group split across multiple stages simultaneously: each stage
    // gets its own labeled stack ("Rouge 1", "Bleu 1", …).
    const isMultiStageSingleGroup = totalGroups === 1 && numStages > 1;
    // Seat numbers only when truly one group in one stage (event+round already uniquely
    // identifies the stack; adding a group label would be redundant noise).
    const useSeatNumbers = totalGroups === 1 && numStages <= 1;
    const stageCount = isMultiStageSingleGroup ? groups.length : totalGroups;
    const field = roundFieldSize[rid];

    for (const { gNum, stage, timeslot } of sortGroups(groups)) {
      const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
      const coverLabel = isMultiStageSingleGroup
        ? `${stageName} ${gNum}`
        : resolveGroupLabel(rid, gNum, stage, totalGroups);
      const blankCount = field != null ? Math.ceil(field / stageCount) + 2 : 16;

      for (let i = 0; i < blankCount; i++) {
        const cardGroup = useSeatNumbers
          ? strings.seatLabel(String(i + 1).padStart(2, '0'))
          : coverLabel;
        finalsEntries.push({
          kind: 'scorecard', timeslot, eventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum), roundNum,
          group: cardGroup, name: '', wcaId: '', liveId: '', gender: 'm',
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
          scrambleDoubleCheck: wantsDoubleCheck(['finals'], '', eventId),
        });
      }
      pushCover(finalsEntries, {
        kind: 'cover', timeslot, eventId: eventId as EventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, roundNum), roundNum,
        group: coverLabel, numScorecards: blankCount,
      });
    }
  }

  // ── Semi-finals: always blank (same structure as finals) ─────────────────
  for (const { eventId, roundNum, rid, groups } of Object.values(semisRounds)) {
    const totalGroups = groups[0]?.totalGroups ?? groups.length;
    const numStages = roundStages[rid]?.size ?? 1;
    const isMultiStageSingleGroup = totalGroups === 1 && numStages > 1;
    const stageCount = isMultiStageSingleGroup ? groups.length : totalGroups;
    const field = roundFieldSize[rid];

    for (const { gNum, stage, timeslot } of sortGroups(groups)) {
      const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
      const groupLabel = isMultiStageSingleGroup
        ? `${stageName} ${gNum}`
        : resolveGroupLabel(rid, gNum, stage, totalGroups);
      const blankCount = field != null ? Math.ceil(field / stageCount) + 2 : 16;

      for (let i = 0; i < blankCount; i++) {
        semisEntries.push({
          kind: 'scorecard', timeslot, eventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum), roundNum,
          group: groupLabel, name: '', wcaId: '', liveId: '', gender: 'm',
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
          scrambleDoubleCheck: wantsDoubleCheck(['semis'], '', eventId),
        });
      }
      pushCover(semisEntries, {
        kind: 'cover', timeslot, eventId: eventId as EventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, roundNum), roundNum,
        group: groupLabel, numScorecards: blankCount,
      });
    }
  }

  // ── Intermediate round 2 ──────────────────────────────────────────────────
  for (const { eventId, roundNum, rid, groups, minTs } of Object.values(round2Rounds)) {
    const totalGroups = groups[0]?.totalGroups ?? groups.length;
    const numStages = roundStages[rid]?.size ?? 1;
    const isMultiStageSingleGroup = totalGroups === 1 && numStages > 1;
    const stageCount = isMultiStageSingleGroup ? groups.length : totalGroups;
    const field = roundFieldSize[rid];

    if (secondRoundMode === 'prefilled') {
      // Distribute qualifiers as evenly as possible: base per group, remainder
      // absorbed one-by-one by the first groups so the total is always exact.
      const totalQualified = field ?? (round1Participants[eventId]?.length ?? 0);
      const baseCount = Math.floor(totalQualified / stageCount);
      const extraGroups = totalQualified % stageCount;

      for (const [i, { gNum, stage }] of sortGroups(groups).entries()) {
        const numScorecards = baseCount + (i < extraGroups ? 1 : 0);
        const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
        const coverLabel = isMultiStageSingleGroup
          ? `${stageName} ${gNum}`
          : resolveGroupLabel(rid, gNum, stage, totalGroups);
        pushCover(intermediateEntries, {
          kind: 'cover', timeslot: minTs, eventId: eventId as EventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum), roundNum,
          group: coverLabel,
          numScorecards,
        });
      }

      // All round-1 participants with blank group placeholder
      const blankGroup = buildBlankGroupLabel(stageCount);
      for (const p of (round1Participants[eventId] ?? [])) {
        intermediateEntries.push({
          kind: 'scorecard', timeslot: minTs, eventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum), roundNum,
          group: blankGroup,
          name: p.name, wcaId: p.wcaId, liveId: p.liveId, gender: p.gender,
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
          scrambleDoubleCheck: wantsDoubleCheck(['intermediate'], p.wcaId, eventId),
        });
      }
    } else {
      // Blanks mode: blank entries per group
      const blankCount = field != null ? Math.ceil(field / stageCount) + 2 : 16;

      for (const { gNum, stage, timeslot } of sortGroups(groups)) {
        const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
        const groupLabel = isMultiStageSingleGroup
          ? `${stageName} ${gNum}`
          : resolveGroupLabel(rid, gNum, stage, totalGroups);
        for (let i = 0; i < blankCount; i++) {
          intermediateEntries.push({
            kind: 'scorecard', timeslot, eventId,
            eventName: getEventName(eventId, language),
            roundLabel: getRoundLabel(eventId, roundNum), roundNum,
            group: groupLabel, name: '', wcaId: '', liveId: '', gender: 'm',
            cutoff: roundCutoff[rid], limit: roundLimit[rid],
            format: roundFormat[rid], isCumulative: roundCumulative[rid],
            scrambleDoubleCheck: wantsDoubleCheck(['intermediate'], '', eventId),
          });
        }
        pushCover(intermediateEntries, {
          kind: 'cover', timeslot, eventId: eventId as EventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum), roundNum,
          group: groupLabel, numScorecards: blankCount,
        });
      }
    }
  }

  // ── Nametag entries ��─────────────────────��─────────────────────────────────
  function resolveTitle(titles: NametTagTitleStrings, role: NametTagRole, isFemale: boolean): string {
    if (role === 'delegate') return titles.delegate(isFemale);
    if (role === 'organizer') return titles.organizer(isFemale);
    if (role === 'new-competitor') return titles.newCompetitor(isFemale);
    return titles.competitor(isFemale);
  }

  const nametags: NametTagEntry[] = [];
  const firstTimers: FirstTimerEntry[] = [];
  for (const person of wcif.persons) {
    if (!person.registration || person.registration.status !== 'accepted') continue;

    const name = person.name.replace(/ \(.*\)$/, '');
    const isFemale = person.gender === 'f';

    // Newcomers (no WCA ID) get a first-timer confirmation slip.
    if (!person.wcaId) {
      const registeredSet = new Set(person.registration.eventIds as string[]);
      firstTimers.push({
        name,
        gender: person.gender,
        birthdate: person.birthdate ?? null,
        countryIso2: person.countryIso2,
        eventIds: WCA_EVENT_ORDER.filter(e => registeredSet.has(e)),
      });
    }

    let role: NametTagRole;
    if (person.roles.some(r => r === 'delegate' || r === 'trainee-delegate')) {
      role = 'delegate';
    } else if (person.roles.includes('organizer')) {
      role = 'organizer';
    } else if (!person.wcaId) {
      role = 'new-competitor';
    } else {
      role = 'competitor';
    }

    const registeredSet = new Set(person.registration.eventIds as string[]);
    const events = WCA_EVENT_ORDER.filter(e => registeredSet.has(e));
    const dutyArgs = [shortNametTagNames, nametTagDutyStrings.dutyGroup] as const;

    nametags.push({
      name,
      wcaId: person.wcaId ?? '',
      registrantId: person.registrantId,
      wcaUserId: person.wcaUserId,
      gender: person.gender,
      role,
      titleFront: resolveTitle(nametTagTitles.front, role, isFemale),
      titleBack:  resolveTitle(nametTagTitles.back,  role, isFemale),
      events,
      compete:  buildDuties(person.assignments, 'competitor',      activityCode, ...dutyArgs),
      scramble: buildDuties(person.assignments, 'staff-scrambler', activityCode, ...dutyArgs),
      judge:    buildDuties(person.assignments, 'staff-judge',     activityCode, ...dutyArgs),
      run:      buildDuties(person.assignments, 'staff-runner',    activityCode, ...dutyArgs),
    });
  }

  // Delegates → Organizers → Returning competitors → New competitors, each group alphabetically by name.
  const rolePriority = (r: NametTagRole) =>
    r === 'delegate' ? 0 : r === 'organizer' ? 1 : r === 'competitor' ? 2 : 3;
  nametags.sort((a, b) => {
    const p = rolePriority(a.role) - rolePriority(b.role);
    return p !== 0 ? p : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  // First-timer slips: alphabetical by name (matches the legacy script's sort).
  firstTimers.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // ── Extra scorecards ──────────────────────────────────────────────────────
  // Build minimum timeslot for each round (eventId-rN) from its child activities.
  const roundMinTs: Record<string, string> = {};
  for (const [aidStr, code] of Object.entries(activityCode)) {
    const parts = code.split('-');
    if (parts.length < 3) continue;
    const rk = `${parts[0]}-${parts[1]}`;
    const ts = timeslots[Number(aidStr)] ?? 'Z99';
    if (!roundMinTs[rk] || ts < roundMinTs[rk]) roundMinTs[rk] = ts;
  }

  const extrasEntries: ScorecardData[] = [];
  const extrasRounds: Array<{ ts: string; eventId: string; rid: string; roundNum: number }> = [];
  for (const event of wcif.events) {
    const eid = event.id;
    if (eid === '333fm') continue;
    for (let i = 1; i <= event.rounds.length; i++) {
      const rid = `${eid}-r${i}`;
      const ts = roundMinTs[rid];
      if (!ts || !roundFormat[rid]) continue;
      extrasRounds.push({ ts, eventId: eid, rid, roundNum: i });
    }
  }
  extrasRounds.sort((a, b) => a.ts.localeCompare(b.ts) || a.eventId.localeCompare(b.eventId));

  for (const { ts, eventId, rid, roundNum } of extrasRounds) {
    const totalGroups = numGroups[rid] ?? 1;
    const group = totalGroups === 1
      ? simpleGroupLabel('1', 1)
      : buildBlankGroupLabel(totalGroups);
    extrasEntries.push({
      kind: 'scorecard',
      timeslot: ts,
      eventId,
      eventName: getEventName(eventId, language),
      roundLabel: getRoundLabel(eventId, roundNum),
      roundNum,
      group,
      name: '', wcaId: '', liveId: '', gender: 'm',
      cutoff: roundCutoff[rid], limit: roundLimit[rid],
      format: roundFormat[rid], isCumulative: roundCumulative[rid],
    });
  }
  const extrasRem = extrasEntries.length % 4;
  if (extrasRem !== 0) for (let i = 0; i < 4 - extrasRem; i++) extrasEntries.push(EMPTY_COVER);

  // ── Schedule tracker ──────────────────────────────────────────────────────
  const timezone = wcif.schedule.venues[0]?.timezone ?? 'UTC';

  const formatLocalTime = (isoTime: string): string => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        hour: '2-digit', minute: '2-digit',
        timeZone: timezone, hour12: false,
      }).format(new Date(isoTime));
    } catch {
      return isoTime.slice(11, 16);
    }
  };

  // Extract local date "YYYY-MM-DD" using formatToParts for timezone safety.
  const getLocalDate = (isoTime: string): string => {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone,
      }).formatToParts(new Date(isoTime));
      const y = parts.find(p => p.type === 'year')?.value ?? '';
      const m = parts.find(p => p.type === 'month')?.value ?? '';
      const d = parts.find(p => p.type === 'day')?.value ?? '';
      return `${y}-${m}-${d}`;
    } catch {
      return isoTime.slice(0, 10);
    }
  };

  // Round count per event including FMC (for schedule label).
  const allEventRoundCount: Record<string, number> = {};
  for (const event of wcif.events) allEventRoundCount[event.id] = event.rounds.length;

  // Map each unique local date to its day number (1-based) across the whole competition.
  const uniqueDates = new Set<string>();
  for (const venue of wcif.schedule.venues)
    for (const room of venue.rooms)
      for (const activity of room.activities)
        uniqueDates.add(getLocalDate(activity.startTime));
  const sortedAllDates = [...uniqueDates].sort();
  const dateToDay: Record<string, number> = {};
  sortedAllDates.forEach((d, i) => { dateToDay[d] = i + 1; });

  const formatDayLabel = (localDate: string): string => {
    const dayNum = dateToDay[localDate] ?? 1;
    const locale = settings.language === 'pt' ? 'pt-BR' : settings.language;
    const prefix = getScheduleStrings(settings.language).dayPrefix;
    try {
      const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })
        .format(new Date(`${localDate}T12:00:00Z`));
      const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return `${prefix} ${dayNum} - ${capitalized}`;
    } catch {
      return `${prefix} ${dayNum}`;
    }
  };

  // Build a (date → roomIndex → activities[]) map, preserving WCIF room order via roomIndex.
  type RoomActivity = (typeof wcif.schedule.venues)[0]['rooms'][0]['activities'][0];
  const dayRoomMap = new Map<string, Map<number, RoomActivity[]>>();
  const roomIndexToName = new Map<number, string>();
  let roomIdx = 0;
  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      roomIndexToName.set(roomIdx, room.name);
      for (const activity of room.activities) {
        const date = getLocalDate(activity.startTime);
        if (!dayRoomMap.has(date)) dayRoomMap.set(date, new Map());
        const roomMap = dayRoomMap.get(date)!;
        if (!roomMap.has(roomIdx)) roomMap.set(roomIdx, []);
        roomMap.get(roomIdx)!.push(activity);
      }
      roomIdx++;
    }
  }

  const schedStrings = getScheduleStrings(settings.language);
  // One pass over a room's activities producing both the schedule-tracker rows and the
  // checking-sheet rows - they share the same filtering and event+round labelling, and
  // differ only in the trailing column (competitor count vs. group count).
  const buildRows = (activities: RoomActivity[]): { schedule: ScheduleRow[]; checking: CheckingRow[] } => {
    const schedule: ScheduleRow[] = [];
    const checking: CheckingRow[] = [];
    const sorted = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const activity of sorted) {
      const parts = activity.activityCode.split('-');
      if (parts.length !== 2) continue;
      const [eid, roundPart] = parts;
      if (!roundPart.startsWith('r')) continue;
      const roundNum = parseInt(roundPart.slice(1), 10);
      if (!isFinite(roundNum)) continue;
      const totalRounds = allEventRoundCount[eid];
      if (totalRounds === undefined) continue;
      const eventName = getEventName(eid, settings.language);
      const isLast = roundNum === totalRounds;
      const roundLabel = totalRounds === 1 || isLast
        ? schedStrings.finalLabel
        : schedStrings.roundLabel(roundNum);
      const startTime = formatLocalTime(activity.startTime);
      const endTime = formatLocalTime(activity.endTime);
      const eventRound = `${eventName} ${roundLabel}`;
      schedule.push({ startTime, endTime, eventRound });
      // groupUnitsOf also synthesizes groups for later rounds that have none yet
      // (from the scramble-set count), matching the scorecards actually printed.
      checking.push({ startTime, endTime, eventRound, groupCount: groupUnitsOf(activity).length });
    }
    return { schedule, checking };
  };

  // Iterate days chronologically; within each day keep WCIF room order.
  const scheduleDays: ScheduleDay[] = [];
  const checkingDays: CheckingDay[] = [];
  for (const [date, roomMap] of [...dayRoomMap].sort(([a], [b]) => a.localeCompare(b))) {
    const stages: ScheduleStage[] = [];
    const checkStages: CheckingStage[] = [];
    for (const [ri, activities] of [...roomMap].sort(([a], [b]) => a - b)) {
      const { schedule, checking } = buildRows(activities);
      const stageName = roomIndexToName.get(ri) ?? `Room ${ri + 1}`;
      if (schedule.length > 0) stages.push({ stageName, rows: schedule });
      if (checking.length > 0) checkStages.push({ stageName, rows: checking });
    }
    const dayLabel = formatDayLabel(date);
    if (stages.length > 0) scheduleDays.push({ dayLabel, stages });
    if (checkStages.length > 0) checkingDays.push({ dayLabel, stages: checkStages });
  }

  // Named round-2 cards carry real groups + covers, so they need the group-sorted
  // finalize (cover immediately before its own group). The placeholder-group prefilled
  // layout only needs its special finalize when no real assignments are present.
  const laterRoundsWithAssignments = [...liveRounds]
    .map((rid) => {
      const [eventId, roundPart] = rid.split('-');
      return { eventId, roundNum: parseInt(roundPart.slice(1), 10) };
    })
    .sort((a, b) =>
      (WCA_EVENT_ORDER.indexOf(a.eventId as EventId) - WCA_EVENT_ORDER.indexOf(b.eventId as EventId))
      || (a.roundNum - b.roundNum),
    );

  return {
    firstRound: finalizeEntries(firstRoundEntries),
    intermediate: secondRoundMode === 'prefilled' && !intermediateHasNamed
      ? finalizeEntriesIntermediate(intermediateEntries)
      : finalizeEntries(intermediateEntries),
    semis:  finalizeEntries(semisEntries),
    finals: finalizeEntries(finalsEntries),
    nametags,
    firstTimers,
    extras: extrasEntries,
    scheduleDays,
    checkingDays,
    laterRoundsWithAssignments,
    // Real (non-synthesized) round-1+ groups only, so a fresh WCIF whose later rounds get
    // an implicit single group still reports "no groups assigned yet".
    hasGroups: roundsWithRealGroups.size > 0,
  };
}
