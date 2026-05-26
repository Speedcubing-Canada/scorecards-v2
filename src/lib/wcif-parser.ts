import type { WCIF, Round, EventId, Assignment } from '../types/wcif';
import type { CompetitionSettings } from '../types/settings';
import { getStrings, getEventName } from './i18n';

export type ScorecardFormat = 'avg5' | 'bo2-avg5' | 'mo3' | 'bo1-mo3' | 'bo2';

// ── Nametag types ─────────────────────────────────────────────────────────────

// Short event names for nametag duty labels (always French/bilingual style)
const SHORT_NAMETAG_NAMES: Record<string, string> = {
  '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
  '666': '6x6x6', '777': '7x7x7', '333bf': '3x3x3 BLD', '333fm': 'FMC',
  '333oh': 'À une main', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 BLD', '555bf': '5x5x5 BLD',
  '333mbf': 'Multi-BLD',
};

const WCA_EVENT_ORDER: EventId[] = [
  '333','222','444','555','666','777','333bf','333fm','333oh',
  'clock','minx','pyram','skewb','sq1','444bf','555bf','333mbf',
];

export interface NametTagEntry {
  name: string;
  wcaId: string;
  registrantId: number;
  wcaUserId: number;
  gender: 'm' | 'f' | 'o';
  titleEn: string;
  titleFr: string;
  events: EventId[];
  compete: string[];
  scramble: string[];
  judge: string[];
  run: string[];
}

function buildDuties(
  assignments: Assignment[],
  code: Assignment['assignmentCode'],
  activityCodeMap: Record<number, string>,
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
      const shortName = SHORT_NAMETAG_NAMES[eventId] ?? eventId;
      const groupList = [...groups].sort((a, b) => a - b).join(' & ');
      return `${shortName}: Groupe ${groupList}`;
    })
    .sort();
}

export interface ScorecardEntry {
  kind: 'scorecard';
  timeslot: string;
  eventId: string;
  eventName: string;
  roundLabel: string;
  group: string;
  name: string;
  wcaId: string;
  liveId: string;
  gender: string;
  cutoff: string;
  limit: string;
  format: ScorecardFormat;
  isCumulative: boolean;
}

export interface CoverEntry {
  kind: 'cover';
  timeslot: string;
  eventId: string;
  eventName: string;
  roundLabel: string;
  group: string;
  numScorecards: number;
}

export type ScorecardData = ScorecardEntry | CoverEntry;

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
}

