import { describe, it, expect, beforeEach } from 'vitest';
import { parseWCIF } from './wcif-parser';
import type { ScorecardEntry, CoverEntry, ScorecardData } from './wcif-parser';
import type {
  WCIF, Event, Round, RoundFormat, Activity, ChildActivity,
  Room, Person, EventId, AdvancementCondition,
} from '../types/wcif';
import type { CompetitionSettings } from '../types/settings';

// ── Builder helpers ──────────────────────────────────────────────────────────

let _id = 0;
const uid = () => ++_id;
beforeEach(() => { _id = 0; });

const BASE: CompetitionSettings = {
  competitionId: 'TC2024', competitionName: 'Test Comp 2024',
  language: 'en', paperFormat: 'A4', secondRoundMode: 'blanks', logoDataUrl: null, wcaLiveId: null,
};
const cfg = (o: Partial<CompetitionSettings> = {}): CompetitionSettings => ({ ...BASE, ...o });

type RoundSpec = Omit<Round, 'id'>;

// Build a round spec. limitCs=null → no time limit; limitCs=undefined → default 3 min.
function rSpec(format: RoundFormat, opts: {
  cutoffCs?: number;
  limitCs?: number | null;
  cumulative?: string[];
  adv?: AdvancementCondition | null;
} = {}): RoundSpec {
  const { cutoffCs, limitCs, cumulative = [], adv = null } = opts;
  return {
    format,
    timeLimit: limitCs === null ? null : { centiseconds: limitCs ?? 18000, cumulativeRoundIds: cumulative },
    cutoff: cutoffCs !== undefined ? { numberOfAttempts: 2, attemptResult: cutoffCs } : null,
    advancementCondition: adv,
    scrambleSetCount: 1,
    results: [],
  };
}

function evt(id: EventId, rounds: RoundSpec[]): Event {
  return { id, rounds: rounds.map((r, i) => ({ ...r, id: `${id}-r${i + 1}` })), qualification: null };
}

// Child activity — id must be unique within the test; use 100+ to avoid uid() collisions.
function ch(id: number, eventId: string, r: number, g: number, t = '2024-01-01T09:00:00Z'): ChildActivity {
  return {
    id, name: '',
    activityCode: `${eventId}-r${r}-g${g}`,
    startTime: t, endTime: t,
    childActivities: [], scrambleSets: [],
  };
}

function act(eventId: string, r: number, children: ChildActivity[]): Activity {
  return {
    id: uid(), name: '',
    activityCode: `${eventId}-r${r}`,
    startTime: children[0]?.startTime ?? '2024-01-01T09:00:00Z',
    endTime: '2024-01-01T10:00:00Z',
    childActivities: children, scrambleSets: [],
  };
}

function room(name: string, activities: Activity[]): Room {
  return { id: uid(), name, color: '#fff', activities };
}

type PersonOpts = {
  name?: string;
  wcaId?: string | null;
  gender?: 'm' | 'f' | 'o';
  status?: 'accepted' | 'pending' | 'deleted';
};
function per(
  registrantId: number,
  assignments: Array<{ aid: number; station?: number | null }>,
  opts: PersonOpts = {},
): Person {
  const { name = `P${registrantId}`, wcaId = `2024T${registrantId}`, gender = 'm', status = 'accepted' } = opts;
  return {
    registrantId, name,
    wcaUserId: registrantId, wcaId,
    countryIso2: 'FR', gender,
    registration: { wcaRegistrationId: registrantId, eventIds: ['333' as EventId], status, isCompeting: true },
    avatar: null, roles: [], personalBests: [],
    assignments: assignments.map(a => ({
      activityId: a.aid, assignmentCode: 'competitor', stationNumber: a.station ?? null,
    })),
  };
}

function mkWCIF(events: Event[], rooms: Room[], persons: Person[] = []): WCIF {
  return {
    formatVersion: '1.0', id: 'TC2024', name: 'Test Comp 2024', shortName: 'TC24',
    persons, events,
    schedule: {
      startDate: '2024-01-01', numberOfDays: 1,
      venues: [{
        id: 1, name: 'Venue', latitudeMicrodegrees: 0, longitudeMicrodegrees: 0,
        countryIso2: 'FR', timezone: 'Europe/Paris', rooms,
      }],
    },
    competitorLimit: null,
  };
}

// Filter helpers (exclude empty padding covers)
const scs = (entries: ScorecardData[]) =>
  entries.filter((e): e is ScorecardEntry => e.kind === 'scorecard');
