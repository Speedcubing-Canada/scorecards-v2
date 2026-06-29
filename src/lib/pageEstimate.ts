import type { ParsedWCIF } from './wcif-parser';
import type { CompetitionSettings, PaperFormat } from '../types/settings';
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
 * Estimate how many printed pages the current selection will produce, so the Generate
 * page can show a realistic volume before the (expensive) render runs.
 *
 * Exact for scorecards and name tags, which paginate at a fixed N-per-page. The schedule
 * tracker and first-timer slips flow with @react-pdf auto-pagination, so those are close
 * estimates: the schedule counts as one page, and slips are greedily packed by height.
 *
 * Pass the scope-filtered parsed result (effectiveParsed) so the count matches the ZIP.
 */
export function estimateTotalPages(parsed: ParsedWCIF, settings: CompetitionSettings): number {
  let pages = 0;

  // Scorecards — one PDF per non-empty round, four cards per page (exact).
  for (const round of [parsed.firstRound, parsed.intermediate, parsed.semis, parsed.finals, parsed.extras]) {
    if (round.length > 0) pages += Math.ceil(round.length / SCORECARDS_PER_PAGE);
  }

  // Custom events — each is its own PDF of four identical blanks → one page.
  pages += (settings.customEvents ?? []).filter((c) => c.name.trim() !== '').length;

  // Name tags — four people per page (exact).
  if (parsed.nametags.length > 0) pages += Math.ceil(parsed.nametags.length / NAMETAGS_PER_PAGE);

  // Schedule tracker — a single flowing page today (estimate).
  if (parsed.scheduleDays.length > 0) pages += 1;

  // First-timer slips — greedily pack whole slips (wrap={false}) by height (estimate).
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
