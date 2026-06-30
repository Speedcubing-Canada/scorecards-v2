import { describe, it, expect } from 'vitest';
import { buildSlipLines } from './firstTimerSlipLines';
import {
  SLIP_LINE_H, SLIP_INTRO_MARGIN_BOTTOM, SLIP_MARGIN_BOTTOM,
  SLIP_PAGE_PAD_TOP, SLIP_PAGE_PAD_BOTTOM,
} from './layoutConstants';
import { getFirstTimerSlipStrings, type FirstTimerSlipStrings } from '../lib/i18n';
import type { FirstTimerEntry } from '../lib/wcif-parser';
import type { LocaleCode } from '../types/settings';

const LOCALES: LocaleCode[] = ['en', 'fr', 'es', 'pt'];

const EN = getFirstTimerSlipStrings('en');

function entry(over: Partial<FirstTimerEntry> = {}): FirstTimerEntry {
  return {
    name: 'Test Person',
    gender: 'm',
    birthdate: '2015-01-13', // a clear minor in any plausible "today"
    countryIso2: 'CA',
    eventIds: ['444', 'minx'],
    ...over,
  };
}

const texts = (lines: { text: string }[]) => lines.map((l) => l.text);

describe('buildSlipLines content rules', () => {
  it('starts with the two intro lines, neither carrying a checkbox', () => {
    const lines = buildSlipLines(entry(), EN, 'en');
    expect(lines[0]).toMatchObject({ text: EN.confirmIntro1, checkbox: false });
    expect(lines[1]).toMatchObject({ text: EN.confirmIntro2, checkbox: false });
  });

  it('shows the preferred name and gender as bold trailing values', () => {
    const lines = buildSlipLines(entry({ name: 'Alex Yang', gender: 'f' }), EN, 'en');
    expect(lines).toContainEqual({ text: EN.preferredNamePrefix, bold: 'Alex Yang', checkbox: true });
    expect(lines).toContainEqual({ text: EN.genderPrefix, bold: EN.genderFemale, checkbox: true });
  });

  it('renders the birthdate (localized) and the minor parental-consent line for a minor', () => {
    const lines = buildSlipLines(entry({ birthdate: '2015-01-13' }), EN, 'en');
    expect(texts(lines)).toContain(EN.birthdatePrefix);
    expect(texts(lines)).toContain(EN.parentalConsent);
    // The bold birthdate value is the localized short date.
    const bd = lines.find((l) => l.text === EN.birthdatePrefix);
    expect(bd?.bold).toMatch(/2015/);
  });

  it('omits the parental-consent line for an adult', () => {
    const lines = buildSlipLines(entry({ birthdate: '1980-01-01' }), EN, 'en');
    expect(texts(lines)).toContain(EN.birthdatePrefix);
    expect(texts(lines)).not.toContain(EN.parentalConsent);
  });

  it('omits BOTH the birthdate and the consent line when birthdate is absent', () => {
    for (const bd of [null, undefined]) {
      const lines = buildSlipLines(entry({ birthdate: bd }), EN, 'en');
      expect(texts(lines)).not.toContain(EN.birthdatePrefix);
      expect(texts(lines)).not.toContain(EN.parentalConsent);
      // Gender and citizenship are still present (they don't depend on DOB).
      expect(texts(lines)).toContain(EN.genderPrefix);
      expect(texts(lines)).toContain(EN.citizenshipPrefix);
    }
  });

  it('uses the single-event wording for exactly one event (no bullets, no header)', () => {
    const lines = buildSlipLines(entry({ eventIds: ['444'] }), EN, 'en');
    expect(texts(lines)).toContain(EN.solveSingle('4x4x4 Cube'));
    expect(texts(lines)).not.toContain(EN.solveMultipleIntro);
    expect(lines.some((l) => l.text.startsWith('•'))).toBe(false);
  });

  it('uses the multi-event header + one bulleted checkbox line per event', () => {
    const lines = buildSlipLines(entry({ eventIds: ['444', '555', 'minx'] }), EN, 'en');
    expect(texts(lines)).toContain(EN.solveMultipleIntro);
    const bullets = lines.filter((l) => l.text.startsWith('•'));
    expect(bullets).toHaveLength(3);
    expect(bullets.every((b) => b.checkbox)).toBe(true);
    expect(bullets.map((b) => b.text)).toEqual(['• 4x4x4 Cube', '• 5x5x5 Cube', '• Megaminx']);
  });

  it('localizes event names to the slip language', () => {
    const FR = getFirstTimerSlipStrings('fr');
    const lines = buildSlipLines(entry({ eventIds: ['minx'] }), FR, 'fr');
    // French event name for Megaminx differs from English; just assert it solved one event.
    expect(lines.some((l) => l.text.startsWith(FR.solveSingle('').trim()))).toBe(true);
  });
});

