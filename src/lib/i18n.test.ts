import { describe, it, expect } from 'vitest';
import {
  getStrings, getScheduleStrings, getCheckingSheetStrings, getNametTagStrings,
  getFirstTimerSlipStrings, getNametTagTitleStrings, getShortNametTagNames,
  getEventName, getWorkerStrings, splitLabelTotal, EVENT_NAMES_EN,
  type ScorecardStrings,
} from './i18n';
import type { LocaleCode } from '../types/settings';

// These tests deliberately assert *no* translated value. Rewording a PDF string is a
// routine editorial change and must not turn CI red; what must stay guarded is the
// structure around the strings - every locale carries every field, interpolation still
// lands, the bilingual merge picks the right side, and layout contracts hold. Whether a
// reworded string still *fits* its column is checked separately by the width sweeps in
// src/pdf/*-layout.test.ts.

const LOCALES = ['en', 'fr', 'es', 'pt'] as const;
const TRANSLATIONS = ['fr', 'es', 'pt'] as const;

// Every function in the bundles takes some prefix of (string-ish, number-ish, number-ish);
// booleans read the first arg's truthiness. Extra args are ignored, so one probe fits all.
const PROBE = ['7', 7, 7] as const;
const call = (fn: unknown) => (fn as (...a: unknown[]) => unknown)(...PROBE);

/** Every localized surface a PDF can pull from, keyed the way LOCALES stores it. */
function bundle(lc: LocaleCode) {
  return {
    scorecard: getStrings(lc),
    schedule: getScheduleStrings(lc),
    checking: getCheckingSheetStrings(lc),
    nametag: getNametTagStrings(lc),
    firstTimer: getFirstTimerSlipStrings(lc),
    title: getNametTagTitleStrings(lc).front,
    shortNames: getShortNametTagNames(lc),
    // Progress-bar strings for the render worker. Previously a private table inside
    // scorecardWorker.ts that no test could see.
    worker: getWorkerStrings(lc),
  };
}

type Node = { [k: string]: unknown };

// Flatten to dotted paths so a parity failure names the exact field. Strings and
// functions are both leaves - a locale may implement a label either way.
function paths(obj: Node, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || typeof v === 'function') out.push(path);
    else out.push(...paths(v as Node, path));
  }
  return out.sort();
}

function at(obj: Node, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Node)[k], obj);
}

describe('PDF locale bundle parity', () => {
  const EN_PATHS = paths(bundle('en'));

  for (const lc of TRANSLATIONS) {
    const keys = paths(bundle(lc));

    it(`${lc} has no field missing from en`, () => {
      expect(EN_PATHS.filter(k => !keys.includes(k))).toEqual([]);
    });

    it(`${lc} has no field that en dropped`, () => {
      expect(keys.filter(k => !EN_PATHS.includes(k))).toEqual([]);
    });
  }

  it('every field resolves to a non-empty string in every locale', () => {
    for (const lc of LOCALES) {
      const b = bundle(lc);
      const empty = paths(b).filter((p) => {
        const v = at(b, p);
        const s = typeof v === 'function' ? call(v) : v;
        return typeof s !== 'string' || s.trim() === '';
      });
      expect(empty, lc).toEqual([]);
    }
  });

  // Same house rule as the on-screen bundles (src/i18n/locale-parity.test.ts): no em
  // dash in anything an organizer reads. Note the cut-off line uses box-drawing '─'
  // (U+2500) as a rule, not an em dash (U+2014) - that is intentional, leave it alone.
  it('uses no em dash in any PDF string', () => {
    for (const lc of LOCALES) {
      const b = bundle(lc);
      const offenders = paths(b).filter((p) => {
        const v = at(b, p);
        const s = typeof v === 'function' ? call(v) : v;
        return typeof s === 'string' && s.includes('—');
      });
      expect(offenders, lc).toEqual([]);
    }
  });

  // Fields that carry real prose - if one of these still reads as English in fr/es/pt,
  // a locale was added by copy-paste and never translated.
  it('no English leaking through on the headline fields', () => {
    const sample = ['checking.title', 'schedule.title', 'scorecard.scrambler',
      'firstTimer.confirmIntro1', 'nametag.compete'];
    const en = bundle('en');
    for (const lc of TRANSLATIONS) {
      const b = bundle(lc);
      for (const p of sample) expect(at(b, p), `${lc} ${p}`).not.toBe(at(en, p));
    }
  });
});

