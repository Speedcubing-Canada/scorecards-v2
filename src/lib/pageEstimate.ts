import type { ParsedWCIF } from './wcif-parser';
import type { CompetitionSettings, PaperFormat } from '../types/settings';
import { customEventPageCount } from './customScorecards';
import { getFirstTimerSlipStrings } from './i18n';
import { buildSlipLines } from '../pdf/firstTimerSlipLines';
import {
  SCORECARDS_PER_PAGE, NAMETAGS_PER_PAGE,
  SLIP_LINE_H, SLIP_PAGE_PAD_TOP, SLIP_PAGE_PAD_BOTTOM,
  SLIP_MARGIN_BOTTOM, SLIP_INTRO_MARGIN_BOTTOM,
} from '../pdf/layoutConstants';

// @react-pdf page heights in points (portrait). The schedule and slip docs use these.
const PAGE_HEIGHT_PT: Record<PaperFormat, number> = { LETTER: 792, A4: 842 };

/**
 * Printed page count, shown before the expensive render runs. Exact for scorecards and name
 * tags, which paginate at a fixed N-per-page; the schedule tracker and slips flow with
 * @react-pdf auto-pagination and are estimated.
 *
 * Takes the scope-filtered parse, so the count matches the ZIP.
 */
export function estimateTotalPages(parsed: ParsedWCIF, settings: CompetitionSettings): number {
  let pages = 0;

  for (const round of [parsed.firstRound, parsed.intermediate, parsed.semis, parsed.finals, parsed.extras]) {
    if (round.length > 0) pages += Math.ceil(round.length / SCORECARDS_PER_PAGE);
  }

  // Each custom event is its own PDF: a page of blanks, or ceil(n/4) with CSV competitors.
  pages += (settings.customEvents ?? [])
    .filter((c) => c.name.trim() !== '')
    .reduce((n, c) => n + customEventPageCount(c), 0);

  if (parsed.nametags.length > 0) pages += Math.ceil(parsed.nametags.length / NAMETAGS_PER_PAGE);

  // A single flowing page, estimated.
  if (parsed.scheduleDays.length > 0) pages += 1;

  // Same approximation. `checkingDays` is already empty when the checklist wasn't selected.
  if (parsed.checkingDays.length > 0) pages += 1;

  // Whole slips greedily packed by height, estimated.
  if (parsed.firstTimers.length > 0) {
    pages += estimateSlipPages(parsed, settings);
  }

  return pages;
}

function estimateSlipPages(parsed: ParsedWCIF, settings: CompetitionSettings): number {
  const strings = getFirstTimerSlipStrings(settings.language);
  const contentH = (PAGE_HEIGHT_PT[settings.paperFormat] ?? PAGE_HEIGHT_PT.LETTER)
    - SLIP_PAGE_PAD_TOP - SLIP_PAGE_PAD_BOTTOM;

  let pages = 1;
  let used = 0;
  for (const entry of parsed.firstTimers) {
    const lineCount = buildSlipLines(entry, strings, settings.language).length;
    const slipH = lineCount * SLIP_LINE_H + SLIP_INTRO_MARGIN_BOTTOM + SLIP_MARGIN_BOTTOM;
    if (used > 0 && used + slipH > contentH) {
      pages += 1;
      used = 0;
    }
    used += slipH;
  }
  return pages;
}