const cvs = (entries: ScorecardData[]) =>
  entries.filter((e): e is CoverEntry => e.kind === 'cover' && !!e.eventId);

// ── Format selection ─────────────────────────────────────────────────────────

describe('scorecard format selection', () => {
  function fmtFor(eventId: EventId, roundSpec: RoundSpec): string | undefined {
    const c = ch(100, eventId, 1, 1);
    const e = evt(eventId, [roundSpec]);
    const r = room('Stage', [act(eventId, 1, [c])]);
    const p = per(1, [{ aid: 100 }]);
    const result = parseWCIF(mkWCIF([e], [r], [p]), cfg());
    return scs(result.firstRound).find(s => s.eventId === eventId)?.format;
  }

  it('avg5 for ao5 without cutoff', () => expect(fmtFor('333', rSpec('a'))).toBe('avg5'));
  it('bo2-avg5 for ao5 with cutoff', () => expect(fmtFor('333', rSpec('a', { cutoffCs: 3000 }))).toBe('bo2-avg5'));
  it('mo3 for format 3 without cutoff', () => expect(fmtFor('333', rSpec('3'))).toBe('mo3'));
  it('mo3 for format m without cutoff', () => expect(fmtFor('333', rSpec('m'))).toBe('mo3'));
  it('bo1-mo3 for format 3 with cutoff', () => expect(fmtFor('333', rSpec('3', { cutoffCs: 3000 }))).toBe('bo1-mo3'));
  it('bo2 for best-of-2 format', () => expect(fmtFor('skewb', rSpec('2'))).toBe('bo2'));

  it('forces 444bf to mo3 regardless of WCIF format', () => {
    expect(fmtFor('444bf', rSpec('2'))).toBe('mo3');
  });

  it('forces 444bf to bo1-mo3 when cutoff present', () => {
    expect(fmtFor('444bf', rSpec('2', { cutoffCs: 60000 }))).toBe('bo1-mo3');
  });

  it('forces 555bf to mo3 regardless of WCIF format', () => {
    expect(fmtFor('555bf', rSpec('2'))).toBe('mo3');
  });

  it('333bf is NOT in blind set — stays avg5', () => {
    expect(fmtFor('333bf', rSpec('a'))).toBe('avg5');
  });

  it('333mbf always bo2 — verified via finals blank cards', () => {
    // 333mbf persons are skipped in named assignments; test via blank finals cards.
    const c2 = ch(101, '333mbf', 2, 1, '2024-01-01T14:00:00Z');
    const e = evt('333mbf', [rSpec('2'), rSpec('2')]);
    const r = room('Stage', [
      act('333mbf', 1, [ch(100, '333mbf', 1, 1)]),
      act('333mbf', 2, [c2]),
    ]);
    const result = parseWCIF(mkWCIF([e], [r]), cfg());
    expect(scs(result.finals)[0]?.format).toBe('bo2');
  });

  it('null timeLimit does not throw and produces empty limit string', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a', { limitCs: null })]);
    const r = room('Stage', [act('333', 1, [c])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    const sc = scs(result.firstRound)[0];
    expect(sc?.limit).toBe('');
    expect(sc?.isCumulative).toBe(false);
  });
});

// ── Round categorisation ─────────────────────────────────────────────────────

describe('round categorisation', () => {
  function mkNRounds(n: number) {
    const rounds = Array.from({ length: n }, () => rSpec('a'));
    const activities = Array.from({ length: n }, (_, i) => {
      const t = `2024-01-01T${String(9 + i).padStart(2, '0')}:00:00Z`;
      return act('333', i + 1, [ch(100 + i, '333', i + 1, 1, t)]);
    });
    const e = evt('333', rounds);
    const r = room('Stage', activities);
    const p = per(1, [{ aid: 100 }]); // assigned to round 1
    return parseWCIF(mkWCIF([e], [r], [p]), cfg());
  }

  it('1-round event: only firstRound is non-empty', () => {
    const result = mkNRounds(1);
    expect(scs(result.firstRound).length).toBeGreaterThan(0);
    expect(result.intermediate.length).toBe(0);
    expect(result.semis.length).toBe(0);
    expect(result.finals.length).toBe(0);
  });

  it('2-round event: firstRound and finals; no intermediate or semis', () => {
    const result = mkNRounds(2);
    expect(scs(result.firstRound).length).toBeGreaterThan(0);
    expect(result.intermediate.length).toBe(0);
    expect(result.semis.length).toBe(0);
    expect(scs(result.finals).length).toBeGreaterThan(0);
  });

  it('3-round event: firstRound, intermediate, finals; no semis', () => {
    const result = mkNRounds(3);
    expect(scs(result.firstRound).length).toBeGreaterThan(0);
    expect([...scs(result.intermediate), ...cvs(result.intermediate)].length).toBeGreaterThan(0);
    expect(result.semis.length).toBe(0);
    expect(scs(result.finals).length).toBeGreaterThan(0);
  });

  it('4-round event: all four buckets are non-empty', () => {
    const result = mkNRounds(4);
    expect(scs(result.firstRound).length).toBeGreaterThan(0);
    expect([...scs(result.intermediate), ...cvs(result.intermediate)].length).toBeGreaterThan(0);
    expect(scs(result.semis).length).toBeGreaterThan(0);
    expect(scs(result.finals).length).toBeGreaterThan(0);
  });

  it('2-round event round 2 goes to finals, not intermediate', () => {
    const result = mkNRounds(2);
    // roundLabel for round 2 of 2 should be "Final Round"
    expect(scs(result.finals)[0]?.roundLabel).toBe('Final Round');
  });

  it('333fm is excluded from all buckets', () => {
    const c = ch(100, '333fm', 1, 1);
    const e = evt('333fm', [rSpec('3')]);
    const r = room('Stage', [act('333fm', 1, [c])]);
    const p = per(1, [{ aid: 100 }]);
    const result = parseWCIF(mkWCIF([e], [r], [p]), cfg());
    expect(result.firstRound.length).toBe(0);
    expect(result.intermediate.length).toBe(0);
    expect(result.semis.length).toBe(0);
    expect(result.finals.length).toBe(0);
  });
});

// ── Group labels ─────────────────────────────────────────────────────────────

describe('group labels — single stage', () => {
  it('English: "Group 1 of 2" / "Group 2 of 2"', () => {
    const c1 = ch(100, '333', 1, 1); const c2 = ch(101, '333', 1, 2);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c1, c2])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }])]), cfg());
    const groups = new Set(scs(result.firstRound).map(s => s.group));
    expect(groups).toContain('Group 1 of 2');
    expect(groups).toContain('Group 2 of 2');
  });

  it('French: "Groupe 1 de 2" / "Groupe 2 de 2"', () => {
    const c1 = ch(100, '333', 1, 1); const c2 = ch(101, '333', 1, 2);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c1, c2])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }])]), cfg({ language: 'fr' }));
    const groups = new Set(scs(result.firstRound).map(s => s.group));
    expect(groups).toContain('Groupe 1 de 2');
    expect(groups).toContain('Groupe 2 de 2');
  });

  it('single-stage event stays "Group N of M" even in a multi-room venue', () => {
    // 5BLD in a single side room — never uses stage-colour labels
    const c = ch(100, '555bf', 1, 1);
    const e = evt('555bf', [rSpec('2')]);
    const r = room('Salle Annexe', [act('555bf', 1, [c])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    expect(scs(result.firstRound)[0]?.group).toBe('Group 1 of 1');
  });
});

