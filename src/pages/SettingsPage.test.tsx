// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { CompetitionSettings, CustomEvent } from '../types/settings';
import { AuthContext, type AuthState } from '../auth/useAuth';
import { ThemeProvider } from '../theme/ThemeContext';
import { markAllSeen } from '../changelog';
import i18n from '../i18n/index';
import {
  DEFAULT_SCOPE, readSettings, writeCompetition, writeCustom, writeFileName, writeScope,
  writeSettings,
} from '../lib/flowState';
import { writePresetSettings } from '../presets';
import SettingsPage from './SettingsPage';

// The one page whose whole form is seeded from storage: it restores what was submitted before
// so back-navigation from /generate doesn't throw the organizer's choices away. That seeding is
// too easy to break silently - a stray key after the restore spread once wiped the custom
// events, which live behind a collapsed section where nobody notices until they print.

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  // No network from a test, and no auto-filled id to compete with a restored one.
  fetchScoretakingSoftware: vi.fn().mockResolvedValue('wca_live'),
  fetchWcaLiveId: vi.fn().mockResolvedValue(null),
  fetchWcaLivePersonIds: vi.fn().mockResolvedValue(null),
}));

import { fetchScoretakingSoftware, fetchWcaLiveId } from '../auth/wca';
const mockScoretaking = vi.mocked(fetchScoretakingSoftware);
const mockWcaLiveId = vi.mocked(fetchWcaLiveId);

// jsdom ships no matchMedia; the theme provider and the mobile breakpoint both read one.
vi.stubGlobal('matchMedia', (media: string) => ({
  media, matches: false, onchange: null,
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
}));

const auth = { token: null, user: null, isLoading: false } as unknown as AuthState;

const event = (name: string): CustomEvent =>
  ({ name, iconDataUrl: null, format: 'avg5', cutoff: '', limit: '' });

/** A full settings blob as `handleSubmit` would have written it. */
const stored = (overrides: Partial<CompetitionSettings> = {}): CompetitionSettings => ({
  competitionId: 'WC2026',
  competitionName: 'World Championship 2026',
  language: 'en',
  secondaryLanguage: null,
  paperFormat: 'LETTER',
  secondRoundMode: 'prefilled',
  logoDataUrl: null,
  useDefaultLogo: false,
  liveResultsMode: 'wca-live',
  wcaLiveId: null,
  wcaLivePersonIds: null,
  hideWcaLiveId: false,
  nametagLogoMode: 'with-name',
  nametagQrMode: 'back-only',
  nametagLayout: 'vertical',
  customEvents: [],
  scorecardCheckMode: 'per-group-card',
  scrambleDoubleCheck: true,
  scrambleDoubleCheckRounds: ['finals'],
  scrambleDoubleCheckOverrides: {},
  scrambleDoubleCheckWorldTop: 50,
  scrambleDoubleCheckRegionTop: null,
  scrambleDoubleCheckRegionScope: 'national',
  generationScope: DEFAULT_SCOPE,
  isCustomCompetition: false,
  ...overrides,
});

async function renderSettings() {
  const view = render(
    <ThemeProvider>
      <MemoryRouter>
        <AuthContext.Provider value={auth}>
          <SettingsPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  );
  // Settles the WCA Live lookup the page fires on mount.
  await screen.findByRole('button', { name: /Generate/ });
  return view;
}

const generate = () => fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
const advancedToggle = () => screen.getByRole('button', { name: 'Advanced' });

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  // Keep the What's New dialog from opening over the page, and the copy in one language so
  // queries by accessible name are stable.
  markAllSeen();
  await i18n.changeLanguage('en');
  vi.clearAllMocks();
  mockScoretaking.mockResolvedValue('wca_live');
  mockWcaLiveId.mockResolvedValue(null);
  writeCompetition('WC2026', 'World Championship 2026');
  writeScope(DEFAULT_SCOPE, { showSecondRoundMode: false });
});

afterEach(cleanup);

