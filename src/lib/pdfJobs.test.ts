import { describe, it, expect } from 'vitest';
import { buildPdfJobs, downloadTarget, guideSections } from './pdfJobs';
import type { PdfJob } from './pdfJobs';
import { filterParsedByScope } from './generationScope';
import type { ParsedWCIF, ScorecardEntry, CoverEntry } from './wcif-parser';
import type { CompetitionSettings, CustomEvent } from '../types/settings';

// ── Builders ──────────────────────────────────────────────────────────────────
function sc(roundNum = 1, name = ''): ScorecardEntry {
  return {
    kind: 'scorecard', timeslot: 'a01', eventId: '333', eventName: '333',
    roundLabel: `Round ${roundNum}`, roundNum, group: 'Group 1 of 1',
    name, wcaId: '', liveId: '', gender: 'm', cutoff: '', limit: '',
    format: 'avg5', isCumulative: false,
  };
}
function cover(roundNum = 1): CoverEntry {
  return {
    kind: 'cover', timeslot: 'a01', eventId: '333', eventName: '333',
    roundLabel: `Round ${roundNum}`, roundNum, group: 'Group 1 of 1', numScorecards: 1, numGroups: 1,
  };
}

function mkParsed(over: Partial<ParsedWCIF> = {}): ParsedWCIF {
  return {
    firstRound: [], intermediate: [], semis: [], finals: [],
    nametags: [], firstTimers: [], extras: [], scheduleDays: [], checkingDays: [],
    laterRoundsWithAssignments: [], hasGroups: true,
    ...over,
  };
}

function mkSettings(over: Partial<CompetitionSettings> = {}): CompetitionSettings {
  return {
    competitionId: 'Test2026', competitionName: 'Test 2026',
    language: 'en', secondaryLanguage: null, paperFormat: 'LETTER',
    secondRoundMode: 'blanks', logoDataUrl: null, useDefaultLogo: true,
    wcaLiveId: null, wcaLivePersonIds: null, hideWcaLiveId: false,
    customEvents: [],
    generationScope: { mode: 'everything' },
    isCustomCompetition: false,
    ...over,
  } as CompetitionSettings;
}

const customEvent = (name: string): CustomEvent =>
  ({ name, format: 'avg5', cutoff: '', limit: '', iconDataUrl: null }) as unknown as CustomEvent;

const allDocs = {
  scorecards: true, scheduleTracker: true, nametags: true,
  roundChecklist: true, firstTimerSlips: true,
};
const noDocs = {
  scorecards: false, scheduleTracker: false, nametags: false,
  roundChecklist: false, firstTimerSlips: false,
};

/** A parse with every bucket populated - the full pre-competition case. */
const fullParsed = mkParsed({
  firstRound: [sc(1, 'A'), cover(1)],
  intermediate: [sc(2, 'A'), cover(2)],
  semis: [sc(3)],
  finals: [sc(4)],
  extras: [sc(1)],
  nametags: [{ name: 'x' } as never],
  firstTimers: [{ name: 'y' } as never],
  scheduleDays: [{ dayLabel: 'Day 1', stages: [] } as never],
  checkingDays: [{ dayLabel: 'Day 1', rows: [] } as never],
});