describe('group labels — multi-stage (event across multiple rooms)', () => {
  it('4 distinct groups across 2 stages → "Rouge N of 4" / "Bleu N of 4"', () => {
    // rouge: g1, g2 — bleu: g3, g4 → 4 unique group codes
    const rRouge = room('Scène Rouge', [act('333', 1, [ch(100, '333', 1, 1), ch(101, '333', 1, 2)])]);
    const rBleu  = room('Scène Bleu',  [act('333', 1, [ch(102, '333', 1, 3), ch(103, '333', 1, 4)])]);
    const e = evt('333', [rSpec('a')]);
    const persons = [
      per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }]),
      per(3, [{ aid: 102 }]), per(4, [{ aid: 103 }]),
    ];
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], persons), cfg());
    const groups = new Set(scs(result.firstRound).map(s => s.group));
    expect(groups).toContain('Rouge 1 of 4');
    expect(groups).toContain('Rouge 2 of 4');
    expect(groups).toContain('Bleu 3 of 4');
    expect(groups).toContain('Bleu 4 of 4');
    expect(groups).not.toContain('Group 1 of 4');
  });

  it('French multi-stage → "Rouge N de 4"', () => {
    const rRouge = room('Scène Rouge', [act('333', 1, [ch(100, '333', 1, 1), ch(101, '333', 1, 2)])]);
    const rBleu  = room('Scène Bleu',  [act('333', 1, [ch(102, '333', 1, 3), ch(103, '333', 1, 4)])]);
    const e = evt('333', [rSpec('a')]);
    const persons = [per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }]), per(3, [{ aid: 102 }]), per(4, [{ aid: 103 }])];
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], persons), cfg({ language: 'fr' }));
    const groups = new Set(scs(result.firstRound).map(s => s.group));
    expect(groups).toContain('Rouge 1 de 4');
    expect(groups).toContain('Bleu 3 de 4');
  });

  it('unique group count: g1 in rouge + g1 in bleu = 1 group (not 2)', () => {
    // Same group code g1 in both rooms → simultaneous → numGroups = 1
    const rRouge = room('Scène Rouge', [act('333', 1, [ch(100, '333', 1, 1)])]);
    const rBleu  = room('Scène Bleu',  [act('333', 1, [ch(101, '333', 1, 1)])]);
    const e = evt('333', [rSpec('a')]);
    const p1 = per(1, [{ aid: 100 }]);
    const p2 = per(2, [{ aid: 101 }]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [p1, p2]), cfg());
    // total = 1 → simpleGroupLabel → "Group 1 of 1"
    const groups = new Set(scs(result.firstRound).map(s => s.group));
    expect(groups).toContain('Group 1 of 1');
    expect(groups).not.toContain('Rouge 1 of 1');
    expect(groups).not.toContain('Bleu 1 of 1');
  });
});

