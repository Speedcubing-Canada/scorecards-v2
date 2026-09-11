import type { ParsedWCIF } from './wcif-parser';
import type { PdfJob } from './pdfJobs';
import type { CompetitionSettings } from '../types/settings';
import { customEventPageCount } from './customScorecards';
import { getFirstTimerSlipStrings } from './i18n';
import { packSlipPages } from '../pdf/firstTimerSlipLines';
import { SCORECARDS_PER_PAGE, NAMETAGS_PER_PAGE } from '../pdf/layoutConstants';

/**
 * Printed page count, shown before the render runs. Exact where pagination is fixed N-per-page,
 * estimated for the flowing documents. Counts `jobs`, not `parsed`, so it matches the ZIP.
 */
export function estimateTotalPages(
  parsed: ParsedWCIF, settings: CompetitionSettings, jobs: PdfJob[],
): number {
  let pages = 0;

  // Per job, not per parse: a split bucket pads each file to a full sheet separately.
  for (const job of jobs) {
    if (job.kind === 'scorecards') pages += Math.ceil(job.entries.length / SCORECARDS_PER_PAGE);
    if (job.kind === 'nametags')   pages += Math.ceil(job.nametags.length / NAMETAGS_PER_PAGE);
  }

  // Each custom event is its own PDF: a page of blanks, or ceil(n/4) with CSV competitors.
  pages += (settings.customEvents ?? [])
    .filter((c) => c.name.trim() !== '')
    .reduce((n, c) => n + customEventPageCount(c), 0);

  // A single flowing page, estimated.
  if (parsed.scheduleDays.length > 0) pages += 1;

  // `checkingDays` is already empty when the checklist wasn't selected.
  if (parsed.checkingDays.length > 0) pages += 1;

  // Exact: the document renders this same packing.
  if (parsed.firstTimers.length > 0) {
    pages += estimateSlipPages(parsed, settings);
  }

  return pages;
}

function estimateSlipPages(parsed: ParsedWCIF, settings: CompetitionSettings): number {
  return packSlipPages(
    parsed.firstTimers,
    getFirstTimerSlipStrings(settings.language),
    settings.language,
    settings.paperFormat,
  ).length;
}
