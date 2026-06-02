import type { ScrambleDoubleCheckOverrides } from '../types/settings';

/**
 * Parse the scramble double-checking override file.
 *
 * Format: CSV, one competitor per line, no header:
 *   WCAID,event1,event2,...
 * e.g.
 *   2015FOOB01,333,444
 *   2018BARS02,333bf,555bf
 *
 * Blank lines and lines beginning with `#` (comments) are ignored. Lines with a
 * WCA ID but no events are skipped. WCA IDs are upper-cased; event IDs are
 * lower-cased, trimmed and de-duplicated. A future helper script may generate
 * this file from a competition's schedule.
 */
export function parseDoubleCheckOverrides(text: string): ScrambleDoubleCheckOverrides {
  const out: ScrambleDoubleCheckOverrides = {};
  if (!text) return out;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const tokens = line.split(',').map(t => t.trim()).filter(Boolean);
    if (tokens.length < 2) continue; // need a WCA ID + at least one event

    const wcaId = tokens[0].toUpperCase();
    const events = tokens.slice(1).map(t => t.toLowerCase());

    const existing = out[wcaId] ?? [];
    for (const ev of events) {
      if (!existing.includes(ev)) existing.push(ev);
    }
    out[wcaId] = existing;
  }

  return out;
}
