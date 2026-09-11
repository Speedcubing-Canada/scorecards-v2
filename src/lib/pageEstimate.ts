import type { ParsedWCIF } from './wcif-parser';
import type { PdfJob } from './pdfJobs';
import type { CompetitionSettings } from '../types/settings';
import { customEventPageCount } from './customScorecards';
import { getFirstTimerSlipStrings } from './i18n';
import { packSlipPages } from '../pdf/firstTimerSlipLines';
import { SCORECARDS_PER_PAGE, NAMETAGS_PER_PAGE } from '../pdf/layoutConstants';

/**
 * Printed page count, shown before the expensive render runs. Exact for scorecards and name
 * tags, which paginate at a fixed N-per-page; the schedule tracker and slips flow with
 * @react-pdf auto-pagination and are estimated.
 *
 * Takes the scope-filtered parse and the job list built from it, so the count matches the
 * ZIP. The jobs are what carries the scorecard count: a bucket split into one PDF per event
 * pads each file to a multiple of 4 separately, which the bucket lengths cannot show.
 */
export function estimateTotalPages(
  parsed: ParsedWCIF, settings: CompetitionSettings, jobs: PdfJob[],
): number {
  let pages = 0;

  for (const job of jobs) {
    if (job.kind === 'scorecards') pages += Math.ceil(job.entries.length / SCORECARDS_PER_PAGE);
  }

  // Each custom event is its own PDF: a page of blanks, or ceil(n/4) with CSV competitors.
  pages += (settings.customEvents ?? [])
    .filter((c) => c.name.trim() !== '')
    .reduce((n, c) => n + customEventPageCount(c), 0);

  // Per job, not per parse: a big field splits into parts that each pad to a full sheet.
  for (const job of jobs) {
    if (job.kind === 'nametags') pages += Math.ceil(job.nametags.length / NAMETAGS_PER_PAGE);
  }

  // A single flowing page, estimated.
  if (parsed.scheduleDays.length > 0) pages += 1;

  // Same approximation. `checkingDays` is already empty when the checklist wasn't selected.
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