// The ranking rules (reg. 11i) are the only settings whose control is a checkbox and a number
// that have to stay in step: the threshold IS the switch, so an empty box must never be saved.
describe('scramble double-check ranking rules', () => {
  // Checkbox and threshold share the rule's name; the role tells them apart.
  const box = (name: string) => screen.getByRole('checkbox', { name });
  const top = (name: string) => screen.getByRole('textbox', { name }) as HTMLInputElement;
  const worldTop = () => top('World rankings, top');
  const regionTop = () => top('Regional rankings, top');

  // The rules live under Advanced, collapsed by default.
  async function openDoubleCheck() {
    await renderSettings();
    fireEvent.click(advancedToggle());
  }

  it('starts on the world top 50 with the regional rule off', async () => {
    await openDoubleCheck();
    expect(worldTop().value).toBe('50');
    expect(regionTop().value).toBe('');
    expect(regionTop().disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Continental' })).toBeNull();
  });

  it('ticking the regional rule reveals its scope and saves the pair', async () => {
    await openDoubleCheck();
    fireEvent.click(box('Regional rankings, top'));
    fireEvent.click(screen.getByRole('button', { name: 'Continental' }));
    generate();

    expect(readSettings()).toMatchObject({
      scrambleDoubleCheckRegionTop: 1,
      scrambleDoubleCheckRegionScope: 'continental',
    });
  });

  it('unticking a rule stores null, not a number', async () => {
    await openDoubleCheck();
    fireEvent.click(box('World rankings, top'));
    generate();

    expect(readSettings()?.scrambleDoubleCheckWorldTop).toBeNull();
  });

  it('an emptied threshold snaps back to its default instead of saving blank', async () => {
    await openDoubleCheck();
    fireEvent.change(worldTop(), { target: { value: '' } });
    expect(worldTop().value).toBe('0');
    fireEvent.blur(worldTop());
    generate();

    expect(readSettings()?.scrambleDoubleCheckWorldTop).toBe(50);
  });

  // The ranking rules already cover reg. 11i, so a whole round is only worth double-checking
  // at a championship. Nothing in the WCIF or the WCA API says whether one is, so the name
  // is the only signal. Seeded from a preset, not a stored blob, which would beat the default.
  it('leaves the round rule off, and ticks Finals only for a championship', async () => {
    const finalsChecked = () =>
      (screen.getByRole('checkbox', { name: 'Finals' }) as HTMLInputElement).checked;

    writeCompetition('TorontoOpen2026', 'Toronto Open 2026');
    await openDoubleCheck();
    expect(finalsChecked()).toBe(false);

    cleanup();
    writeCompetition('CanChamp2026', 'Canadian Championship 2026');
    await openDoubleCheck();
    expect(finalsChecked()).toBe(true);
  });

  // Regulation 11i applies at every competition, so there is no opt-in checkbox left - just
  // rules that can be unticked, out of the way until an organizer goes looking for them.
  it('has no enable switch and is collapsed until Advanced is opened', async () => {
    await renderSettings();
    expect(screen.queryByRole('checkbox', { name: /Enable scramble/i })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'World rankings, top' })).toBeNull();
    generate();

    expect(readSettings()).toMatchObject({
      scrambleDoubleCheck: true,
      scrambleDoubleCheckWorldTop: 50,
      scrambleDoubleCheckRegionTop: null,
    });
  });

  // A blob written before the switch was removed carries `false`, with nothing left to undo it.
  it('re-enables a restored submission that had it switched off', async () => {
    writeSettings(stored({ scrambleDoubleCheck: false }));
    await renderSettings();
    generate();

    expect(readSettings()?.scrambleDoubleCheck).toBe(true);
  });

  // Generating scorecards alone mid-competition must not hide the rules; only the custom-event
  // editor below them is whole-generation-only.
  it('stays reachable when only some documents are generated', async () => {
    writeScope({
      mode: 'latest',
      documents: { scorecards: true, scheduleTracker: false, nametags: false, roundChecklist: false, firstTimerSlips: false },
    }, { showSecondRoundMode: false });
    await openDoubleCheck();

    expect(box('World rankings, top')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Event name/)).toBeNull();
  });

  it('keeps digits only', async () => {
    await openDoubleCheck();
    fireEvent.change(worldTop(), { target: { value: '1e2!' } });
    generate();

    expect(readSettings()?.scrambleDoubleCheckWorldTop).toBe(12);
  });
});