// ── Simultaneous multi-stage finals ─────────────────────────────────────────

describe('simultaneous multi-stage finals', () => {
  // 2-round event with simultaneous round-2 finals across rouge and bleu
  function mkSimultaneousFinals() {
    const e = evt('333', [rSpec('a'), rSpec('a')]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T14:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T14:00:00Z')]),
    ]);
    return parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg());
  }

  it('finals covers are labeled "Bleu 1" and "Rouge 1" (stage name + group number)', () => {
    const result = mkSimultaneousFinals();
    const coverGroups = cvs(result.finals).map(e => e.group).sort();
    expect(coverGroups).toContain('Bleu 1');
    expect(coverGroups).toContain('Rouge 1');
    expect(coverGroups).not.toContain('Bleu');
    expect(coverGroups).not.toContain('Group 1 of 1');
  });

  it('blank finals cards carry the stage label (not seat numbers)', () => {
    const result = mkSimultaneousFinals();
    const cards = scs(result.finals).filter(s => s.eventId === '333');
    const groups = new Set(cards.map(s => s.group));
    expect(groups).toContain('Bleu 1');
    expect(groups).toContain('Rouge 1');
    expect(cards.every(s => s.group === 'Bleu 1' || s.group === 'Rouge 1')).toBe(true);
  });

  it('blankCount is split by number of stages (stageCount = groups.length)', () => {
    // 2 stages → stageCount = 2 → blankCount = 16 each (no advancement condition)
    const result = mkSimultaneousFinals();
    const cards = scs(result.finals).filter(s => s.eventId === '333');
    // 2 covers × 16 blanks each = 32 blank scorecards
    expect(cards.length).toBe(32);
  });

  it('with ranking advancement: blankCount = ceil(level / stageCount) + 2', () => {
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 8 } }),
      rSpec('a'),
    ]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T14:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T14:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg());
    // stageCount = 2 → blankCount = ceil(8/2) + 2 = 6 per stage
    const blanks = scs(result.finals).filter(s => s.eventId === '333');
    expect(blanks.length).toBe(12); // 2 stages × 6
  });
});

// ── Person filtering ──────────────────────────────────────────────────────────

