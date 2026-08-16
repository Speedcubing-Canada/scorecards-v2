import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SCOPE,
  clearCustom, readCompetition, readCustomEvents, readDetection, readHasGroups,
  readIsCustom, readScope, readStoredSettings,
  writeCompetition, writeCustom, writeHasGroups, writeScope, writeSettings,
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
