import {
  finalizeEntries, realEntries,
  type ScorecardData, type ParsedWCIF, type NametTagEntry,
} from './wcif-parser';
import type { CompetitionSettings, CustomEvent } from '../types/settings';
import {
  SCORECARDS_PER_PAGE, MAX_PAGES_PER_SCORECARD_PDF,
  NAMETAGS_PER_PAGE, MAX_PAGES_PER_NAMETAG_PDF,
} from '../pdf/layoutConstants';

const CARDS_PER_PDF = MAX_PAGES_PER_SCORECARD_PDF * SCORECARDS_PER_PAGE;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const TAGS_PER_PDF  = MAX_PAGES_PER_NAMETAG_PDF  * NAMETAGS_PER_PAGE;

/**
 * One PDF to render. The worker builds the files and the UI counts and names them off this
 * same list, so a document cannot reach one and not the other.
 *
 * Custom events carry the raw `CustomEvent`: `buildCustomEntries` is worth paying for inside
 * the worker, not on every render of the generate page.
 */
export type PdfJob =
  | { kind: 'scorecards';   filename: string; label: string; entries: ScorecardData[] }
  | { kind: 'nametags';     filename: string; label: string; nametags: NametTagEntry[] }
  | { kind: 'schedule';     filename: string; label: string }
  | { kind: 'checking';     filename: string; label: string }
  | { kind: 'first-timers'; filename: string; label: string }
  | { kind: 'custom';       filename: string; label: string; custom: CustomEvent };

/**
 * One PDF for a scorecard bucket, or one per event once the bucket is too big for
 * @react-pdf to lay out in a single document. A small competition is never split, so its
 * output is unchanged.
 *
 * Splitting happens on the pre-padding entries and re-finalizes each event: finalizeEntries
 * pads to a multiple of 4 and quadrant-reorders for 4-up printing, so a plain slice of its
 * output is not a printable pile.
 */
function scorecardJobs(
  entries: ScorecardData[], competitionId: string, slug: string, label: string,
): PdfJob[] {
  if (entries.length === 0) return [];
  if (entries.length <= CARDS_PER_PDF)
    return [{ kind: 'scorecards', filename: `${competitionId}_${slug}.pdf`, entries, label }];

  const byEvent = new Map<string, ScorecardData[]>();
  for (const entry of realEntries(entries)) {
    const list = byEvent.get(entry.eventId);
    if (list) list.push(entry);
    else byEvent.set(entry.eventId, [entry]);
  }

  return [...byEvent]
    // Earliest group first, then event id: the same order the entries were already in, so
    // the files come out in the order the rounds run.
    .map(([eventId, list]) => ({
      eventId,
      eventName: list[0].eventName,
      minTimeslot: list.reduce((m, e) => (e.timeslot < m ? e.timeslot : m), list[0].timeslot),
      list,
    }))
    .sort((a, b) => cmp(a.minTimeslot, b.minTimeslot) || cmp(a.eventId, b.eventId))
    .flatMap(({ eventId, eventName, list }) =>
      splitToCap(finalizeEntries(list), `${competitionId}_${slug}_${eventId}`, `${label} (${eventName})`));
}

/**
 * One file, or equal parts of one when a single event is still too big - a championship-sized
 * field is thousands of cards for one event, and there is no smaller meaningful unit to cut on.
 *
 * Cuts on sheet boundaries. `finalizeEntries` has already quadrant-reordered the pile, so every
 * run of 4 is one printed 4-up sheet and slicing between them keeps each file a printable run.
 */
function splitToCap(entries: ScorecardData[], base: string, label: string): PdfJob[] {
  if (entries.length <= CARDS_PER_PDF)
    return [{ kind: 'scorecards', filename: `${base}.pdf`, entries, label }];

  const chunks = evenChunks(entries, CARDS_PER_PDF, SCORECARDS_PER_PAGE);
  return chunks.map((slice, i) => ({
    kind: 'scorecards',
    filename: `${base}_part${i + 1}.pdf`,
    entries: slice,
    label: `${label} ${i + 1}/${chunks.length}`,
  }));
}