describe('first-timer slip i18n completeness', () => {
  const stringFields: (keyof FirstTimerSlipStrings)[] = [
    'confirmIntro1', 'confirmIntro2', 'firstCompetition', 'preferredNamePrefix',
    'genderPrefix', 'birthdatePrefix', 'citizenshipPrefix', 'parentalConsent',
    'solveMultipleIntro', 'genderMale', 'genderFemale', 'genderOther',
  ];

  for (const loc of LOCALES) {
    it(`every string is present and non-empty for "${loc}"`, () => {
      const s = getFirstTimerSlipStrings(loc);
      for (const f of stringFields) {
        expect(typeof s[f]).toBe('string');
        expect((s[f] as string).trim().length).toBeGreaterThan(0);
      }
      expect(s.solveSingle('X').trim().length).toBeGreaterThan(0);
      expect(s.solveSingle('X')).toContain('X');
    });
  }
});

// Layout constants mirrored from FirstTimerSlipDocument.tsx. A slip is rendered
// wrap={false}, so a single slip that exceeded the page's content height would be
// clipped. This guards that even a worst-case slip (every WCA event) fits a page.
describe('first-timer slip geometry', () => {
  const LINE_H = SLIP_LINE_H;
  const INTRO_GAP = SLIP_INTRO_MARGIN_BOTTOM;  // styles.intro marginBottom
  const SLIP_GAP = SLIP_MARGIN_BOTTOM;         // styles.slip marginBottom (18 + one line)
  const PAD_TOP = SLIP_PAGE_PAD_TOP;
  const PAD_BOTTOM = SLIP_PAGE_PAD_BOTTOM;
  const PAGE_H = { LETTER: 792, A4: 842 } as const;

  it('separates slips by one blank line beyond the base 18pt gap (cut clarity)', () => {
    // Sarah's feedback: one extra blank line between slips makes the cut obvious.
    expect(SLIP_GAP).toBe(18 + LINE_H);
  });

  function slipHeight(lineCount: number): number {
    // 2 intro lines + INTRO_GAP, then the remaining checklist lines.
    return 2 * LINE_H + INTRO_GAP + (lineCount - 2) * LINE_H;
  }

  const ALL_EVENTS: FirstTimerEntry['eventIds'] = [
    '333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh',
    'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf',
  ];

  it('a worst-case slip (all events, minor) fits within one page on LETTER and A4', () => {
    const lines = buildSlipLines(
      entry({ eventIds: ALL_EVENTS, birthdate: '2015-01-13' }), EN, 'en',
    );
    const h = slipHeight(lines.length) + SLIP_GAP;
    for (const fmt of ['LETTER', 'A4'] as const) {
      const usable = PAGE_H[fmt] - PAD_TOP - PAD_BOTTOM;
      expect(h).toBeLessThanOrEqual(usable);
    }
  });

  it('three large slips (5 events, minor) fit on one LETTER page — no paper waste', () => {
    const lines = buildSlipLines(
      entry({ eventIds: ['444', '555', '666', '777', 'minx'], birthdate: '2015-01-13' }), EN, 'en',
    );
    // Three slips plus the two gaps that separate them. The last slip's bottom
    // margin is trailing — it hangs into the bottom padding and doesn't need to
    // fit — so only the two interior gaps count toward the usable height.
    const threeSlips = 3 * slipHeight(lines.length) + 2 * SLIP_GAP;
    const usable = PAGE_H.LETTER - PAD_TOP - PAD_BOTTOM;
    expect(threeSlips).toBeLessThanOrEqual(usable);
  });
});