describe('person filtering', () => {
  function singleGroupSetup(opts: PersonOpts = {}) {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c])]);
    const p = per(1, [{ aid: 100 }], opts);
    return parseWCIF(mkWCIF([e], [r], [p]), cfg());
  }

  it('pending registration is excluded', () => {
    const result = singleGroupSetup({ status: 'pending' });
    expect(scs(result.firstRound).length).toBe(0);
  });

  it('deleted registration is excluded', () => {
    const result = singleGroupSetup({ status: 'deleted' });
    expect(scs(result.firstRound).length).toBe(0);
  });

  it('accepted registration is included', () => {
    const result = singleGroupSetup({ status: 'accepted' });
    expect(scs(result.firstRound).length).toBe(1);
  });

  it('no wcaId → "New Competitor" in English', () => {
    const result = singleGroupSetup({ wcaId: null });
    expect(scs(result.firstRound)[0]?.wcaId).toBe('New Competitor');
  });

  it('no wcaId male → "Nouveau Compétiteur" in French', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c])]);
    const p = per(1, [{ aid: 100 }], { wcaId: null, gender: 'm' });
    const result = parseWCIF(mkWCIF([e], [r], [p]), cfg({ language: 'fr' }));
    expect(scs(result.firstRound)[0]?.wcaId).toBe('Nouveau Compétiteur');
  });

  it('no wcaId female → "Nouvelle Compétitrice" in French', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c])]);
    const p = per(1, [{ aid: 100 }], { wcaId: null, gender: 'f' });
    const result = parseWCIF(mkWCIF([e], [r], [p]), cfg({ language: 'fr' }));
    expect(scs(result.firstRound)[0]?.wcaId).toBe('Nouvelle Compétitrice');
  });

  it('333mbf competitor assignments are skipped (no named first-round cards)', () => {
    const c = ch(100, '333mbf', 1, 1);
    const e = evt('333mbf', [rSpec('2')]);
    const r = room('Stage', [act('333mbf', 1, [c])]);
    const p = per(1, [{ aid: 100 }]);
    const result = parseWCIF(mkWCIF([e], [r], [p]), cfg());
    expect(scs(result.firstRound).filter(s => s.eventId === '333mbf').length).toBe(0);
  });

  it('333mbf limit field is "H1b" regardless of WCIF timeLimit value', () => {
    const c2 = ch(101, '333mbf', 2, 1, '2024-01-01T14:00:00Z');
    const e = evt('333mbf', [rSpec('2', { limitCs: 36000 }), rSpec('2', { limitCs: 36000 })]);
    const r = room('Stage', [act('333mbf', 1, [ch(100, '333mbf', 1, 1)]), act('333mbf', 2, [c2])]);
    const result = parseWCIF(mkWCIF([e], [r]), cfg());
    expect(scs(result.finals)[0]?.limit).toBe('H1b');
  });
});

// ── Time limit flags ──────────────────────────────────────────────────────────

