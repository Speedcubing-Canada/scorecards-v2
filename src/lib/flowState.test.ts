import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SCOPE,
  clearCustom, clearDownstream, clearSettings, readCompetition, readCustomEvents, readDetection,
  readHasGroups, readIsCustom, readFileName, readScope, readSettings, readStoredScope,
  readStoredSettings, writeCompetition, writeCustom, writeFileName, writeHasGroups, writeScope,
  writeSettings,
} from './flowState';
import type { CompetitionSettings } from '../types/settings';

// The wizard's four pages are separate routes with no shared React state, so everything
// one step learns reaches the next through sessionStorage. Nothing else covers that
// handoff - no test drives the pages themselves - so these assert the two things that
// actually break it: a value must survive the round trip, and a missing or corrupt blob
// must degrade to a documented default rather than throwing on a page that is mid-render.

// vitest runs in the `node` environment here, so provide the storage the module expects.
const store = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
});

beforeEach(() => store.clear());

describe('competition identity', () => {
  it('round-trips id and name', () => {
    writeCompetition('WC2026', 'World Championship 2026');
    expect(readCompetition()).toEqual({ id: 'WC2026', name: 'World Championship 2026' });
  });

  it('reads empty strings when unset, so the page can redirect rather than crash', () => {
    expect(readCompetition()).toEqual({ id: '', name: '' });
  });

  it('keeps non-ASCII names intact', () => {
    writeCompetition('GrosJouetsaMontreal2026', 'Gros Jouets à Montréal 2026');
    expect(readCompetition().name).toBe('Gros Jouets à Montréal 2026');
  });
});

describe('group detection', () => {
  it('round-trips both values', () => {
    writeHasGroups(false);
    expect(readHasGroups()).toBe(false);
    writeHasGroups(true);
    expect(readHasGroups()).toBe(true);
  });

  // Only a positive detection of absent groups may raise the warning: an unset value
  // means the scope step was skipped, not that the competition has no groups.
  it('treats unset as "has groups"', () => {
    expect(readHasGroups()).toBe(true);
  });
});

describe('generation scope', () => {
  const scope = {
    mode: 'selected' as const,
    rounds: [{ eventId: '333', roundNum: 2 }],
    documents: {
      scorecards: true, scheduleTracker: false, nametags: false,
      roundChecklist: true, firstTimerSlips: false,
    },
  };

  it('round-trips scope and detection together', () => {
    writeScope(scope, { showSecondRoundMode: false });
    expect(readScope()).toEqual(scope);
    expect(readDetection()).toEqual({ showSecondRoundMode: false });
  });

  it('falls back to the everything-scope when unset', () => {
    expect(readScope()).toEqual(DEFAULT_SCOPE);
  });

  it('falls back to the everything-scope when the blob is corrupt', () => {
    sessionStorage.setItem('generation_scope', '{not json');
    expect(readScope()).toEqual(DEFAULT_SCOPE);
  });

  // The scope step restores the organizer's selection from this, so it must be able to tell
  // "nothing stored yet" from a real scope - which readScope, defaulting, cannot.
  it('readStoredScope reads null when unset and the scope when set', () => {
    expect(readStoredScope()).toBeNull();
    writeScope(scope, { showSecondRoundMode: false });
    expect(readStoredScope()).toEqual(scope);
  });

  it('readStoredScope reads null for a corrupt blob or one written before document selection', () => {
    sessionStorage.setItem('generation_scope', '{not json');
    expect(readStoredScope()).toBeNull();
    sessionStorage.setItem('generation_scope', JSON.stringify({ mode: 'everything' }));
    expect(readStoredScope()).toBeNull();
  });

  // Absent detection means the scope step was bypassed; showing the Round 2 mode
  // preserves the behaviour from before that step existed.
  it('shows the second-round mode when detection is absent or corrupt', () => {
    expect(readDetection()).toEqual({ showSecondRoundMode: true });
    sessionStorage.setItem('generation_detection', 'null');
    expect(readDetection()).toEqual({ showSecondRoundMode: true });
    sessionStorage.setItem('generation_detection', '{');
    expect(readDetection()).toEqual({ showSecondRoundMode: true });
  });
});

describe('custom competitions', () => {
  const events = [
    { name: 'Clock Relay', iconDataUrl: null, format: 'avg5' as const, cutoff: '', limit: '' },
  ];

  it('round-trips the flag and the events', () => {
    writeCustom(events);
    expect(readIsCustom()).toBe(true);
    expect(readCustomEvents()).toEqual(events);
  });

  it('reads false / empty when unset', () => {
    expect(readIsCustom()).toBe(false);
    expect(readCustomEvents()).toEqual([]);
  });

  it('reads an empty list when the blob is corrupt', () => {
    sessionStorage.setItem('custom_competition_events', 'undefined');
    expect(readCustomEvents()).toEqual([]);
  });

  // The whole point of clearCustom: stale custom state must never leak into a WCA flow,
  // where it would suppress the WCA Live fields and print unofficial cards.
  it('clearCustom drops both keys', () => {
    writeCustom(events);
    clearCustom();
    expect(readIsCustom()).toBe(false);
    expect(readCustomEvents()).toEqual([]);
  });
});