/**
 * Equal slices of at most `cap`, each a whole number of `unit`s (a printed sheet) except
 * the last. Even rather than greedy, so the parts of one pile are comparable in thickness.
 */
function evenChunks<T>(items: T[], cap: number, unit: number): T[][] {
  const parts = Math.ceil(items.length / cap);
  const per = Math.ceil(items.length / parts / unit) * unit;
  const out: T[][] = [];
  for (let start = 0; start < items.length; start += per) out.push(items.slice(start, start + per));
  return out;
}

/**
 * One name tag PDF, or equal parts of one past the cap. Tags are cut apart per person, so a
 * part boundary costs nothing; a single unbounded document is what does.
 */
function nametagJobs(nametags: NametTagEntry[], competitionId: string): PdfJob[] {
  if (nametags.length === 0) return [];
  if (nametags.length <= TAGS_PER_PDF)
    return [{ kind: 'nametags', filename: `${competitionId}_nametags.pdf`, label: 'Name Tags', nametags }];

  // Whole sheets, so no page is half-empty in the middle of the run.
  const chunks = evenChunks(nametags, TAGS_PER_PDF, NAMETAGS_PER_PAGE);
  return chunks.map((slice, i) => ({
    kind: 'nametags',
    filename: `${competitionId}_nametags_part${i + 1}.pdf`,
    label: `Name Tags ${i + 1}/${chunks.length}`,
    nametags: slice,
  }));
}

/** Custom-event names become filenames, so strip anything a filesystem dislikes. */
function safeCustomName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

/**
 * The PDFs a parse produces, in render order. An emptied bucket produces no job, which is how
 * document selection is enforced; there is no per-document flag down here.
 */
export function buildPdfJobs(parsed: ParsedWCIF, settings: CompetitionSettings): PdfJob[] {
  const id = settings.competitionId;
  const jobs: PdfJob[] = [];

  jobs.push(...scorecardJobs(parsed.firstRound,   id, 'round1', 'Round 1'));
  jobs.push(...scorecardJobs(parsed.intermediate, id, 'round2', 'Round 2'));
  jobs.push(...scorecardJobs(parsed.semis,        id, 'semis',  'Semis'));
  jobs.push(...scorecardJobs(parsed.finals,       id, 'finals', 'Finals'));
  // Never split: one card per round is a handful of pages, and extras are not produced by
  // finalizeEntries, so they must not be run back through it.
  if (parsed.extras.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_extras.pdf`, entries: parsed.extras, label: 'Extras' });
  if (parsed.scheduleDays.length > 0)
    jobs.push({ kind: 'schedule', filename: `${id}_schedule.pdf`, label: 'Schedule Tracker' });
  // Already emptied by filterParsedByScope unless the Round Checklist was selected.
  if (parsed.checkingDays.length > 0)
    jobs.push({ kind: 'checking', filename: `${id}_checklist.pdf`, label: 'Round Checklist' });
  jobs.push(...nametagJobs(parsed.nametags, id));
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
 * Driven by the jobs, not the settings, so a schedule-only download is never told how to cut
 * scorecards. Custom-event cards print 4-up alongside ordinary ones, so they fold in.
 */
export type GuideSection = 'scorecards' | 'schedule' | 'checking' | 'nametags' | 'first-timers';

export function guideSections(jobs: PdfJob[]): GuideSection[] {
  const kinds = new Set(jobs.map(j => j.kind));
  const out: GuideSection[] = [];
  if (kinds.has('scorecards') || kinds.has('custom')) out.push('scorecards');
  if (kinds.has('schedule')) out.push('schedule');
  if (kinds.has('checking')) out.push('checking');
  if (kinds.has('nametags')) out.push('nametags');
  if (kinds.has('first-timers')) out.push('first-timers');
  return out;
}

/** A lone PDF ships as itself, printable straight from the download; two or more are zipped. */
export function downloadTarget(
  jobs: PdfJob[],
  competitionId: string,
): { filename: string; mimeType: string } {
  if (jobs.length === 1) {
    return { filename: jobs[0].filename, mimeType: 'application/pdf' };
  }
  return { filename: `${competitionId}_pdfs.zip`, mimeType: 'application/zip' };
}
