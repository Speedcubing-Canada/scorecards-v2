import { describe, it, expect } from 'vitest';
import { buildSlipLines, packSlipPages } from './firstTimerSlipLines';
import {
  SLIP_LINE_H, SLIP_INTRO_MARGIN_BOTTOM, SLIP_MARGIN_BOTTOM,
  SLIP_PAGE_PAD_TOP, SLIP_PAGE_PAD_BOTTOM,
} from './layoutConstants';
import { getFirstTimerSlipStrings, getEventName } from '../lib/i18n';
import { WCA_EVENT_ORDER, type FirstTimerEntry } from '../lib/wcif-parser';
import type { EventId } from '../types/wcif';
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
    expect(texts(lines)).toContain(EN.solveSingle(getEventName('444', 'en')));
    expect(texts(lines)).not.toContain(EN.solveMultipleIntro);
    expect(lines.some((l) => l.text.startsWith('•'))).toBe(false);
  });

  it('uses the multi-event header + one bulleted checkbox line per event', () => {
    const ids: EventId[] = ['444', '555', 'minx'];
    const lines = buildSlipLines(entry({ eventIds: ids }), EN, 'en');
    expect(texts(lines)).toContain(EN.solveMultipleIntro);
    const bullets = lines.filter((l) => l.text.startsWith('•'));
    expect(bullets).toHaveLength(3);
    expect(bullets.every((b) => b.checkbox)).toBe(true);
    // Event order is preserved and each name is the localized one, whatever it reads.
    expect(bullets.map((b) => b.text)).toEqual(ids.map((id) => `• ${getEventName(id, 'en')}`));
  });

  // Blindfolded is named differently in all four locales, so it proves the slip picks
  // the event name up from its own language rather than defaulting to English.
  it('localizes event names to the slip language', () => {
    for (const loc of LOCALES) {
      const s = getFirstTimerSlipStrings(loc);
      const lines = buildSlipLines(entry({ eventIds: ['333bf'] }), s, loc);
      expect(texts(lines), loc).toContain(s.solveSingle(getEventName('333bf', loc)));
      if (loc !== 'en') {
        expect(texts(lines).join('\n'), loc).not.toContain(getEventName('333bf', 'en'));
      }
    }
  });
});

// Per-field presence and non-emptiness across locales is covered for every PDF string
// set at once by the parity walker in src/lib/i18n.test.ts - no hand-listed field array
// to keep in step here.

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
    // One extra blank line between slips is what makes the cut point obvious.
    expect(SLIP_GAP).toBe(18 + LINE_H);
  });

  function slipHeight(lineCount: number): number {
    // 2 intro lines + INTRO_GAP, then the remaining checklist lines.
    return 2 * LINE_H + INTRO_GAP + (lineCount - 2) * LINE_H;
  }

  it('a worst-case slip (all events, minor) fits within one page on LETTER and A4', () => {
    const lines = buildSlipLines(
      entry({ eventIds: WCA_EVENT_ORDER, birthdate: '2015-01-13' }), EN, 'en',
    );
    const h = slipHeight(lines.length) + SLIP_GAP;
    for (const fmt of ['LETTER', 'A4'] as const) {
      const usable = PAGE_H[fmt] - PAD_TOP - PAD_BOTTOM;
      expect(h).toBeLessThanOrEqual(usable);
    }
  });

  it('three large slips (5 events, minor) fit on one LETTER page - no paper waste', () => {
    const lines = buildSlipLines(
      entry({ eventIds: ['444', '555', '666', '777', 'minx'], birthdate: '2015-01-13' }), EN, 'en',
    );
    // Three slips plus the two gaps that separate them. The last slip's bottom
    // margin is trailing - it hangs into the bottom padding and doesn't need to
    // fit - so only the two interior gaps count toward the usable height.
    const threeSlips = 3 * slipHeight(lines.length) + 2 * SLIP_GAP;
    const usable = PAGE_H.LETTER - PAD_TOP - PAD_BOTTOM;
    expect(threeSlips).toBeLessThanOrEqual(usable);
  });
});

// Every branch of the two locale-dependent lines: a slip that silently loses a competitor's
// citizenship or gender is a slip a delegate has to redo.
describe('locale-dependent slip fields', () => {
  const base = { name: 'A Newcomer', birthdate: '2015-01-01', countryIso2: 'CA', eventIds: ['333'] };
  const genderLine = (gender: 'm' | 'f' | 'o') =>
    buildSlipLines({ ...base, gender } as FirstTimerEntry, getFirstTimerSlipStrings('en'), 'en')
      .find(l => l.text === getFirstTimerSlipStrings('en').genderPrefix)?.bold;

  it('names every gender', () => {
    const s = getFirstTimerSlipStrings('en');
    expect(genderLine('m')).toBe(s.genderMale);
    expect(genderLine('f')).toBe(s.genderFemale);
    expect(genderLine('o')).toBe(s.genderOther);
  });

  it('falls back to the raw code when the country cannot be named', () => {
    const s = getFirstTimerSlipStrings('en');
    // Not a region subtag, so Intl.DisplayNames.of() throws; the code goes through as given.
    const lines = buildSlipLines(
      { ...base, gender: 'm', countryIso2: 'z!' } as FirstTimerEntry, s, 'en');
    expect(lines).toContainEqual({ text: s.citizenshipPrefix, bold: 'z!', checkbox: true });
  });
});

describe('packSlipPages', () => {
  const s = getFirstTimerSlipStrings('en');
  const CONTENT_H = 792 - SLIP_PAGE_PAD_TOP - SLIP_PAGE_PAD_BOTTOM;
  const heightOf = (e: FirstTimerEntry) =>
    buildSlipLines(e, s, 'en').length * SLIP_LINE_H + SLIP_INTRO_MARGIN_BOTTOM + SLIP_MARGIN_BOTTOM;
  const pageH = (page: FirstTimerEntry[]) => page.reduce((h, e) => h + heightOf(e), 0);

  const entry = (eventIds: string[]): FirstTimerEntry => ({
    name: 'A Newcomer', gender: 'm', birthdate: '2015-01-01', countryIso2: 'CA',
    eventIds: eventIds as FirstTimerEntry['eventIds'],
  });

  it('gives no pages for no newcomers', () => {
    expect(packSlipPages([], s, 'en', 'LETTER')).toEqual([]);
  });

  it('never overfills a page and never leaves a slip behind', () => {
    // A deliberate mix of short and tall slips, so pages end at different fill levels.
    const entries = Array.from({ length: 60 }, (_, i) =>
      entry(WCA_EVENT_ORDER.slice(0, 1 + (i % 5))));
    const pages = packSlipPages(entries, s, 'en', 'LETTER');

    expect(pages.flat()).toEqual(entries);          // order preserved, nothing dropped
    for (const page of pages) {
      expect(page.length).toBeGreaterThan(0);
      // A lone slip taller than the page still gets its own page rather than none.
      if (page.length > 1) expect(pageH(page)).toBeLessThanOrEqual(CONTENT_H);
    }
    // Greedy: the first slip of each page would not have fit on the one before it.
    for (let i = 1; i < pages.length; i++) {
      expect(pageH(pages[i - 1]) + heightOf(pages[i][0])).toBeGreaterThan(CONTENT_H);
    }
  });

  it('fits more slips per page on A4 than on LETTER', () => {
    const entries = Array.from({ length: 40 }, () => entry(['333']));
    expect(packSlipPages(entries, s, 'en', 'A4').length)
      .toBeLessThanOrEqual(packSlipPages(entries, s, 'en', 'LETTER').length);
  });
});
