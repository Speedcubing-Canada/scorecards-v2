import type { FirstTimerEntry } from '../lib/wcif-parser';
import { getEventName, type FirstTimerSlipStrings } from '../lib/i18n';
import type { LocaleCode, PaperFormat } from '../types/settings';
import {
  SLIP_LINE_H, SLIP_PAGE_PAD_TOP, SLIP_PAGE_PAD_BOTTOM,
  SLIP_MARGIN_BOTTOM, SLIP_INTRO_MARGIN_BOTTOM,
} from './layoutConstants';

// One rendered line of a slip. `bold` is the trailing value shown in bold (name,
// gender, birthdate, country); `checkbox` toggles the trailing tick box. The first
// two lines are the intro (no checkbox); the rest are the checklist.
export interface SlipLine {
  text: string;
  bold?: string;
  checkbox: boolean;
}

// Constructing an Intl formatter costs far more than using one, and a big competition
// builds hundreds of slips. Keyed by language: everything else is per-call.
const dateFormats = new Map<string, Intl.DateTimeFormat | null>();
const regionNames = new Map<string, Intl.DisplayNames | null>();

function cached<T>(store: Map<string, T | null>, key: string, make: () => T): T | null {
  if (store.has(key)) return store.get(key)!;
  let value: T | null;
  try { value = make(); } catch { value = null; }
  store.set(key, value);
  return value;
}

function formatBirthdate(iso: string, language: LocaleCode): string | null {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const fmt = cached(dateFormats, language, () => new Intl.DateTimeFormat(language, {
    month: 'short', day: '2-digit', year: 'numeric',
  }));
  return fmt ? fmt.format(d) : iso;
}

function countryName(iso2: string, language: LocaleCode): string {
  const names = cached(regionNames, language, () => new Intl.DisplayNames([language], { type: 'region' }));
  try {
    return names?.of(iso2.toUpperCase()) ?? iso2;
  } catch {
    return iso2;
  }
}

function isMinor(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age < 18;
}

function genderWord(gender: 'm' | 'f' | 'o', s: FirstTimerSlipStrings): string {
  if (gender === 'm') return s.genderMale;
  if (gender === 'f') return s.genderFemale;
  return s.genderOther;
}

// Pure derivation of a slip's lines from one entry - the single source of the slip's
// conditional rules (birthdate omitted when absent; parental consent only for a
// present-birthdate minor; single- vs multi-event wording). Unit-tested directly.
export function buildSlipLines(
  entry: FirstTimerEntry, s: FirstTimerSlipStrings, language: LocaleCode,
): SlipLine[] {
  const lines: SlipLine[] = [
    { text: s.confirmIntro1, checkbox: false },
    { text: s.confirmIntro2, checkbox: false },
    { text: s.firstCompetition, checkbox: true },
    { text: s.preferredNamePrefix, bold: entry.name, checkbox: true },
    { text: s.genderPrefix, bold: genderWord(entry.gender, s), checkbox: true },
  ];

  if (entry.birthdate) {
    const formatted = formatBirthdate(entry.birthdate, language);
    if (formatted) lines.push({ text: s.birthdatePrefix, bold: formatted, checkbox: true });
  }
  lines.push({ text: s.citizenshipPrefix, bold: countryName(entry.countryIso2, language), checkbox: true });
  if (entry.birthdate && isMinor(entry.birthdate)) {
    lines.push({ text: s.parentalConsent, checkbox: true });
  }

  const eventNames = entry.eventIds.map((id) => getEventName(id, language));
  if (eventNames.length === 1) {
    lines.push({ text: s.solveSingle(eventNames[0]), checkbox: true });
  } else {
    lines.push({ text: s.solveMultipleIntro, checkbox: false });
    for (const name of eventNames) lines.push({ text: `• ${name}`, checkbox: true });
  }
  return lines;
}

// @react-pdf page heights in points (portrait).
const PAGE_HEIGHT_PT: Record<PaperFormat, number> = { LETTER: 792, A4: 842 };

/** A slip's height: fixed-pitch rows, plus the intro block's gap and the slip's own. */
function slipHeight(entry: FirstTimerEntry, s: FirstTimerSlipStrings, language: LocaleCode): number {
  return buildSlipLines(entry, s, language).length * SLIP_LINE_H
    + SLIP_INTRO_MARGIN_BOTTOM + SLIP_MARGIN_BOTTOM;
}

/**
 * The slips on each page, greedily packed by height - the packing the document renders and
 * the page estimate counts, so the two cannot disagree.
 *
 * Paginated here rather than left to @react-pdf: splitting one tall Page re-measures the
 * content that did not fit once per page produced, which is quadratic in the number of
 * newcomers and is the slowest document at competition scale.
 */
export function packSlipPages(
  entries: FirstTimerEntry[], s: FirstTimerSlipStrings,
  language: LocaleCode, paperFormat: PaperFormat,
): FirstTimerEntry[][] {
  if (entries.length === 0) return [];
  const contentH = (PAGE_HEIGHT_PT[paperFormat] ?? PAGE_HEIGHT_PT.LETTER)
    - SLIP_PAGE_PAD_TOP - SLIP_PAGE_PAD_BOTTOM;

  const pages: FirstTimerEntry[][] = [[]];
  let used = 0;
  for (const entry of entries) {
    const h = slipHeight(entry, s, language);
    if (used > 0 && used + h > contentH) { pages.push([]); used = 0; }
    pages[pages.length - 1].push(entry);
    used += h;
  }
  return pages;
}
