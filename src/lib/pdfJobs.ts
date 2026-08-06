import type { ScorecardData, ParsedWCIF } from './wcif-parser';
import type { CompetitionSettings, CustomEvent } from '../types/settings';

/**
 * One PDF to render. The worker turns each of these into a file; the UI counts
 * them for the "PDFs" stat and names the download from them. Both sides read
 * the same list so a new document type can never be added to one and not the
 * other.
 *
 * Custom events carry the raw `CustomEvent` rather than pre-built entries -
 * `buildCustomEntries` is only worth paying for inside the worker, not on every
 * render of the generate page.
 */
export type PdfJob =
  | { kind: 'scorecards';   filename: string; label: string; entries: ScorecardData[] }
  | { kind: 'nametags';     filename: string; label: string }
  | { kind: 'schedule';     filename: string; label: string }
  | { kind: 'checking';     filename: string; label: string }
  | { kind: 'first-timers'; filename: string; label: string }
  | { kind: 'custom';       filename: string; label: string; custom: CustomEvent };

/** Custom-event names become filenames, so strip anything a filesystem dislikes. */
function safeCustomName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

/**
 * The PDFs a given parse produces, in the order they are rendered and listed.
 * Buckets that `filterParsedByScope` emptied produce no job, which is how
 * document selection is enforced - there is no per-document flag down here.
 */
export function buildPdfJobs(parsed: ParsedWCIF, settings: CompetitionSettings): PdfJob[] {
  const id = settings.competitionId;
  const jobs: PdfJob[] = [];

  if (parsed.firstRound.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round1.pdf`, entries: parsed.firstRound, label: 'Round 1' });
  if (parsed.intermediate.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round2.pdf`, entries: parsed.intermediate, label: 'Round 2' });
  if (parsed.semis.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_semis.pdf`, entries: parsed.semis, label: 'Semis' });
  if (parsed.finals.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_finals.pdf`, entries: parsed.finals, label: 'Finals' });
  if (parsed.extras.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_extras.pdf`, entries: parsed.extras, label: 'Extras' });
  if (parsed.scheduleDays.length > 0)
    jobs.push({ kind: 'schedule', filename: `${id}_schedule.pdf`, label: 'Schedule Tracker' });
  // Already emptied by filterParsedByScope unless the Round Checklist was selected.
  if (parsed.checkingDays.length > 0)
    jobs.push({ kind: 'checking', filename: `${id}_checklist.pdf`, label: 'Round Checklist' });
  if (parsed.nametags.length > 0)
    jobs.push({ kind: 'nametags', filename: `${id}_nametags.pdf`, label: 'Name Tags' });
  if (parsed.firstTimers.length > 0)
    jobs.push({ kind: 'first-timers', filename: `${id}_first_timers.pdf`, label: 'First-Timer Slips' });

  for (const custom of settings.customEvents ?? []) {
    if (!custom.name.trim()) continue;
    jobs.push({
      kind: 'custom',
      filename: `${id}_custom_${safeCustomName(custom.name)}.pdf`,
      label: custom.name,
      custom,
    });
  }

  return jobs;
}

/**
 * What the browser actually downloads. A lone PDF ships as itself so it can be
 * printed straight from the download - zipping a single file only adds a step.
 * Two or more still bundle: not "_scorecards", since the bundle routinely
 * carries nametags, slips and the schedule too.
 */
export function downloadTarget(
  jobs: PdfJob[],
  competitionId: string,
): { filename: string; mimeType: string } {
  if (jobs.length === 1) {
    return { filename: jobs[0].filename, mimeType: 'application/pdf' };
  }
  return { filename: `${competitionId}_pdfs.zip`, mimeType: 'application/zip' };
}
