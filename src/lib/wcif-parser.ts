import type { WCIF, Round, EventId } from '../types/wcif';
import type { CompetitionSettings } from '../types/settings';
import { getStrings, getEventName } from './i18n';

export type ScorecardFormat = 'avg5' | 'bo2-avg5' | 'mo3' | 'bo1-mo3' | 'bo2';

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
  // Rounds 2..N-1 of events with 3+ rounds.
  // Prefilled: N covers + all round-1 participants (blank group "Group _ of N").
  // Blanks: blank entries per group.
  intermediate: ScorecardData[];
  // Final round of every event with 2+ rounds. Always blank.
  finals: ScorecardData[];
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

// Standard finalize: sort by timeslot → cover-before-scorecard → name, pad, quad-reorder.
function finalizeEntries(entries: ScorecardData[]): ScorecardData[] {
  if (entries.length === 0) return [];
  entries.sort((a, b) => {
    const ts = a.timeslot.localeCompare(b.timeslot);
    if (ts !== 0) return ts;
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
  const numGroups: Record<string, number> = {};

  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      const stage = room.name.split(' ')[0];
      for (const activity of room.activities) {
        let groupCount = 0;
        for (const child of activity.childActivities) {
          activityCode[child.id] = child.activityCode;
          activityStage[child.id] = stage;
          if (!startTimes[child.startTime]) startTimes[child.startTime] = [];
          startTimes[child.startTime].push(child.id);
          groupCount++;
        }
        const parts = activity.activityCode.split('-');
        if (parts.length >= 2) {
          const roundKey = `${parts[0]}-${parts[1]}`;
          numGroups[roundKey] = (numGroups[roundKey] ?? 0) + groupCount;
        }
      }
    }
  }

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
      roundLimit[rid] = eid === '333mbf' ? 'H1b' : centisecondsToTime(round.timeLimit.centiseconds);
      roundFormat[rid] = getScorecardFormat(eid, round);
      roundCumulative[rid] = round.timeLimit.cumulativeRoundIds.length > 0;
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

  function buildGroupLabel(gNum: string, colour: string, total: number, roomNames: string[]): string {
    let label = `${colour.charAt(0).toUpperCase() + colour.slice(1)} ${gNum}`;
    for (const name of roomNames) label = label.replace(new RegExp(`^${name}\\s*`, 'i'), 'Group ');
    if (!/^Group/i.test(label)) label = `Group ${gNum}`;
    label += ` of ${total}`;
    return label;
  }

  function applyLang(rawGroup: string): string {
    if (language === 'fr' || language === 'bilingual-fr')
      return rawGroup.replace(/^Group/i, 'Groupe').replace(/ of /, ' de ');
    return rawGroup;
  }

  function buildBlankGroupLabel(totalGroups: number): string {
    if (language === 'fr' || language === 'bilingual-fr') return `Groupe _ de ${totalGroups}`;
    return `Group _ of ${totalGroups}`;
  }

  const roomNames = wcif.schedule.venues.flatMap(v => v.rooms.map(r => r.name.split(' ')[0]));

  // ── Entry buckets ─────────────────────────────────────────────────────────
  const firstRoundEntries: ScorecardData[] = [];
  const intermediateEntries: ScorecardData[] = [];
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
        group = applyLang(buildGroupLabel(gNum, stage, totalGroups, roomNames));
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
      group: applyLang(buildGroupLabel(gNum, stage, totalGroups, roomNames)),
      numScorecards: ids.size,
    });
  }

  // ── Collect schedule data for intermediate rounds and finals ──────────────
  interface GroupInfo { gNum: string; stage: string; totalGroups: number; timeslot: string; }
  interface RoundData { eventId: string; roundNum: number; rid: string; groups: GroupInfo[]; minTs: string; }

  const finalsRounds: Record<string, RoundData> = {};
  const intermRounds: Record<string, RoundData> = {};

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
          const isFinal = roundNum === total && total > 1;
          // Intermediate: only for events with 3+ rounds, rounds 2..N-1
          const isIntermediate = total >= 3 && roundNum < total;

          if (!isFinal && !isIntermediate) continue;

          const ts = timeslots[child.id] ?? 'Z99';
          const gNum = groupPart.slice(1);
          const stage = activityStage[child.id]?.toLowerCase() ?? 'hall';
          const totalGroups = numGroups[rid] ?? 1;
          const groupInfo: GroupInfo = { gNum, stage, totalGroups, timeslot: ts };

          const target = isFinal ? finalsRounds : intermRounds;
          if (!target[rid]) target[rid] = { eventId, roundNum, rid, groups: [], minTs: ts };
          if (ts < target[rid].minTs) target[rid].minTs = ts;
          target[rid].groups.push(groupInfo);
        }
      }
    }
  }

  // ── Finals: blank entries (seat numbers when single group) ────────────────
  for (const { eventId, roundNum, rid, groups } of Object.values(finalsRounds)) {
    const totalGroups = groups[0]?.totalGroups ?? groups.length;
    const useSeatNumbers = totalGroups === 1;
    const prevRid = `${eventId}-r${roundNum - 1}`;
    const advCond = roundAdvancement[prevRid];

    for (const { gNum, stage, timeslot } of groups) {
      const groupLabel = applyLang(buildGroupLabel(gNum, stage, totalGroups, roomNames));
      let blankCount: number;
      if (advCond?.type === 'ranking') blankCount = Math.ceil(advCond.level / totalGroups) + 2;
      else blankCount = 16;

      for (let i = 0; i < blankCount; i++) {
        const cardGroup = useSeatNumbers
          ? (language === 'fr' || language === 'bilingual-fr'
              ? `Siège ${String(i + 1).padStart(2, '0')}`
              : `Seat ${String(i + 1).padStart(2, '0')}`)
          : groupLabel;
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
        group: groupLabel, numScorecards: blankCount,
      });
    }
  }

  // ── Intermediate rounds ───────────────────────────────────────────────────
  for (const { eventId, roundNum, rid, groups, minTs } of Object.values(intermRounds)) {
    const totalGroups = groups[0]?.totalGroups ?? groups.length;
    const prevRid = `${eventId}-r${roundNum - 1}`;
    const advCond = roundAdvancement[prevRid];

    if (secondRoundMode === 'prefilled') {
      // N cover cards (one per group)
      const numScorecards = advCond?.type === 'ranking'
        ? Math.ceil(advCond.level / totalGroups)
        : Math.ceil((round1Participants[eventId]?.length ?? 0) / totalGroups);

      for (const { gNum, stage } of groups) {
        intermediateEntries.push({
          kind: 'cover', timeslot: minTs, eventId: eventId as EventId,
          eventName: getEventName(eventId, language),
          roundLabel: getRoundLabel(eventId, roundNum),
          group: applyLang(buildGroupLabel(gNum, stage, totalGroups, roomNames)),
          numScorecards,
        });
      }

      // All round-1 participants with blank group placeholder
      const blankGroup = buildBlankGroupLabel(totalGroups);
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
      let blankCount: number;
      if (advCond?.type === 'ranking') blankCount = Math.ceil(advCond.level / totalGroups) + 2;
      else blankCount = 16;

      for (const { gNum, stage, timeslot } of groups) {
        const groupLabel = applyLang(buildGroupLabel(gNum, stage, totalGroups, roomNames));
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

  return {
    firstRound: finalizeEntries(firstRoundEntries),
    intermediate: secondRoundMode === 'prefilled'
      ? finalizeEntriesIntermediate(intermediateEntries)
      : finalizeEntries(intermediateEntries),
    finals: finalizeEntries(finalsEntries),
  };
}
