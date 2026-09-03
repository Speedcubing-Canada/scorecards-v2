import type { WCIF } from '../types/wcif';
import type { ParsedWCIF } from './wcif-parser';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import type { PdfJob } from './pdfJobs';

/**
 * Anonymous usage events, so we can see which competitions the tool is used on and which
 * settings organizers actually pick. Posted to /api/event, which logs them and stores
 * nothing else - see analytics.js and server.js.
 *
 * Never send anything that identifies a person: no WCA user id, no competitor names, no
 * WCIF content, no uploaded logo. Competition ids are public WCA data.
 *
 * The builders are pure so they can be tested without a DOM; `send` is the only part that
 * touches the network, and it can never throw into the caller.
 */

const ENDPOINT = '/api/event';

/** localStorage, not sessionStorage: an opt-out that dies with the tab is not an opt-out. */
const OPT_OUT_KEY = 'analytics_opt_out';

/** Storage throws in private mode, and this runs mid-render, so a failure means opted in. */
export function isOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOptedOut(optedOut: boolean): void {
  try {
    localStorage.setItem(OPT_OUT_KEY, String(optedOut));
  } catch {
    // ignore persistence failures (e.g. private mode)
  }
}

export type AnalyticsEvent = Record<string, unknown> & { v: 1; event: string };

/** Where a failure happened, coarse enough to stay anonymous. */
export type ErrorStage = 'fetch' | 'parse' | 'render';

/** Which logo the scorecards carry - never the data URL itself. */
function logoChoice(settings: CompetitionSettings): 'none' | 'default' | 'custom' {
  if (settings.logoDataUrl) return 'custom';
  return settings.useDefaultLogo ? 'default' : 'none';
}

/** The document types the user asked for, as a stable sorted list. */
function selectedDocuments(settings: CompetitionSettings): string[] {
  const docs = settings.generationScope?.documents;
  if (!docs) return [];
  return Object.entries(docs)
    .filter(([, on]) => on)
    .map(([name]) => name)
    .sort();
}

/**
 * How big the competition is. Read from the UNFILTERED parse: this describes the event
 * itself, not the subset someone chose to print, so it must not shrink when the generation
 * scope narrows. `wcif` is null for custom (non-WCA) competitions, which have no WCIF.
 */
function competitionSize(parsed: ParsedWCIF, wcif: WCIF | null) {
  const stages = new Set<string>();
  for (const day of parsed.scheduleDays)
    for (const stage of day.stages) stages.add(stage.stageName);

  let groups = 0;
  for (const day of parsed.checkingDays)
    for (const row of day.rows) groups += row.groupCount;

  return {
    competitors: parsed.nametags.length,
    events: wcif?.events.length ?? 0,
    rounds: wcif?.events.reduce((n, e) => n + e.rounds.length, 0) ?? 0,
    groups,
    stages: stages.size,
    days: parsed.scheduleDays.length,
  };
}

/** Venue location, for the dashboard map. Null for custom competitions. */
function competition(settings: CompetitionSettings, wcif: WCIF | null) {
  const venue = wcif?.schedule.venues[0];
  return {
    id: settings.competitionId,
    country: venue?.countryIso2 ?? null,
    lat: venue ? venue.latitudeMicrodegrees / 1e6 : null,
    lng: venue ? venue.longitudeMicrodegrees / 1e6 : null,
    custom: settings.isCustomCompetition,
  };
}

export function buildGenerateEvent(args: {
  /** Unfiltered parse - describes the competition. */
  parsed: ParsedWCIF;
  /** Raw WCIF for venue and event counts; null for a custom competition. */
  wcif: WCIF | null;
  settings: CompetitionSettings;
  uiLanguage: LocaleCode;
  presetId: string | null;
  /** What was actually produced, from the filtered parse. */
  output: { pdfs: number; pages: number; scorecards: number; coverCards: number };
}): AnalyticsEvent {
  const { parsed, wcif, settings, uiLanguage, presetId, output } = args;
  return {
    v: 1,
    event: 'generate',
    comp: competition(settings, wcif),
    size: competitionSize(parsed, wcif),
    output,
    settings: {
      paperFormat: settings.paperFormat,
      language: settings.language,
      secondaryLanguage: settings.secondaryLanguage,
      uiLanguage,
      nametagLayout: settings.nametagLayout,
      nametagLogoMode: settings.nametagLogoMode,
      nametagQrMode: settings.nametagQrMode,
      logo: logoChoice(settings),
      hideWcaLiveId: settings.hideWcaLiveId,
      secondRoundMode: settings.secondRoundMode,
      scorecardCheckMode: settings.scorecardCheckMode,
      scrambleDoubleCheck: settings.scrambleDoubleCheck,
      customEvents: (settings.customEvents ?? []).filter(c => c.name.trim()).length,
      preset: presetId,
    },
    scope: {
      mode: settings.generationScope?.mode ?? 'everything',
      documents: selectedDocuments(settings),
    },
  };
}

/** Truncated because it lands in a log line; the sanitiser caps it again server-side. */
export function buildErrorEvent(
  competitionId: string,
  stage: ErrorStage,
  error: unknown,
): AnalyticsEvent {
  return {
    v: 1,
    event: 'error',
    comp: { id: competitionId },
    stage,
    message: String(error).slice(0, 200),
  };
}

/** One per tab, to compare "started the flow" against "finished it". */
export function buildSessionEvent(): AnalyticsEvent {
  return { v: 1, event: 'session' };
}

/** Counts derived from the FILTERED parse - what the download actually contains. */
export function buildOutput(
  jobs: PdfJob[],
  pages: number,
  scorecards: number,
  coverCards: number,
) {
  return { pdfs: jobs.length, pages, scorecards, coverCards };
}

/**
 * Fire and forget. Silent in dev and in the fixture renderer, so only real use is counted.
 * Analytics must never be able to break generation, so every failure is swallowed.
 *
 * The opt-out is checked here and nowhere else, so it covers every event and call site.
 */
export function send(event: AnalyticsEvent): void {
  if (!import.meta.env.PROD || isOptedOut()) return;
  try {
    navigator.sendBeacon?.(
      ENDPOINT,
      new Blob([JSON.stringify(event)], { type: 'application/json' }),
    );
  } catch {
    // Beacon refused (payload too large, page unloading). Nothing to do about it.
  }
}
