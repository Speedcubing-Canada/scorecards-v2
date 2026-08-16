// Render every PDF document from the REAL components, headlessly, for layout verification.
//
//   npm run render:fixtures            # vertical nametags (default)
//   npm run render:fixtures -- --horizontal
//
// Writes to ../current-output/, which the pdf-print-edit skill diffs against
// ../original-output/. This replaces the old generate-*.mjs scripts, which each carried
// their own copy of the layout (styles, CONFIGS, column widths) and so verified code that
// was not the code that ships - the exact drift the verification loop exists to catch.
//
// Run through vite-node, not node: the documents are .tsx, and Node's native type
// stripping does not handle JSX.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';

import { NametTagDocument } from '../src/pdf/NametTagDocument';
import { FirstTimerSlipDocument } from '../src/pdf/FirstTimerSlipDocument';
import { ScorecardDocument } from '../src/pdf/ScorecardDocument';
import { ScheduleTrackerDocument } from '../src/pdf/ScheduleTrackerDocument';
import { CheckingSheetDocument } from '../src/pdf/CheckingSheetDocument';
import type {
  NametTagEntry, FirstTimerEntry, ScorecardData, ScheduleDay, CheckingDay,
} from '../src/lib/wcif-parser';
import { finalizeEntries } from '../src/lib/wcif-parser';
import type { CompetitionSettings } from '../src/types/settings';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dir, '../../current-output');

/**
 * A plausible default settings object. Individual fixtures override what they exercise.
 * Kept here rather than in a shared fixture module because only this script needs a
 * *complete* CompetitionSettings - the unit tests build minimal ones.
 */
function settings(over: Partial<CompetitionSettings> = {}): CompetitionSettings {
  return {
    competitionId: 'GrosJouetsaMontreal2026',
    competitionName: 'Gros Jouets à Montréal 2026',
    language: 'en',
    secondaryLanguage: null,
    paperFormat: 'LETTER',
    secondRoundMode: 'prefilled',
    logoDataUrl: null,
    useDefaultLogo: true,
    wcaLiveId: null,
    wcaLivePersonIds: null,
    hideWcaLiveId: false,
    nametagLogoMode: 'with-name',
    nametagQrMode: 'back-only',
    nametagLayout: 'vertical',
    customEvents: [],
    scorecardCheckMode: 'per-group-card',
    scrambleDoubleCheck: false,
    scrambleDoubleCheckRounds: ['finals'],
    scrambleDoubleCheckOverrides: {},
    generationScope: {
      mode: 'everything',
      documents: {
        scorecards: true, scheduleTracker: true, nametags: true,
        roundChecklist: false, firstTimerSlips: false,
      },
    },
    isCustomCompetition: false,
    ...over,
  };
}

// ── Name tags: the real Gros Jouets 2026 export ───────────────────────────────
// Path is built via readdir rather than a literal, because the directory names contain
// accented characters that do not round-trip reliably on WSL/NTFS.
function loadNametagFixture(): {
  entries: NametTagEntry[];
  wcaLivePersonIds: Record<number, string>;
  competitionId: string;
  competitionName: string;
  wcaLiveId: string;
} {
  const exampleDir = resolve(__dir, '../../example-comp');
  const outer = readdirSync(exampleDir).find(n => n.includes('Nametags') && !n.startsWith('_'));
  if (!outer) throw new Error(`No Nametags dir under ${exampleDir}`);
  const inner = readdirSync(resolve(exampleDir, outer)).find(n => n.includes('Nametags') && !n.startsWith('_'));
  if (!inner) throw new Error(`No inner Nametags dir under ${outer}`);
  const raw = readFileSync(resolve(exampleDir, outer, inner, 'gj_2026_nametags.js'), 'utf-8');

  // The legacy export is a script that assigns onto `window`.
  const fake: Record<string, unknown> = {};
  new Function('window', raw)(fake);

  type LegacyCompetitor = {
    name: string; wca_id?: string; live_id: string; competitor_id: string;
    gender: 'm' | 'f' | 'o'; title_en: string; title_fr: string; events: string[];
    groups?: string[]; scramble?: string[]; judge?: string[]; run?: string[];
  };
  const competitors = fake.competitors as LegacyCompetitor[];

  // The legacy export carries the rendered title, not the role, but the role drives the
  // badge fill (badgeColors in NametTagDocument), so recover it from the English title.
  // The live app gets this from `person.roles` in the WCIF.
  const roleOf = (titleEn: string): NametTagEntry['role'] =>
    titleEn === 'DELEGATE' ? 'delegate'
      : titleEn === 'ORGANIZER' ? 'organizer'
      : titleEn === 'NEW COMPETITOR' ? 'new-competitor'
      : 'competitor';

  const entries: NametTagEntry[] = competitors.map((c) => ({
    name: c.name,
    wcaId: c.wca_id || '',
    // live_id is competitiongroups' sequential person id (registrantId);
    // competitor_id is the WCA user account id used by WCA Live.
    registrantId: parseInt(c.live_id, 10),
    wcaUserId: parseInt(c.competitor_id, 10),
    gender: c.gender,
    role: roleOf(c.title_en),
    // The original is French-main: front panel French, back panel English. These come
    // from the export rather than getNametTagTitleStrings so the fixture reproduces the
    // original PDF exactly - the fixture supplies data, the component supplies layout.
    titleFront: c.title_fr,
    titleBack: c.title_en,
    events: c.events,
    // 'Aucun' stays in the arrays (it is a rendered value, not an absence).
    compete: (c.groups ?? []).sort(),
    scramble: (c.scramble ?? []).sort(),
    judge: (c.judge ?? []).sort(),
    run: (c.run ?? []).sort(),
  }));

  // In production this map comes from the WCA Live GraphQL API (fetchWcaLivePersonIds),
  // keyed registrantId → WCA Live person id. Without it QrSection falls back to the bare
  // domain, whose QR is far sparser than a real one - useless for judging how the code
  // block prints, so the fixture synthesises one.
  //
  // Seeded from wcaUserId specifically so this fixture reproduces the old
  // generate-nametags.mjs output byte for byte (verified: 15/15 pages MAE 0). Note that
  // the account id is NOT the WCA Live person id - the old script used it as though it
  // were, so its fixture PDFs carried QR codes that do not resolve. That only ever
  // affected the fixture, never production, but it went unnoticed for exactly the reason
  // this script exists: the old one shared no code with the component it verified.
  const wcaLivePersonIds: Record<number, string> = {};
  for (const e of entries) wcaLivePersonIds[e.registrantId] = String(e.wcaUserId);

  return {
    entries,
    wcaLivePersonIds,
    competitionId: fake.competitionId as string,
    competitionName: fake.competitionName as string,
    wcaLiveId: fake.wcaLive as string,
  };
}