describe('buildPdfJobs', () => {
  // Locks the filenames and the emission order that used to live inline in
  // scorecardWorker.ts - these names are what people look for after printing.
  it('emits every document in render order with the established filenames', () => {
    const jobs = buildPdfJobs(fullParsed, mkSettings({ customEvents: [customEvent('Mini Guildford')] }));
    expect(jobs.map(j => j.filename)).toEqual([
      'Test2026_round1.pdf',
      'Test2026_round2.pdf',
      'Test2026_semis.pdf',
      'Test2026_finals.pdf',
      'Test2026_extras.pdf',
      'Test2026_schedule.pdf',
      'Test2026_checklist.pdf',
      'Test2026_nametags.pdf',
      'Test2026_first_timers.pdf',
      'Test2026_custom_Mini_Guildford.pdf',
    ]);
    expect(jobs.map(j => j.kind)).toEqual([
      'scorecards', 'scorecards', 'scorecards', 'scorecards', 'scorecards',
      'schedule', 'checking', 'nametags', 'first-timers', 'custom',
    ]);
  });

  it('skips empty buckets', () => {
    const jobs = buildPdfJobs(mkParsed({ firstRound: [sc(1, 'A')] }), mkSettings());
    expect(jobs.map(j => j.filename)).toEqual(['Test2026_round1.pdf']);
  });

  it('returns nothing for an empty parse with no custom events', () => {
    expect(buildPdfJobs(mkParsed(), mkSettings())).toEqual([]);
  });

  it('carries the scorecard entries on scorecard jobs', () => {
    const parsed = mkParsed({ firstRound: [sc(1, 'A'), sc(1, 'B')] });
    const jobs = buildPdfJobs(parsed, mkSettings());
    expect(jobs[0].kind === 'scorecards' && jobs[0].entries).toHaveLength(2);
  });

  it('carries the raw custom event, not pre-built entries', () => {
    const custom = customEvent('Relay');
    const jobs = buildPdfJobs(mkParsed(), mkSettings({ customEvents: [custom] }));
    expect(jobs[0].kind === 'custom' && jobs[0].custom).toBe(custom);
  });

  it('skips blank-named custom events', () => {
    const jobs = buildPdfJobs(mkParsed(), mkSettings({
      customEvents: [customEvent('   '), customEvent('Real')],
    }));
    expect(jobs.map(j => j.filename)).toEqual(['Test2026_custom_Real.pdf']);
  });

  it('sanitises custom names into filenames and caps them at 40 chars', () => {
    const jobs = buildPdfJobs(mkParsed(), mkSettings({
      customEvents: [customEvent('3x3 / OH — "fun"!'), customEvent('x'.repeat(60))],
    }));
    expect(jobs[0].filename).toBe('Test2026_custom_3x3_OH_fun_.pdf');
    expect(jobs[1].filename).toBe(`Test2026_custom_${'x'.repeat(40)}.pdf`);
  });
});

describe('downloadTarget', () => {
  it('names the bundle after the competition when there are several PDFs', () => {
    const jobs = buildPdfJobs(fullParsed, mkSettings());
    expect(jobs.length).toBeGreaterThan(1);
    expect(downloadTarget(jobs, 'Test2026')).toEqual({
      filename: 'Test2026_pdfs.zip',
      mimeType: 'application/zip',
    });
  });

  it('downloads the PDF itself when exactly one document is generated', () => {
    const jobs = buildPdfJobs(mkParsed({ nametags: [{ name: 'x' } as never] }), mkSettings());
    expect(downloadTarget(jobs, 'Test2026')).toEqual({
      filename: 'Test2026_nametags.pdf',
      mimeType: 'application/pdf',
    });
  });

  // No jobs means the worker errors out before building anything; the target is
  // never used, but it must not claim to be a lone PDF either.
  it('falls back to the zip name when there is nothing to build', () => {
    expect(downloadTarget([], 'Test2026')).toEqual({
      filename: 'Test2026_pdfs.zip',
      mimeType: 'application/zip',
    });
  });
});