describe('time limit flags', () => {
  it('cumulative cumulativeRoundIds sets isCumulative = true', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a', { cumulative: ['333-r1'] })]);
    const r = room('Stage', [act('333', 1, [c])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    expect(scs(result.firstRound)[0]?.isCumulative).toBe(true);
  });

  it('empty cumulativeRoundIds: isCumulative = false', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    expect(scs(result.firstRound)[0]?.isCumulative).toBe(false);
  });

  it('null timeLimit: isCumulative = false and limit = ""', () => {
    const c = ch(100, '333', 1, 1);
    const e = evt('333', [rSpec('a', { limitCs: null })]);
    const r = room('Stage', [act('333', 1, [c])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    const sc = scs(result.firstRound)[0];
    expect(sc?.isCumulative).toBe(false);
    expect(sc?.limit).toBe('');
  });
});

// ── Intermediate round modes ──────────────────────────────────────────────────

describe('intermediate round modes (3-round event, round 2)', () => {
  function mk3Round(mode: 'blanks' | 'prefilled', adv?: AdvancementCondition) {
    const e = evt('333', [
      rSpec('a', { adv: adv ?? null }),
      rSpec('a'),
      rSpec('a'),
    ]);
    const r = room('Stage', [
      act('333', 1, [ch(100, '333', 1, 1), ch(101, '333', 1, 2)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z'), ch(111, '333', 2, 2, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const persons = [per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }])];
    return parseWCIF(mkWCIF([e], [r], persons), cfg({ secondRoundMode: mode }));
  }

  it('blanks mode: intermediate scorecards have no names', () => {
    const result = mk3Round('blanks');
    expect(scs(result.intermediate).filter(s => s.eventId === '333').every(s => s.name === '')).toBe(true);
  });

  it('blanks mode: one cover per group', () => {
    const result = mk3Round('blanks');
    expect(cvs(result.intermediate).length).toBe(2);
  });

  it('prefilled mode: intermediate includes named round-1 participants', () => {
    const result = mk3Round('prefilled');
    const names = scs(result.intermediate).map(s => s.name);
    expect(names).toContain('P1');
    expect(names).toContain('P2');
  });

  it('prefilled mode: named cards carry a blank group placeholder "Group _ of 2"', () => {
    const result = mk3Round('prefilled');
    const named = scs(result.intermediate).filter(s => s.name !== '');
    expect(named.every(s => s.group === 'Group _ of 2')).toBe(true);
  });

  it('prefilled mode: cover cards exist — one per group', () => {
    const result = mk3Round('prefilled');
    expect(cvs(result.intermediate).length).toBe(2);
  });

  it('blanks mode with ranking advancement: blankCount = ceil(level / numGroups) + 2', () => {
    // level=8, 2 groups → ceil(8/2)+2 = 6 per group → 12 blanks
    const result = mk3Round('blanks', { type: 'ranking', level: 8 });
    expect(scs(result.intermediate).filter(s => s.eventId === '333').length).toBe(12);
  });

  it('prefilled simultaneous stages: covers labeled "Rouge 1"/"Bleu 1" with count divided by stages', () => {
    // 3-round event, round 2 runs simultaneously in rouge and bleu (g1 in both)
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 16 } }),
      rSpec('a'),
      rSpec('a'),
    ]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const persons = Array.from({ length: 20 }, (_, i) => per(i + 1, [{ aid: 100 + (i % 2) }]));
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], persons), cfg({ secondRoundMode: 'prefilled' }));
    const cov = cvs(result.intermediate);
    // Two covers, one per stage, labeled with stage names
    expect(cov.length).toBe(2);
    const groups = cov.map(c => c.group).sort();
    expect(groups).toContain('Bleu 1');
    expect(groups).toContain('Rouge 1');
    // level=16, stageCount=2 → 8 each, sum = 16 ✓
    expect(cov.every(c => c.numScorecards === 8)).toBe(true);
  });

  it('prefilled: uneven qualifier count distributes remainder without overcounting', () => {
    // 17 qualifiers across 2 stages: one gets 9, the other 8 (total = 17, not 18)
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 17 } }),
      rSpec('a'),
      rSpec('a'),
    ]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg({ secondRoundMode: 'prefilled' }));
    const cov = cvs(result.intermediate);
    const counts = cov.map(c => c.numScorecards).sort((a, b) => a - b);
    // Totals must match the qualifier level exactly
    expect(counts.reduce((s, n) => s + n, 0)).toBe(17);
    // Distribution: one group gets floor(17/2)=8, one gets 9
    expect(counts).toEqual([8, 9]);
  });

  it('prefilled: 3 stages with non-multiple qualifier count', () => {
    // 17 qualifiers across 3 stages: [6, 6, 5] (sum = 17)
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 17 } }),
      rSpec('a'),
      rSpec('a'),
    ]);
    const mkStageRoom = (name: string, c1id: number, c2id: number, c3id: number) =>
      room(name, [
        act('333', 1, [ch(c1id, '333', 1, 1)]),
        act('333', 2, [ch(c2id, '333', 2, 1, '2024-01-01T12:00:00Z')]),
        act('333', 3, [ch(c3id, '333', 3, 1, '2024-01-01T16:00:00Z')]),
      ]);
    const rooms = [
      mkStageRoom('Scène Rouge', 100, 110, 120),
      mkStageRoom('Scène Bleu',  101, 111, 121),
      mkStageRoom('Scène Vert',  102, 112, 122),
    ];
    const result = parseWCIF(mkWCIF([e], rooms, [per(1, [{ aid: 100 }])]), cfg({ secondRoundMode: 'prefilled' }));
    const cov = cvs(result.intermediate);
    expect(cov.length).toBe(3);
    expect(cov.map(c => c.numScorecards).reduce((s, n) => s + n, 0)).toBe(17);
    // Sorted counts: [5, 6, 6]
    expect(cov.map(c => c.numScorecards).sort((a, b) => a - b)).toEqual([5, 6, 6]);
  });

  it('prefilled simultaneous stages: named cards use blank group divided by stageCount', () => {
    const e = evt('333', [rSpec('a'), rSpec('a'), rSpec('a')]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg({ secondRoundMode: 'prefilled' }));
    const named = scs(result.intermediate).filter(s => s.name !== '');
    // stageCount=2 → placeholder is "Group _ of 2"
    expect(named.every(s => s.group === 'Group _ of 2')).toBe(true);
  });

  it('blanks simultaneous stages: covers and cards labeled "Rouge 1"/"Bleu 1", count divided by stages', () => {
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 8 } }),
      rSpec('a'),
      rSpec('a'),
    ]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg({ secondRoundMode: 'blanks' }));
    const cov = cvs(result.intermediate);
    expect(cov.map(c => c.group).sort()).toEqual(['Bleu 1', 'Rouge 1']);
    // blankCount = ceil(8 / 2) + 2 = 6
    expect(cov.every(c => c.numScorecards === 6)).toBe(true);
    const blank = scs(result.intermediate).filter(s => s.eventId === '333');
    const groups = new Set(blank.map(s => s.group));
    expect(groups).toContain('Bleu 1');
    expect(groups).toContain('Rouge 1');
  });

  it('prefilled French language: blank group is "Groupe _ de 2"', () => {
    const e = evt('333', [rSpec('a'), rSpec('a'), rSpec('a')]);
    const r = room('Stage', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T12:00:00Z'), ch(111, '333', 2, 2, '2024-01-01T12:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg({ language: 'fr', secondRoundMode: 'prefilled' }));
    const named = scs(result.intermediate).filter(s => s.name !== '');
    expect(named.every(s => s.group === 'Groupe _ de 2')).toBe(true);
  });
});