// ── First-timer slips ─────────────────────────────────────────────────────────
// The real newcomer list reconstructed from the original Gros Jouets slips PDF, so the
// output can be diffed against original-output/ for layout fidelity. Birthdates are real
// here; from a live WCIF they appear only when DOB is exposed.
const FIRST_TIMERS: FirstTimerEntry[] = [
  { name: 'Alex Yang',           gender: 'm', birthdate: '2008-12-06', countryIso2: 'CA', eventIds: ['444', '555', '666', '777'] },
  { name: 'Alexandre Fredette',  gender: 'm', birthdate: '2015-01-13', countryIso2: 'CA', eventIds: ['444', 'minx'] },
  { name: 'Alexandre Mailloux',  gender: 'm', birthdate: '2016-01-26', countryIso2: 'CA', eventIds: ['555', 'minx'] },
  { name: 'Ali Hakim',           gender: 'm', birthdate: '2016-01-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Brandon Morrissette', gender: 'm', birthdate: '2014-02-13', countryIso2: 'CA', eventIds: ['minx'] },
  { name: 'Lou Brunet',          gender: 'm', birthdate: '2017-01-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Paul Boutin',         gender: 'm', birthdate: '2015-04-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Raphaël Rishan',      gender: 'm', birthdate: '2016-06-04', countryIso2: 'CA', eventIds: ['444', 'minx'] },
  { name: 'Ryan Lee',            gender: 'm', birthdate: '2015-07-21', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Shawn Kang',          gender: 'm', birthdate: '2012-09-07', countryIso2: 'KR', eventIds: ['444'] },
  { name: 'Yuri Famelis',        gender: 'm', birthdate: '2015-07-02', countryIso2: 'CA', eventIds: ['444', 'minx'] },
];

// ── Scorecards ────────────────────────────────────────────────────────────────
// A 4-up sheet with one card per hand-tuned row height (see ROW_HEIGHTS in
// src/pdf/layoutConstants.ts), so a change to any of them shows up on one page.
function scorecardFixture(): ScorecardData[] {
  const base = {
    kind: 'scorecard' as const,
    timeslot: '2026-05-30T09:00:00',
    roundLabel: 'Round 1',
    roundNum: 1,
    group: '1',
    wcaId: '2019FRED01',
    gender: 'm',
    isCumulative: false,
  };
  return finalizeEntries([
    { ...base, name: 'Alexandre Fredette', eventId: '333',  eventName: '3x3x3 Cube',        liveId: '1', format: 'avg5', cutoff: '',     limit: '10:00' },
    { ...base, name: 'Marie-Ève Tremblay', eventId: '444',  eventName: '4x4x4 Cube',        liveId: '2', format: 'mo3',  cutoff: '1:30', limit: '2:00'  },
    { ...base, name: 'Jean-Philippe Roy',  eventId: '666',  eventName: '6x6x6 Cube',        liveId: '3', format: 'bo2',  cutoff: '',     limit: '6:00'  },
    { ...base, name: 'Yuri Famelis',       eventId: '333fm', eventName: 'FMC',              liveId: '4', format: 'bo1',  cutoff: '',     limit: ''      },
  ]);
}

// ── Schedule tracker / Round Checklist ────────────────────────────────────────
// A two-day competition with a second room on day 1 (so the tracker renders its room
// dimension, which the checklist deliberately does not have) and a lunch break on each
// day (so the thick break rule is exercised). Both documents are ruled tables, so their
// borders and row tints only show up in a pixel diff, never in the layout unit tests.
const SCHEDULE_DAYS: ScheduleDay[] = [
  {
    dayLabel: 'Day 1 - Saturday',
    stages: [
      {
        stageName: 'Red Stage',
        rows: [
          { startTime: '09:00', endTime: '10:00', eventRound: '3x3x3 Cube Round 1',  breakBefore: false },
          { startTime: '10:00', endTime: '11:00', eventRound: '2x2x2 Cube Round 1',  breakBefore: false },
          { startTime: '13:00', endTime: '14:30', eventRound: '4x4x4 Cube Round 1',  breakBefore: true  },
        ],
      },
      {
        stageName: 'Blue Stage',
        rows: [
          { startTime: '09:00', endTime: '10:30', eventRound: 'Megaminx Round 1',    breakBefore: false },
          { startTime: '13:00', endTime: '14:00', eventRound: 'Pyraminx Round 1',    breakBefore: true  },
        ],
      },
    ],
  },
  {
    dayLabel: 'Day 2 - Sunday',
    stages: [
      {
        stageName: 'Red Stage',
        rows: [
          { startTime: '09:00', endTime: '10:00', eventRound: '3x3x3 Cube Round 2',  breakBefore: false },
          { startTime: '12:30', endTime: '13:30', eventRound: '3x3x3 Cube Final',    breakBefore: true  },
        ],
      },
    ],
  },
];

const CHECKING_DAYS: CheckingDay[] = [
  {
    dayLabel: 'Day 1 - Saturday',
    rows: [
      // Round 1 ships with its first two boxes already ticked; later rounds ship blank.
      { startTime: '09:00', endTime: '10:00', eventRound: '3x3x3 Cube Round 1', groupCount: 3, preChecked: true,  breakBefore: false },
      { startTime: '09:00', endTime: '10:30', eventRound: 'Megaminx Round 1',   groupCount: 2, preChecked: true,  breakBefore: false },
      { startTime: '13:00', endTime: '14:30', eventRound: '4x4x4 Cube Round 1', groupCount: 2, preChecked: true,  breakBefore: true  },
    ],
  },
  {
    dayLabel: 'Day 2 - Sunday',
    rows: [
      { startTime: '09:00', endTime: '10:00', eventRound: '3x3x3 Cube Round 2', groupCount: 2, preChecked: false, breakBefore: false },
      { startTime: '12:30', endTime: '13:30', eventRound: '3x3x3 Cube Final',   groupCount: 1, preChecked: false, breakBefore: true  },
    ],
  },
];

async function write(name: string, element: React.ReactElement): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  const out = resolve(OUT_DIR, name);
  writeFileSync(out, buffer);
  console.log(`  → ${out}`);
}