describe('settings blob', () => {
  const settings = {
    competitionId: 'WC2026',
    competitionName: 'World Championship 2026',
    language: 'fr',
    secondaryLanguage: 'en',
    paperFormat: 'A4',
    secondRoundMode: 'blanks',
    logoDataUrl: null,
    useDefaultLogo: true,
    wcaLiveId: '9667',
    wcaLivePersonIds: { 1: '42' },
    hideWcaLiveId: false,
    nametagLogoMode: 'with-name',
    nametagQrMode: 'back-only',
    nametagLayout: 'vertical',
    customEvents: [],
    scorecardCheckMode: 'per-group-card',
    scrambleDoubleCheck: false,
    scrambleDoubleCheckRounds: ['finals'],
    scrambleDoubleCheckOverrides: {},
    generationScope: DEFAULT_SCOPE,
    isCustomCompetition: false,
  } as unknown as CompetitionSettings;

  it('round-trips every field', () => {
    writeSettings(settings);
    expect(readStoredSettings()).toEqual(settings);
  });

  it('reads null when absent, so the generate page redirects instead of guessing', () => {
    expect(readStoredSettings()).toBeNull();
  });

  // A blob half-written by an interrupted session must not throw on a rendering page.
  it('reads null when the blob is corrupt', () => {
    sessionStorage.setItem('competition_settings', '{"language":');
    expect(readStoredSettings()).toBeNull();
  });
});

describe('settings restore', () => {
  const stored = (extra: Record<string, unknown>) =>
    sessionStorage.setItem('competition_settings', JSON.stringify({ language: 'en', ...extra }));

  it('reads null when absent or corrupt', () => {
    expect(readSettings()).toBeNull();
    sessionStorage.setItem('competition_settings', '{"language":');
    expect(readSettings()).toBeNull();
  });

  // Migrations, previously private to the generate page. A session can still hold a blob
  // written by an older build, and the settings step now seeds its whole form from it.
  it('migrates the retired bilingual languages onto primary + secondary', () => {
    stored({ language: 'bilingual-fr' });
    expect(readSettings()).toMatchObject({ language: 'fr', secondaryLanguage: 'en' });
    stored({ language: 'bilingual-en' });
    expect(readSettings()).toMatchObject({ language: 'en', secondaryLanguage: 'fr' });
  });

  it('backfills the fields added since a blob may have been written', () => {
    stored({});
    expect(readSettings()).toMatchObject({
      secondaryLanguage: null,
      generationScope: { mode: 'everything', documents: DEFAULT_SCOPE.documents },
      hideWcaLiveId: false,
      isCustomCompetition: false,
      scorecardCheckMode: 'per-group-card',
    });
  });

  it('backfills roundChecklist into an earlier four-key document selection', () => {
    stored({ generationScope: { mode: 'latest', documents: {
      scorecards: true, scheduleTracker: false, nametags: false, firstTimerSlips: false,
    } } });
    expect(readSettings()?.generationScope.documents.roundChecklist).toBe(false);
  });

  // The standalone checking sheet is its own document now; only the cover-card half survives.
  it('maps the retired checking-sheet mode onto none', () => {
    stored({ scorecardCheckMode: 'checking-sheet' });
    expect(readSettings()?.scorecardCheckMode).toBe('none');
  });
});

describe('uploaded file names', () => {
  it('round-trips each kind independently, and null clears', () => {
    writeFileName('logo', 'club-logo.png');
    writeFileName('dcOverrides', 'double-checks.csv');
    expect(readFileName('logo')).toBe('club-logo.png');
    expect(readFileName('dcOverrides')).toBe('double-checks.csv');
    writeFileName('logo', null);
    expect(readFileName('logo')).toBeNull();
    expect(readFileName('dcOverrides')).toBe('double-checks.csv');
  });

  it('reads null when unset', () => {
    expect(readFileName('logo')).toBeNull();
    expect(readFileName('dcOverrides')).toBeNull();
  });
});

describe('clearing', () => {
  function fillFlow() {
    writeCompetition('WC2026', 'World Championship 2026');
    writeHasGroups(false);
    writeScope(DEFAULT_SCOPE, { showSecondRoundMode: false });
    writeSettings({ competitionId: 'WC2026' } as CompetitionSettings);
    writeFileName('logo', 'club-logo.png');
    writeFileName('dcOverrides', 'double-checks.csv');
  }

  // Picking a different competition must not let it inherit the previous one's scope,
  // rounds and settings through the restore-on-back-navigation.
  it('clearDownstream drops everything after the picker, keeping the competition', () => {
    fillFlow();
    clearDownstream();
    expect(readStoredScope()).toBeNull();
    expect(readDetection()).toEqual({ showSecondRoundMode: true });
    expect(readHasGroups()).toBe(true);
    expect(readSettings()).toBeNull();
    expect(readFileName('logo')).toBeNull();
    expect(readFileName('dcOverrides')).toBeNull();
    expect(readCompetition()).toEqual({ id: 'WC2026', name: 'World Championship 2026' });
  });

  // Changing the preset on the scope step: its new seeds must not lose to what was
  // submitted under the old one.
  it('clearSettings drops only the settings and the upload names', () => {
    fillFlow();
    clearSettings();
    expect(readSettings()).toBeNull();
    expect(readFileName('logo')).toBeNull();
    expect(readFileName('dcOverrides')).toBeNull();
    expect(readStoredScope()).toEqual(DEFAULT_SCOPE);
    expect(readHasGroups()).toBe(false);
  });
});
