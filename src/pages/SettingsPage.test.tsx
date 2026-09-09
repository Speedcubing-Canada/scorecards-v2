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
  fetchWcaLiveId: vi.fn().mockResolvedValue(null),
  fetchWcaLivePersonIds: vi.fn().mockResolvedValue(null),
}));

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
  writeCompetition('WC2026', 'World Championship 2026');
  writeScope(DEFAULT_SCOPE, { showSecondRoundMode: false });
});

afterEach(cleanup);

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
    expect(screen.getByText('double-checks.csv')).toBeTruthy();
  });

  // Restore, submit without touching anything, and the payload must be what came back - a
  // field dropped from the draft would show up here as a lost value.
  it('re-submits everything it restored', async () => {
    const settings = stored({
      language: 'fr', secondaryLanguage: 'en', paperFormat: 'A4', secondRoundMode: 'blanks',
      nametagLayout: 'horizontal', nametagQrMode: 'both-sides', scorecardCheckMode: 'none',
      hideWcaLiveId: true, wcaLiveId: '9667', useDefaultLogo: true,
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