async function main() {
  const horizontal = process.argv.includes('--horizontal');
  const e = React.createElement;

  const nt = loadNametagFixture();
  // Matches the original Gros Jouets name tags: French main / English back, and no logo
  // (the original predates the logo option). Change these and the diff against
  // original-output/ stops meaning anything.
  const ntSettings = settings({
    competitionId: nt.competitionId,
    competitionName: nt.competitionName,
    wcaLiveId: nt.wcaLiveId,
    wcaLivePersonIds: nt.wcaLivePersonIds,
    language: 'fr',
    secondaryLanguage: 'en',
    useDefaultLogo: false,
    nametagLogoMode: 'hidden',
    nametagLayout: horizontal ? 'horizontal' : 'vertical',
  });

  console.log(`Rendering ${nt.entries.length} name tags (${ntSettings.nametagLayout})…`);
  await write(
    `${nt.competitionId}_nametags.pdf`,
    e(NametTagDocument, { nametags: nt.entries, settings: ntSettings }),
  );

  console.log(`Rendering ${FIRST_TIMERS.length} first-timer slips…`);
  await write(
    `${nt.competitionId}_first_timers.pdf`,
    e(FirstTimerSlipDocument, { entries: FIRST_TIMERS, settings: settings() }),
  );

  const cards = scorecardFixture();
  console.log(`Rendering ${cards.length} scorecards…`);
  await write(
    'scorecard-layout-test.pdf',
    e(ScorecardDocument, { entries: cards, settings: settings() }),
  );

  console.log(`Rendering schedule tracker (${SCHEDULE_DAYS.length} days)…`);
  await write(
    'schedule-layout-test.pdf',
    e(ScheduleTrackerDocument, { days: SCHEDULE_DAYS, settings: settings() }),
  );

  console.log(`Rendering Round Checklist (${CHECKING_DAYS.length} days)…`);
  await write(
    'checklist-layout-test.pdf',
    e(CheckingSheetDocument, { days: CHECKING_DAYS, settings: settings() }),
  );

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