// ── Cover cards ───────────────────────────────────────────────────────────────

describe('first-round cover cards', () => {
  it('numScorecards reflects actual participant count per group', () => {
    // 2 persons in g1, 1 in g2
    const c1 = ch(100, '333', 1, 1); const c2 = ch(101, '333', 1, 2);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c1, c2])]);
    const persons = [per(1, [{ aid: 100 }]), per(2, [{ aid: 100 }]), per(3, [{ aid: 101 }])];
    const result = parseWCIF(mkWCIF([e], [r], persons), cfg());
    const cov = cvs(result.firstRound);
    expect(cov.find(c => c.group === 'Group 1 of 2')?.numScorecards).toBe(2);
    expect(cov.find(c => c.group === 'Group 2 of 2')?.numScorecards).toBe(1);
  });

  it('no participants in a group → no cover for that group', () => {
    // g1 has a person, g2 does not
    const c1 = ch(100, '333', 1, 1); const c2 = ch(101, '333', 1, 2);
    const e = evt('333', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [c1, c2])]);
    const result = parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
    const cov = cvs(result.firstRound);
    expect(cov.length).toBe(1);
    expect(cov[0]?.group).toBe('Group 1 of 2');
  });
});

// ── Simultaneous multi-stage semis ───────────────────────────────────────────

describe('simultaneous multi-stage semis', () => {
  // 4-round event, round 3 (semis) runs simultaneously in rouge and bleu (same g1)
  function mkSimultaneousSemis() {
    const e = evt('333', [rSpec('a'), rSpec('a'), rSpec('a'), rSpec('a')]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T11:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T14:00:00Z')]),
      act('333', 4, [ch(130, '333', 4, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T11:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T14:00:00Z')]),
      act('333', 4, [ch(131, '333', 4, 1, '2024-01-01T16:00:00Z')]),
    ]);
    return parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg());
  }

  it('semis covers are labeled "Bleu 1" and "Rouge 1", not "Group 1 of 1"', () => {
    const result = mkSimultaneousSemis();
    const coverGroups = cvs(result.semis).map(e => e.group).sort();
    expect(coverGroups).toContain('Bleu 1');
    expect(coverGroups).toContain('Rouge 1');
    expect(coverGroups).not.toContain('Group 1 of 1');
  });

  it('semis blank cards carry the stage label', () => {
    const result = mkSimultaneousSemis();
    const cards = scs(result.semis).filter(s => s.eventId === '333');
    const groups = new Set(cards.map(s => s.group));
    expect(groups).toContain('Bleu 1');
    expect(groups).toContain('Rouge 1');
  });

  it('semis blankCount is split by number of stages', () => {
    const result = mkSimultaneousSemis();
    // 2 stages, 16 blanks each → 32 blank scorecards
    expect(scs(result.semis).filter(s => s.eventId === '333').length).toBe(32);
  });
});

// ── 4-round events (semis) ────────────────────────────────────────────────────

describe('4-round events — semi-finals bucket', () => {
  function mk4Round() {
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 16 } }),
      rSpec('a', { adv: { type: 'ranking', level: 8 } }),
      rSpec('a', { adv: { type: 'ranking', level: 4 } }),
      rSpec('a'),
    ]);
    const r = room('Stage', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T11:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T14:00:00Z')]),
      act('333', 4, [ch(130, '333', 4, 1, '2024-01-01T16:00:00Z')]),
    ]);
    return parseWCIF(mkWCIF([e], [r], [per(1, [{ aid: 100 }])]), cfg());
  }

  it('semis bucket is non-empty', () => {
    expect(scs(mk4Round().semis).length).toBeGreaterThan(0);
  });

  it('round 3 of 4 goes to semis with correct round label', () => {
    const s = scs(mk4Round().semis).filter(s => s.eventId === '333');
    expect(s[0]?.roundLabel).toBe('Round 3 of 4');
  });

  it('round 4 of 4 goes to finals with "Final Round" label', () => {
    const s = scs(mk4Round().finals).filter(s => s.eventId === '333');
    expect(s[0]?.roundLabel).toBe('Final Round');
  });

  it('semis blankCount = ceil(prev-adv-level / numGroups) + 2', () => {
    // prev round (r2) adv level=8, 1 group in semis → ceil(8/1)+2 = 10
    const s = scs(mk4Round().semis).filter(s => s.eventId === '333');
    expect(s.length).toBe(10);
  });

  it('finals blankCount uses round-3 advancement (level=4, 1 group) → ceil(4/1)+2 = 6', () => {
    const s = scs(mk4Round().finals).filter(s => s.eventId === '333');
    expect(s.length).toBe(6);
  });

  it('round 2 goes to intermediate, not semis', () => {
    const result = mk4Round();
    const intCards = [...scs(result.intermediate), ...cvs(result.intermediate)].filter(s => s.eventId === '333');
    const semisCards = scs(result.semis).filter(s => s.eventId === '333');
    expect(intCards.length).toBeGreaterThan(0);
    // intermediate cards are round 2 → "Round 2 of 4"
    // We can verify the intermediate round label
    expect([...scs(result.intermediate)].find(s => s.eventId === '333')?.roundLabel).toBe('Round 2 of 4');
    expect(semisCards[0]?.roundLabel).toBe('Round 3 of 4');
  });
});

