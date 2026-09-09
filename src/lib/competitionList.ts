import type { WCACompetition } from '../types/wcif';

/**
 * WCA dates are YYYY-MM-DD, so compare as strings: `new Date('2026-09-09')` parses as UTC
 * midnight and would drop a same-day competition west of GMT.
 *
 * `includePast` is a parameter rather than an `import.meta.env` read so both branches are
 * testable (vitest reports DEV, not PROD).
 */
export function visibleCompetitions(
  comps: WCACompetition[],
  today: string,
  includePast: boolean,
): WCACompetition[] {
  const byStart = (a: WCACompetition, b: WCACompetition) => a.start_date.localeCompare(b.start_date);
  // Ongoing counts as visible: a competition is over only once its end_date has passed.
  const current = comps.filter(c => c.end_date >= today).sort(byStart);
  if (!includePast) return current;
  return [...current, ...comps.filter(c => c.end_date < today).sort((a, b) => byStart(b, a))];
}