describe('restoring the previous submission', () => {
  // The reported bug: a custom event added to a WCA competition lives only in the settings
  // blob, and came back empty after pressing Back on the download page.
  it('restores a custom event and opens the section holding it', async () => {
    writeSettings(stored({ customEvents: [event('Mini Guildford')] }));
    await renderSettings();

    expect(screen.getByDisplayValue('Mini Guildford')).toBeTruthy();
    expect(advancedToggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves the advanced section closed when nothing was restored into it', async () => {
    writeSettings(stored());
    await renderSettings();

    expect(advancedToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('restores an option over the preset that seeded it', async () => {
    writePresetSettings({ paperFormat: 'A4' });
    writeSettings(stored({ paperFormat: 'LETTER' }));
    const { container } = await renderSettings();

    expect(container.querySelector<HTMLInputElement>('input[name="paper"][value="LETTER"]')?.checked).toBe(true);
  });

  it('falls back to the preset, then to the plain default, with nothing submitted yet', async () => {
    writePresetSettings({ paperFormat: 'A4' });
    const { container } = await renderSettings();
    expect(container.querySelector<HTMLInputElement>('input[name="paper"][value="A4"]')?.checked).toBe(true);

    cleanup();
    writePresetSettings(null);
    const plain = await renderSettings();
    expect(plain.container.querySelector<HTMLInputElement>('input[name="paper"][value="LETTER"]')?.checked).toBe(true);
  });

  it('names the restored uploads, which are not part of the settings blob', async () => {
    writeSettings(stored({
      logoDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      scrambleDoubleCheck: true,
      scrambleDoubleCheckOverrides: { '333|1': ['2019SMIT01'] },
    }));
    writeFileName('logo', 'club-logo.png');
    writeFileName('dcOverrides', 'double-checks.csv');
    await renderSettings();

    expect(screen.getByText('club-logo.png')).toBeTruthy();
    expect(advancedToggle().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('double-checks.csv')).toBeTruthy();
  });

  // Restore, submit without touching anything, and the payload must be what came back - a
  // field dropped from the draft would show up here as a lost value.
  it('re-submits everything it restored', async () => {
    const settings = stored({
      language: 'fr', secondaryLanguage: 'en', paperFormat: 'A4', secondRoundMode: 'blanks',
      nametagLayout: 'horizontal', nametagQrMode: 'both-sides', scorecardCheckMode: 'none',
      hideWcaLiveId: true, wcaLiveId: '9667', useDefaultLogo: true, liveResultsMode: 'ilr',
      scrambleDoubleCheck: true, scrambleDoubleCheckRounds: ['firstRound'],
      scrambleDoubleCheckOverrides: { '333|1': ['2019SMIT01'] },
      customEvents: [event('Mini Guildford')],
    });
    writeSettings(settings);
    await renderSettings();
    generate();

    expect(readSettings()).toEqual(settings);
  });
});

describe('custom competitions', () => {
  // Their events are edited on /custom, which writes its own key. A blob written before that
  // edit must not win over it.
  it('takes its events from the custom-competition key, not the older blob', async () => {
    writeCompetition('custom-my-comp', 'My Comp');
    writeSettings(stored({
      competitionId: 'custom-my-comp', competitionName: 'My Comp',
      isCustomCompetition: true, customEvents: [event('Clock Relay')],
    }));
    writeCustom([event('Mini Guildford')]);
    await renderSettings();
    generate();

    expect(readSettings()?.customEvents.map(e => e.name)).toEqual(['Mini Guildford']);
  });
});

// The competition's own `scoretaking_software` decides which live-results system the name tag
// QR codes point at. ILR needs nothing from the WCA Live API, so we must not call it.
describe('live results mode', () => {
  it('preselects ILR and skips the WCA Live lookups when scoretaking is internal', async () => {
    mockScoretaking.mockResolvedValue('internal');
    await renderSettings();
    generate();

    expect(readSettings()?.liveResultsMode).toBe('ilr');
    expect(mockWcaLiveId).not.toHaveBeenCalled();
  });

  it('stays on WCA Live and looks its id up when scoretaking is wca_live', async () => {
    mockScoretaking.mockResolvedValue('wca_live');
    mockWcaLiveId.mockResolvedValue('9667');
    await renderSettings();
    generate();

    expect(readSettings()?.liveResultsMode).toBe('wca-live');
    expect(readSettings()?.wcaLiveId).toBe('9667');
  });

  // The organizer may know the competition is about to switch before the WCA record does.
  it('does not overwrite a restored choice', async () => {
    mockScoretaking.mockResolvedValue('wca_live');
    writeSettings(stored({ liveResultsMode: 'ilr' }));
    await renderSettings();
    generate();

    expect(readSettings()?.liveResultsMode).toBe('ilr');
  });

  // The mode only decides where the name tag QR codes point, so it has to be reachable
  // whenever name tags are generated - including without scorecards, whose "WCA Live:"
  // checkbox used to gate this whole section.
  it('is reachable when name tags are generated without scorecards', async () => {
    writeScope({
      mode: 'latest',
      documents: { scorecards: false, scheduleTracker: false, nametags: true, roundChecklist: false, firstTimerSlips: false },
    }, { showSecondRoundMode: false });
    await renderSettings();

    expect(screen.getByRole('radio', { name: /Integrated live results/ })).toBeTruthy();
    expect(screen.queryByText(/Hide the WCA Live line/)).toBeNull();
  });

  it('lets the organizer override the detected system', async () => {
    mockScoretaking.mockResolvedValue('wca_live');
    await renderSettings();
    fireEvent.click(screen.getByRole('radio', { name: /Integrated live results/ }));
    generate();

    expect(readSettings()?.liveResultsMode).toBe('ilr');
  });
});