// ── Cover-before-group ordering (cut-and-stack layout) ───────────────────────

describe('cover-before-group ordering', () => {
  it('each cover immediately precedes its own group scorecards (not all covers first)', () => {
    // Simultaneous semis: Bleu 1 and Rouge 1 at the same timeslot, 4 blanks each.
    const e = evt('333', [
      rSpec('a', { adv: { type: 'ranking', level: 4 } }),  // r1→r2
      rSpec('a', { adv: { type: 'ranking', level: 4 } }),  // r2→r3
      rSpec('a', { adv: { type: 'ranking', level: 4 } }),  // r3→r4 (semis, adv level=4 → blanks per stage = ceil(4/2)+2 = 4)
      rSpec('a'),
    ]);
    const rRouge = room('Scène Rouge', [
      act('333', 1, [ch(100, '333', 1, 1)]),
      act('333', 2, [ch(110, '333', 2, 1, '2024-01-01T11:00:00Z')]),
      act('333', 3, [ch(120, '333', 3, 1, '2024-01-01T14:00:00Z')]),
      act('333', 4, [ch(130, '333', 4, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const rBleu = room('Scène Bleu', [
      act('333', 1, [ch(101, '333', 1, 1)]),
      act('333', 2, [ch(111, '333', 2, 1, '2024-01-01T11:00:00Z')]),
      act('333', 3, [ch(121, '333', 3, 1, '2024-01-01T14:00:00Z')]),
      act('333', 4, [ch(131, '333', 4, 1, '2024-01-01T16:00:00Z')]),
    ]);
    const result = parseWCIF(mkWCIF([e], [rRouge, rBleu], [per(1, [{ aid: 100 }])]), cfg());

    // Extract semis entries that belong to this event (exclude padding empty covers)
    const semisReal = result.semis.filter(s => s.eventId === '333');

    // Find positions of cover cards
    const coverPositions = semisReal
      .map((e, i) => e.kind === 'cover' ? i : -1)
      .filter(i => i !== -1);

    // Each cover should be followed immediately by scorecards with the same group label,
    // not by another cover.
    for (const pos of coverPositions) {
      const cover = semisReal[pos] as CoverEntry;
      const next = semisReal[pos + 1];
      // The card right after a cover must not be another cover.
      expect(next?.kind).not.toBe('cover');
      // If there is a next card, it must share the same group label.
      if (next) expect(next.group).toBe(cover.group);
    }
  });
});

// ── Timeslot ordering ─────────────────────────────────────────────────────────

describe('timeslot ordering', () => {
  it('scorecards are sorted by activity start time', () => {
    const early = ch(100, '333', 1, 1, '2024-01-01T09:00:00Z');
    const late  = ch(101, '222', 1, 1, '2024-01-01T10:00:00Z');
    const e333 = evt('333', [rSpec('a')]);
    const e222 = evt('222', [rSpec('a')]);
    const r = room('Stage', [act('333', 1, [early]), act('222', 1, [late])]);
    const persons = [per(1, [{ aid: 100 }]), per(2, [{ aid: 101 }])];
    const result = parseWCIF(mkWCIF([e333, e222], [r], persons), cfg());
    const all = scs(result.firstRound).filter(s => s.eventId === '333' || s.eventId === '222');
    const t333 = all.find(s => s.eventId === '333')?.timeslot ?? '';
    const t222 = all.find(s => s.eventId === '222')?.timeslot ?? '';
    expect(t333 < t222).toBe(true);
  });
});
