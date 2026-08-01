import type { FirstTimerEntry } from '../lib/wcif-parser';
import { getEventName, type FirstTimerSlipStrings } from '../lib/i18n';
import type { LocaleCode } from '../types/settings';

// One rendered line of a slip. `bold` is the trailing value shown in bold (name,
// gender, birthdate, country); `checkbox` toggles the trailing tick box. The first
// two lines are the intro (no checkbox); the rest are the checklist.
export interface SlipLine {
  text: string;
  bold?: string;
  checkbox: boolean;
}

export function formatBirthdate(iso: string, language: LocaleCode): string | null {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(language, {
      month: 'short', day: '2-digit', year: 'numeric',
    }).format(d);
  } catch {
    return iso;
  }
}

export function countryName(iso2: string, language: LocaleCode): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(iso2.toUpperCase()) ?? iso2;
  } catch {
    return iso2;
  }
}

export function isMinor(iso: string): boolean {
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