const EMPTY_COVER: CoverEntry = {
  kind: 'cover', timeslot: 'ZZZ', eventId: '' as EventId,
  eventName: '', roundLabel: '', group: '', numScorecards: 0,
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

// Standard finalize: sort by timeslot → eventId → group → cover-before-scorecard → name.
// Sorting by group before kind keeps each group's cover immediately before its own scorecards,
// so that after quad-reorder the cut-and-stack produces one correctly ordered pile per group.
function finalizeEntries(entries: ScorecardData[]): ScorecardData[] {
  if (entries.length === 0) return [];
  entries.sort((a, b) => {
    const ts = a.timeslot.localeCompare(b.timeslot);
    if (ts !== 0) return ts;
    const ev = a.eventId.localeCompare(b.eventId);
    if (ev !== 0) return ev;
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
  const { language, secondRoundMode } = settings;
  const strings = getStrings(language);

  // ── Activity maps ─────────────────────────────────────────────────────────
  const activityCode: Record<number, string> = {};
  const activityStage: Record<number, string> = {};
  const startTimes: Record<string, number[]> = {};
  // Unique group codes (e.g. "g1", "g2") per round key — avoids double-counting when
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
        for (const child of activity.childActivities) {
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

  // Derived from unique group codes — replaces the old per-room sum.
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
  const roundAdvancement: Record<string, { type: string; level: number } | null> = {};

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
      roundAdvancement[rid] = round.advancementCondition;
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
    if (language === 'fr' || language === 'bilingual-fr') return `${c} ${gNum} de ${total}`;
    return `${c} ${gNum} of ${total}`;
  }

  // Used when all groups for a round are in a single stage: "Group 1 of 3".
  function simpleGroupLabel(gNum: string, total: number): string {
    if (language === 'fr' || language === 'bilingual-fr') return `Groupe ${gNum} de ${total}`;
    return `Group ${gNum} of ${total}`;
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
    if (language === 'fr' || language === 'bilingual-fr') return `Groupe _ de ${totalGroups}`;
    return `Group _ of ${totalGroups}`;
  }

  // ── Entry buckets ─────────────────────────────────────────────────────────
  const firstRoundEntries: ScorecardData[] = [];
  const intermediateEntries: ScorecardData[] = [];
  const semisEntries: ScorecardData[] = [];
  const finalsEntries: ScorecardData[] = [];

  // Round-1 participant list per event (for prefilled intermediate cards)
  const round1Participants: Record<string, ScorecardEntry[]> = {};
  // Group sizes per activity (for first-round cover cards)
  const firstGroupSizes: Record<number, Set<number>> = {};

  // ── Named scorecard entries from person assignments ───────────────────────
  for (const person of wcif.persons) {
    if (!person.registration || person.registration.status !== 'accepted') continue;

    const name = person.name.replace(/ \(.*\)$/, '');
    const isFemale = person.gender === 'f';
    const wcaId = person.wcaId
      ? person.wcaId
      : language === 'fr' || language === 'bilingual-fr'
        ? (isFemale ? strings.newCompetitorF : strings.newCompetitor)
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
      // Only add named entries for round 1
      if (!isFirst) continue;

      const gNum = groupPart.slice(1);
      const stage = activityStage[aid]?.toLowerCase() ?? 'hall';
      const totalGroups = numGroups[rid] ?? 1;

      let group: string;
      if (assignment.stationNumber != null) {
        group = language === 'fr' || language === 'bilingual-fr'
          ? `Siège ${String(assignment.stationNumber).padStart(2, '0')}`
          : `Station ${String(assignment.stationNumber).padStart(2, '0')}`;
      } else {
        group = resolveGroupLabel(rid, gNum, stage, totalGroups);
      }

      const entry: ScorecardEntry = {
        kind: 'scorecard',
        timeslot: timeslots[aid] ?? 'Z99',
        eventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, total === 1 ? 1 : roundNum),
        group,
        name,
        wcaId,
        liveId,
        gender: person.gender,
        cutoff: roundCutoff[rid],
        limit: roundLimit[rid],
        format: roundFormat[rid],
        isCumulative: roundCumulative[rid],
      };

      firstRoundEntries.push(entry);
      if (!round1Participants[eventId]) round1Participants[eventId] = [];
      round1Participants[eventId].push(entry);
      if (!firstGroupSizes[aid]) firstGroupSizes[aid] = new Set();
      firstGroupSizes[aid].add(person.registrantId);
    }
  }

  // ── Cover cards for round 1 ───────────────────────────────────────────────
  for (const [aidStr, ids] of Object.entries(firstGroupSizes)) {
    const aid = Number(aidStr);
    const code = activityCode[aid];
    if (!code) continue;
    const parts = code.split('-');
    if (parts.length < 3) continue;
    const [eventId, roundPart, groupPart] = parts;
    if (eventId === '333fm') continue;

    const rid = `${eventId}-${roundPart}`;
    const gNum = groupPart.slice(1);
    const stage = activityStage[aid]?.toLowerCase() ?? 'hall';
    const totalGroups = numGroups[rid] ?? 1;

    firstRoundEntries.push({
      kind: 'cover',
      timeslot: timeslots[aid] ?? 'Z99',
      eventId: eventId as EventId,
      eventName: getEventName(eventId, language),
      roundLabel: getRoundLabel(eventId, 1),
      group: resolveGroupLabel(rid, gNum, stage, totalGroups),
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
        for (const child of activity.childActivities) {
          const parts = child.activityCode.split('-');
          if (parts.length < 3) continue;
          const [eventId, roundPart, groupPart] = parts;
          if (eventId === '333fm') continue;

          const roundNum = parseInt(roundPart.slice(1), 10);
          if (roundNum === 1) continue;

          const rid = `${eventId}-${roundPart}`;
          if (!roundFormat[rid]) continue;

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
    const prevRid = `${eventId}-r${roundNum - 1}`;
    const advCond = roundAdvancement[prevRid];
    // One logical group split across multiple stages simultaneously: each stage
    // gets its own labeled stack ("Rouge 1", "Bleu 1", …).
    const isMultiStageSingleGroup = totalGroups === 1 && numStages > 1;
    // Seat numbers only when truly one group in one stage (event+round already uniquely
    // identifies the stack; adding a group label would be redundant noise).
    const useSeatNumbers = totalGroups === 1 && numStages <= 1;
    const stageCount = isMultiStageSingleGroup ? groups.length : totalGroups;

    for (const { gNum, stage, timeslot } of sortGroups(groups)) {
      const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
      const coverLabel = isMultiStageSingleGroup
        ? `${stageName} ${gNum}`
        : resolveGroupLabel(rid, gNum, stage, totalGroups);
      const blankCount = advCond?.type === 'ranking'
        ? Math.ceil(advCond.level / stageCount) + 2
        : 16;

      for (let i = 0; i < blankCount; i++) {
        const cardGroup = useSeatNumbers
          ? (language === 'fr' || language === 'bilingual-fr'
              ? `Siège ${String(i + 1).padStart(2, '0')}`
              : `Seat ${String(i + 1).padStart(2, '0')}`)
          : coverLabel;
        finalsEntries.push({
          kind: 'scorecard', timeslot, eventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum),
          group: cardGroup, name: '', wcaId: '', liveId: '', gender: 'm',
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
        });
      }
      finalsEntries.push({
        kind: 'cover', timeslot, eventId: eventId as EventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, roundNum),
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
    const prevRid = `${eventId}-r${roundNum - 1}`;
    const advCond = roundAdvancement[prevRid];

    for (const { gNum, stage, timeslot } of sortGroups(groups)) {
      const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
      const groupLabel = isMultiStageSingleGroup
        ? `${stageName} ${gNum}`
        : resolveGroupLabel(rid, gNum, stage, totalGroups);
      const blankCount = advCond?.type === 'ranking'
        ? Math.ceil(advCond.level / stageCount) + 2
        : 16;

      for (let i = 0; i < blankCount; i++) {
        semisEntries.push({
          kind: 'scorecard', timeslot, eventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum),
          group: groupLabel, name: '', wcaId: '', liveId: '', gender: 'm',
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
        });
      }
      semisEntries.push({
        kind: 'cover', timeslot, eventId: eventId as EventId,
        eventName: getEventName(eventId, language),
        roundLabel: getRoundLabel(eventId, roundNum),
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
    const prevRid = `${eventId}-r${roundNum - 1}`;
    const advCond = roundAdvancement[prevRid];

    if (secondRoundMode === 'prefilled') {
      // Distribute qualifiers as evenly as possible: base per group, remainder
      // absorbed one-by-one by the first groups so the total is always exact.
      const totalQualified = advCond?.type === 'ranking'
        ? advCond.level
        : (round1Participants[eventId]?.length ?? 0);
      const baseCount = Math.floor(totalQualified / stageCount);
      const extraGroups = totalQualified % stageCount;

      for (const [i, { gNum, stage }] of sortGroups(groups).entries()) {
        const numScorecards = baseCount + (i < extraGroups ? 1 : 0);
        const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
        const coverLabel = isMultiStageSingleGroup
          ? `${stageName} ${gNum}`
          : resolveGroupLabel(rid, gNum, stage, totalGroups);
        intermediateEntries.push({
          kind: 'cover', timeslot: minTs, eventId: eventId as EventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum),
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
          roundLabel: getRoundLabel(eventId, roundNum),
          group: blankGroup,
          name: p.name, wcaId: p.wcaId, liveId: p.liveId, gender: p.gender,
          cutoff: roundCutoff[rid], limit: roundLimit[rid],
          format: roundFormat[rid], isCumulative: roundCumulative[rid],
        });
      }
    } else {
      // Blanks mode: blank entries per group
      const blankCount = advCond?.type === 'ranking'
        ? Math.ceil(advCond.level / stageCount) + 2
        : 16;

      for (const { gNum, stage, timeslot } of sortGroups(groups)) {
        const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
        const groupLabel = isMultiStageSingleGroup
          ? `${stageName} ${gNum}`
          : resolveGroupLabel(rid, gNum, stage, totalGroups);
        for (let i = 0; i < blankCount; i++) {
          intermediateEntries.push({
            kind: 'scorecard', timeslot, eventId,
            eventName: getEventName(eventId, language),
            roundLabel: getRoundLabel(eventId, roundNum),
            group: groupLabel, name: '', wcaId: '', liveId: '', gender: 'm',
            cutoff: roundCutoff[rid], limit: roundLimit[rid],
            format: roundFormat[rid], isCumulative: roundCumulative[rid],
          });
        }
        intermediateEntries.push({
          kind: 'cover', timeslot, eventId: eventId as EventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum),
          group: groupLabel, numScorecards: blankCount,
        });
      }
    }
  }

  // ── Nametag entries ────────────────────────────────────────────────────────
  const nametags: NametTagEntry[] = [];
  for (const person of wcif.persons) {
    if (!person.registration || person.registration.status !== 'accepted') continue;

    const name = person.name.replace(/ \(.*\)$/, '');
    const isFemale = person.gender === 'f';

    let titleEn: string;
    let titleFr: string;
    if (person.roles.some(r => r === 'delegate' || r === 'trainee-delegate')) {
      titleEn = 'DELEGATE'; titleFr = isFemale ? 'DÉLÉGUÉE' : 'DÉLÉGUÉ';
    } else if (person.roles.includes('organizer')) {
      titleEn = 'ORGANIZER'; titleFr = isFemale ? 'ORGANISATRICE' : 'ORGANISATEUR';
    } else if (!person.wcaId) {
      titleEn = 'NEW COMPETITOR'; titleFr = isFemale ? 'NOUVELLE COMPÉTITRICE' : 'NOUVEAU COMPÉTITEUR';
    } else {
      titleEn = 'COMPETITOR'; titleFr = isFemale ? 'COMPÉTITRICE' : 'COMPÉTITEUR';
    }

    const registeredSet = new Set(person.registration.eventIds as string[]);
    const events = WCA_EVENT_ORDER.filter(e => registeredSet.has(e));

    nametags.push({
      name,
      wcaId: person.wcaId ?? '',
      registrantId: person.registrantId,
      wcaUserId: person.wcaUserId,
      gender: person.gender,
      titleEn,
      titleFr,
      events,
      compete:  buildDuties(person.assignments, 'competitor',      activityCode),
      scramble: buildDuties(person.assignments, 'staff-scrambler', activityCode),
      judge:    buildDuties(person.assignments, 'staff-judge',     activityCode),
      run:      buildDuties(person.assignments, 'staff-runner',    activityCode),
    });
  }

  // Delegates → Organizers → Competitors, each group alphabetically by name.
  const rolePriority = (t: string) =>
    t === 'DELEGATE' ? 0 : t === 'ORGANIZER' ? 1 : 2;
  nametags.sort((a, b) => {
    const p = rolePriority(a.titleEn) - rolePriority(b.titleEn);
    return p !== 0 ? p : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return {
    firstRound: finalizeEntries(firstRoundEntries),
    intermediate: secondRoundMode === 'prefilled'
      ? finalizeEntriesIntermediate(intermediateEntries)
      : finalizeEntries(intermediateEntries),
    semis:  finalizeEntries(semisEntries),
    finals: finalizeEntries(finalsEntries),
    nametags,
  };
}