// The whole point of the change: picking one document on the scope step has to
// come out as a bare PDF, not a one-file ZIP.
describe('single-document scopes download as a bare PDF', () => {
  const settings = mkSettings();

  it.each([
    ['scheduleTracker', 'Test2026_schedule.pdf'],
    ['roundChecklist',  'Test2026_checklist.pdf'],
    ['nametags',        'Test2026_nametags.pdf'],
    ['firstTimerSlips', 'Test2026_first_timers.pdf'],
  ] as const)('%s only → %s', (doc, filename) => {
    const scoped = filterParsedByScope(fullParsed, {
      mode: 'everything',
      documents: { ...noDocs, [doc]: true },
    });
    const jobs = buildPdfJobs(scoped, settings);
    expect(jobs).toHaveLength(1);
    expect(downloadTarget(jobs, settings.competitionId)).toEqual({
      filename,
      mimeType: 'application/pdf',
    });
  });

  // Scorecards alone still produce one PDF per round bucket, so they zip.
  it('scorecards only → still a ZIP (one PDF per round bucket)', () => {
    const scoped = filterParsedByScope(fullParsed, {
      mode: 'everything',
      documents: { ...noDocs, scorecards: true },
    });
    const jobs = buildPdfJobs(scoped, settings);
    expect(jobs.length).toBeGreaterThan(1);
    expect(downloadTarget(jobs, settings.competitionId).mimeType).toBe('application/zip');
  });

  it('a custom competition with a single event → that event\'s PDF', () => {
    // CustomCompetitionPage forces a scorecards-only scope over an empty parse.
    const scoped = filterParsedByScope(mkParsed(), {
      mode: 'everything',
      documents: { ...noDocs, scorecards: true },
    });
    const jobs = buildPdfJobs(scoped, mkSettings({
      isCustomCompetition: true,
      customEvents: [customEvent('Mini Guildford')],
    }));
    expect(jobs).toHaveLength(1);
    expect(downloadTarget(jobs, 'Test2026')).toEqual({
      filename: 'Test2026_custom_Mini_Guildford.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('two custom events → back to a ZIP', () => {
    const jobs = buildPdfJobs(mkParsed(), mkSettings({
      customEvents: [customEvent('Relay'), customEvent('Mini Guildford')],
    }));
    expect(jobs).toHaveLength(2);
    expect(downloadTarget(jobs, 'Test2026').filename).toBe('Test2026_pdfs.zip');
  });

  it('all documents → ZIP, unchanged from before', () => {
    const scoped = filterParsedByScope(fullParsed, { mode: 'everything', documents: allDocs });
    const jobs = buildPdfJobs(scoped, settings);
    expect(downloadTarget(jobs, settings.competitionId)).toEqual({
      filename: 'Test2026_pdfs.zip',
      mimeType: 'application/zip',
    });
  });
});

// ── Print-and-cut guide sections ─────────────────────────────────────────────
// The download page's guide must only explain the PDFs actually in the download:
// someone generating just the schedule tracker was being told how to cut and stack
// scorecards they never asked for.

describe('guideSections', () => {
  const cards = (label: string): PdfJob =>
    ({ kind: 'scorecards', filename: `c_${label}.pdf`, label, entries: [] });
  const other = (kind: PdfJob['kind']): PdfJob =>
    ({ kind, filename: `c_${kind}.pdf`, label: kind } as PdfJob);

  it('shows nothing when there is nothing to download', () => {
    expect(guideSections([])).toEqual([]);
  });

  it('shows only the schedule note for a schedule-only download', () => {
    expect(guideSections([other('schedule')])).toEqual(['schedule']);
  });

  it('shows only the scorecard section for a scorecard-only download', () => {
    expect(guideSections([cards('Round 1'), cards('Finals')])).toEqual(['scorecards']);
  });

  it('treats custom-event cards as scorecards - they print 4-up on the same sheet', () => {
    expect(guideSections([other('custom')])).toEqual(['scorecards']);
  });

  it('collapses scorecards and custom events into a single section', () => {
    expect(guideSections([cards('Round 1'), other('custom')])).toEqual(['scorecards']);
  });

  it('lists every section for a full download, scorecards first', () => {
    expect(guideSections([
      cards('Round 1'), other('schedule'), other('checking'),
      other('nametags'), other('first-timers'),
    ])).toEqual(['scorecards', 'schedule', 'checking', 'nametags', 'first-timers']);
  });

  it('keeps a fixed section order regardless of job order', () => {
    expect(guideSections([other('first-timers'), other('nametags'), cards('Finals')]))
      .toEqual(['scorecards', 'nametags', 'first-timers']);
  });

  it('never names a document the jobs do not contain', () => {
    const parsed = mkParsed({ firstRound: [cover(), sc(1, 'A')] });
    expect(guideSections(buildPdfJobs(parsed, mkSettings()))).toEqual(['scorecards']);
  });
});