describe('event names', () => {
  it('every event is translated in every locale (no fallback to the raw id)', () => {
    for (const lc of LOCALES) {
      for (const id of Object.keys(EVENT_NAMES_EN)) {
        expect(getEventName(id, lc), `${lc} ${id}`).not.toBe(id);
        expect(getEventName(id, lc).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('unknown event falls back to the event id', () => {
    for (const lc of LOCALES) expect(getEventName('unknown', lc)).toBe('unknown');
  });
});

describe('splitLabelTotal', () => {
  it('splits the trailing "<connector> Y" off a label in every locale', () => {
    for (const lc of LOCALES) {
      const c = getStrings(lc).ofConnector;
      expect(splitLabelTotal(`Group 1 ${c} 2`, c)).toEqual({ head: 'Group 1', tail: ` ${c} 2` });
    }
  });

  it('splits on the LAST connector so colour/stage names are untouched', () => {
    // A French "Bleu 1 sur 2" must keep the colour in head; only " sur 2" is the tail.
    expect(splitLabelTotal('Bleu 1 sur 2', 'sur')).toEqual({ head: 'Bleu 1', tail: ' sur 2' });
    expect(splitLabelTotal('Blue 1 of 2 of 3', 'of')).toEqual({ head: 'Blue 1 of 2', tail: ' of 3' });
  });

  it('returns tail null when there is no connector (e.g. final rounds)', () => {
    expect(splitLabelTotal('Final Round', 'of')).toEqual({ head: 'Final Round', tail: null });
    expect(splitLabelTotal('Tour Final', 'sur')).toEqual({ head: 'Tour Final', tail: null });
  });
});

// mergeScorecardStrings is the single place deciding which scorecard fields stack both
// languages and which stay primary-only. The split is the contract; the words are not.
describe('bilingual scorecard merge', () => {
  const BILINGUAL_TEXT = ['scrambler', 'scramblerCheck', 'attempt', 'judge', 'competitor',
    'resultPrefix', 'provisionalLine'] as const;
  const BILINGUAL_FN = ['dnfSuffix', 'cumulativeSuffix', 'shortDnfSuffix',
    'shortCumulativeSuffix', 'cutoffLine'] as const;
  const PRIMARY_TEXT = ['mbfSuffix', 'newCompetitor', 'newCompetitorF', 'finalRound',
    'ofConnector'] as const;
  const PRIMARY_FN = ['roundName', 'groupLabel', 'colorGroupLabel', 'blankGroupLabel',
    'stationLabel'] as const;

  const PAIRS: [LocaleCode, LocaleCode][] = [['fr', 'en'], ['en', 'fr'], ['es', 'pt'], ['pt', 'es']];

  // A field added to ScorecardStrings but forgotten in mergeScorecardStrings would
  // silently inherit the primary language on a bilingual scorecard. Catch it here.
  it('the lists below cover every scorecard field', () => {
    const listed = [...BILINGUAL_TEXT, ...BILINGUAL_FN, ...PRIMARY_TEXT, ...PRIMARY_FN, 'cover'];
    expect(Object.keys(getStrings('en')).sort()).toEqual([...listed].sort());
  });

  for (const [p, s] of PAIRS) {
    describe(`${p} + ${s}`, () => {
      const merged = getStrings(p, s);
      const prim = getStrings(p);
      const sec = getStrings(s);

      it('stacks the bilingual headers as primary\\nsecondary', () => {
        for (const f of BILINGUAL_TEXT) expect(merged[f], f).toBe(`${prim[f]}\n${sec[f]}`);
        for (const f of BILINGUAL_FN) {
          expect(call(merged[f]), f).toBe(`${call(prim[f])}\n${call(sec[f])}`);
        }
      });

      it('keeps labels, the cover card and the connector primary-only', () => {
        for (const f of PRIMARY_TEXT) expect(merged[f], f).toBe(prim[f]);
        for (const f of PRIMARY_FN) expect(call(merged[f]), f).toBe(call(prim[f]));
        for (const k of Object.keys(prim.cover) as (keyof ScorecardStrings['cover'])[]) {
          const m = merged.cover[k], q = prim.cover[k];
          expect(typeof m === 'function' ? call(m) : m, `cover.${k}`)
            .toBe(typeof q === 'function' ? call(q) : q);
        }
      });
    });
  }

  it('no secondary (or secondary === primary) returns a single language', () => {
    for (const lc of LOCALES) {
      const single = getStrings(lc);
      expect(getStrings(lc, null).scrambler).toBe(single.scrambler);
      expect(getStrings(lc, lc).scrambler).toBe(single.scrambler);
      expect(single.scrambler).not.toContain('\n');
    }
  });
});

describe('interpolation', () => {
  it('injects its argument into every parameterized string', () => {
    for (const lc of LOCALES) {
      const s = getStrings(lc);
      expect(s.roundName(1, 3), lc).toContain('1');
      expect(s.roundName(1, 3), lc).toContain('3');
      expect(s.groupLabel(2, 5), lc).toContain('2');
      expect(s.blankGroupLabel(4), lc).toContain('4');
      expect(s.colorGroupLabel('Bleu', 3, 4), lc).toContain('Bleu');
      expect(s.stationLabel('03'), lc).toContain('03');
      expect(s.dnfSuffix('1:00'), lc).toContain('1:00');
      expect(s.cumulativeSuffix('1:00'), lc).toContain('1:00');
      expect(s.cutoffLine('30.00', false), lc).toContain('30.00');
      expect(s.cover.bundledScorecards(12), lc).toContain('12');
      expect(s.cover.allGroups(3), lc).toContain('3');
      expect(getScheduleStrings(lc).roundLabel(2), lc).toContain('2');
      expect(getNametTagStrings(lc).dutyGroup('1 & 2'), lc).toContain('1 & 2');
      expect(getFirstTimerSlipStrings(lc).solveSingle('Megaminx'), lc).toContain('Megaminx');
    }
  });

  it('the Bo1 cut-off reads differently from the Bo2 one', () => {
    for (const lc of LOCALES) {
      const s = getStrings(lc);
      expect(s.cutoffLine('30.00', true), lc).not.toBe(s.cutoffLine('30.00', false));
    }
  });

  it('the cover card reads as a sentence: singular differs from plural', () => {
    for (const lc of LOCALES) {
      const { allGroups } = getStrings(lc).cover;
      expect(allGroups(1), lc).not.toBe(allGroups(3));
    }
  });
});

describe('gendered titles', () => {
  const ROLES = ['delegate', 'organizer', 'newCompetitor', 'competitor'] as const;

  it('fr/es/pt distinguish gender on every role, en does not', () => {
    for (const lc of LOCALES) {
      const { front } = getNametTagTitleStrings(lc);
      for (const r of ROLES) {
        const differ = front[r](true) !== front[r](false);
        expect(differ, `${lc} ${r}`).toBe(lc !== 'en');
      }
    }
  });

  it('the scorecard newcomer label has its own feminine form outside English', () => {
    for (const lc of LOCALES) {
      const s = getStrings(lc);
      expect(s.newCompetitorF !== s.newCompetitor, lc).toBe(lc !== 'en');
    }
  });
});

describe('nametag title panels', () => {
  it('front takes the primary language, back the secondary', () => {
    for (const [p, s] of [['fr', 'en'], ['en', 'fr'], ['es', 'pt']] as [LocaleCode, LocaleCode][]) {
      const { front, back } = getNametTagTitleStrings(p, s);
      expect(front.delegate(false)).toBe(getNametTagTitleStrings(p).front.delegate(false));
      expect(back.newCompetitor(true)).toBe(getNametTagTitleStrings(s).front.newCompetitor(true));
    }
  });

  it('single language: both panels match', () => {
    for (const lc of LOCALES) {
      for (const sec of [undefined, null, lc]) {
        const { front, back } = getNametTagTitleStrings(lc, sec);
        expect(back.delegate(false), `${lc}/${sec}`).toBe(front.delegate(false));
      }
    }
  });
});

describe('Round Checklist column contract', () => {
  // The two tick-only columns record work done *ahead* of the round (groups created on
  // competitiongroups, scorecards produced), not scorecards handed in afterwards. Sarah's
  // feedback was explicit about this, so the wording must never drift into
  // collected/checked. Rewording is fine; changing the meaning is not.
  const COLLECTED = /collect|gather|receiv|check|recueill|ramass|v[ée]rifi|contr[ôo]l|recolect|recogid|revisad|recolhid|coletad|conferid/i;

  it('the pre-round tick columns never read as collected or checked', () => {
    for (const lc of LOCALES) {
      const s = getCheckingSheetStrings(lc);
      expect(s.groupsMade, lc).not.toMatch(COLLECTED);
      expect(s.scorecards, lc).not.toMatch(COLLECTED);
    }
  });

  // The document prints "<competition name> <title>", so the title carries its own
  // leading separator.
  it('the title starts with a hyphen, like the schedule tracker', () => {
    for (const lc of LOCALES) {
      expect(getCheckingSheetStrings(lc).title.startsWith('-'), lc).toBe(true);
      expect(getScheduleStrings(lc).title.startsWith('-'), lc).toBe(true);
    }
  });

  it('wraps the multi-word headers onto two lines so they fit their columns', () => {
    for (const lc of LOCALES) {
      const s = getCheckingSheetStrings(lc);
      for (const key of ['start', 'groupsMade', 'scorecards', 'dataEntry', 'doubleCheck', 'takenBy'] as const) {
        expect(s[key], `${lc} ${key}`).toContain('\n');
      }
    }
  });
});

describe('short nametag names', () => {
  it('language-independent puzzle names stay identical across locales', () => {
    // Numeric cube names and the FMC acronym are not translated anywhere; a locale that
    // "translates" them would break the shared nametag layout.
    for (const id of ['333', '222', '444', '555', '666', '777', '333fm']) {
      const en = getShortNametTagNames('en')[id];
      for (const lc of TRANSLATIONS) expect(getShortNametTagNames(lc)[id], `${lc} ${id}`).toBe(en);
    }
  });

  it('every short name is shorter than or equal to its full event name', () => {
    // The short names exist to fit the duty line on a nametag; one longer than the full
    // name means the entry was filled in with the wrong string.
    for (const lc of LOCALES) {
      for (const [id, short] of Object.entries(getShortNametTagNames(lc))) {
        expect(short.length, `${lc} ${id}`).toBeLessThanOrEqual(getEventName(id, lc).length);
      }
    }
  });
});
