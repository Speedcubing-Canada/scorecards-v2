import type { CustomCompetitor } from '../types/settings';

const WCA_ID_RE = /^\d{4}[A-Z]{4}\d{2}$/i;

/**
 * Parse a custom event's competitor CSV.
 *
 * Format: one competitor per line, no quoting:
 *   Name
 *   Name,WCAID
 * e.g.
 *   Alice Martin
 *   Bob Tremblay,2021TREM02
 *
 * Blank lines and lines beginning with `#` (comments) are ignored. An optional
 * header row is skipped when its first field is "name" (case-insensitive). A
 * leading UTF-8 BOM is stripped. The WCA ID is recognized as the LAST
 * comma-field matching the ID shape (4 digits, 4 letters, 2 digits) and is
 * upper-cased; everything before it is the name, re-joined with ", " so
 * comma-containing names like "Doe, John,2019DOEJ01" survive without quoting.
 * Rows with an empty name are skipped; duplicates are kept (two rows = two cards).
 */
export function parseCompetitorCsv(text: string): CustomCompetitor[] {
  const out: CustomCompetitor[] = [];
  if (!text) return out;

  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  let first = true;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const fields = line.split(',').map(f => f.trim());
    if (first) {
      first = false;
      if (fields[0].toLowerCase() === 'name') continue; // header row
    }

    let name: string;
    let wcaId: string;
    const last = fields[fields.length - 1];
    if (fields.length > 1 && WCA_ID_RE.test(last)) {
      wcaId = last.toUpperCase();
      name = fields.slice(0, -1).filter(Boolean).join(', ');
    } else {
      wcaId = '';
      name = fields.filter(Boolean).join(', ');
    }

    if (!name) continue;
    out.push({ name, wcaId });
  }

  return out;
}
