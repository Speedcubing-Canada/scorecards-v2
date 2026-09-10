// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  fetchManagedCompetitions: vi.fn(),
  fetchWcif: vi.fn(),
}));
vi.mock('../lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/analytics')>()),
  send: vi.fn(),
}));

import { AppRoutes } from '../App';
import { fetchManagedCompetitions, fetchWcif } from '../auth/wca';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { readCompetition, readSettings, readStoredScope } from '../lib/flowState';
import { buildPdfJobs, downloadTarget } from '../lib/pdfJobs';
import { filterParsedByScope } from '../lib/generationScope';
import { parseWCIF } from '../lib/wcif-parser';
import { sampleWcif, testSettings } from '../test/fixtures';
import { anonymousAuth, renderWithProviders, signedInAuth, useEnglish } from '../test/render';

// The wizard runs as four separate routes with no shared React state; everything one step
// learns reaches the next through sessionStorage. flowState.test.ts covers that storage in
// isolation and each page test covers one page in isolation, so the joint - four steps
// agreeing about the same competition - is the part nothing sees.
//
// So this file drives the real routes through the UI only, and never writes flowState
// directly. It asserts what crossed a page boundary, not what any page rendered; rendered
// detail belongs to the per-page tests.

const mockList = vi.mocked(fetchManagedCompetitions);
const mockWcif = vi.mocked(fetchWcif);

const comp = (over: Record<string, unknown> = {}) => ({
  id: 'GrosJouetsaMontreal2026',
  name: 'Gros Jouets à Montréal 2026',
  city: 'Montréal', country_iso2: 'CA',
  start_date: '2999-05-16', end_date: '2999-05-16',
  announced_at: '2026-01-01', registration_open: '2026-01-01', registration_close: '2026-02-01',
  competitor_limit: null, website: '',
  ...over,
});

const other = comp({ id: 'AutreCompetition2026', name: 'Autre Compétition 2026' });

// jsdom implements no Worker, and vitest cannot load a `new URL(..., import.meta.url)`
// module worker. Rendering is covered headlessly by src/pdf/renderBundle.test.ts.
class StubWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage() {}
  terminate() {}
}

const enter = (route: string, auth = signedInAuth) =>
  renderWithProviders(<AppRoutes />, { auth, route });

// Callers pass i18n.t(...) so the key stays typed at the call site.
const click = async (name: string) =>
  fireEvent.click(await screen.findByRole('button', { name }));

/** A stat card renders its value above its label; read the value beside a known label. */
const statValue = (label: string) =>
  screen.getByText(label).previousSibling?.textContent;

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  // Keeps the What's New dialog from opening over the wizard.
  markAllSeen();
  await useEnglish();
  vi.clearAllMocks();
  vi.stubGlobal('Worker', StubWorker);
  mockList.mockResolvedValue([comp(), other]);
  mockWcif.mockResolvedValue(sampleWcif());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

/** Picker → scope → settings, driving only the UI. Leaves the caller on /settings. */
async function walkToSettings(name = 'Gros Jouets à Montréal 2026') {
  fireEvent.click(await screen.findByText(name));
  await click(i18n.t('scope.continue'));
  await screen.findByRole('button', { name: i18n.t('settings.generate_button') });
}

describe('the wizard carries one competition through all four steps', () => {
  it('reaches the download step with what the organizer actually picked', async () => {
    enter('/competitions');
    await walkToSettings();
    await click(i18n.t('settings.generate_button'));

    // The generate step derives its stat and its button label from buildPdfJobs; both
    // have to describe the competition chosen three steps earlier.
    const settings = readSettings()!;
    expect(settings.competitionId).toBe('GrosJouetsaMontreal2026');

    const scoped = filterParsedByScope(parseWCIF(sampleWcif(), settings), settings.generationScope);
    const jobs = buildPdfJobs(scoped, settings);
    const { filename } = downloadTarget(jobs, settings.competitionId);

    expect(await screen.findByRole('button', {
      name: i18n.t('generate.download_button', { filename }),
    })).toBeTruthy();
    expect(statValue(i18n.t('generate.stats.pdfs'))).toBe(String(jobs.length));
  });

  it('fetches the WCIF for the competition the picker wrote, not some other one', async () => {
    enter('/competitions');
    fireEvent.click(await screen.findByText('Autre Compétition 2026'));

    await waitFor(() => expect(mockWcif).toHaveBeenCalledWith('AutreCompetition2026', 'test-token'));
    expect(readCompetition().id).toBe('AutreCompetition2026');
  });

  it('records the scope choice for the settings step to act on', async () => {
    enter('/competitions');
    await walkToSettings();
    // Written by /scope, read by /settings and /generate. Absent means the handoff broke.
    expect(readStoredScope()).not.toBeNull();
  });
});

describe('switching competitions', () => {
  it('drops the first competition\'s scope and settings', async () => {
    // The regression clearDownstream exists to prevent: competition A's scope and settings
    // reaching competition B, which would generate the wrong documents under the right name.
    enter('/competitions');
    await walkToSettings();
    await click(i18n.t('settings.generate_button'));
    await screen.findByRole('button', { name: /Gros/ });

    expect(readSettings()).not.toBeNull();
    expect(readStoredScope()).not.toBeNull();

    // Back to the picker, and choose the other competition.
    cleanup();
    enter('/competitions');
    fireEvent.click(await screen.findByText('Autre Compétition 2026'));

    await waitFor(() => expect(readCompetition().id).toBe('AutreCompetition2026'));
    expect(readSettings()).toBeNull();
    expect(readStoredScope()).toBeNull();
  });

  it('keeps everything when the same competition is picked again', async () => {
    enter('/competitions');
    await walkToSettings();
    await click(i18n.t('settings.generate_button'));
    await screen.findByRole('button', { name: /Gros/ });

    cleanup();
    enter('/competitions');
    fireEvent.click(await screen.findByText('Gros Jouets à Montréal 2026'));

    // Same competition, so the organizer's earlier answers are theirs to come back to.
    await waitFor(() => expect(readStoredScope()).not.toBeNull());
    expect(readSettings()).not.toBeNull();
  });
});

describe('ProtectedRoute', () => {
  it.each(['/competitions', '/scope', '/settings', '/generate', '/custom'])(
    'sends a signed-out visitor at %s back to the login page',
    async (route) => {
      enter(route, anonymousAuth);
      expect(await screen.findByRole('button', { name: i18n.t('login.sign_in_button') })).toBeTruthy();
      expect(mockWcif).not.toHaveBeenCalled();
    },
  );

  it('lets a signed-in organizer through', async () => {
    enter('/competitions');
    expect(await screen.findByText('Gros Jouets à Montréal 2026')).toBeTruthy();
  });

  it('sends an unknown route back to the login page', async () => {
    enter('/nope', anonymousAuth);
    expect(await screen.findByRole('button', { name: i18n.t('login.sign_in_button') })).toBeTruthy();
  });
});

describe('the custom-competition branch', () => {
  it('reaches settings without a WCIF, and marks the settings as custom', async () => {
    enter('/competitions');
    fireEvent.click(await screen.findByRole('button', {
      name: new RegExp(i18n.t('picker.create_custom_title')),
    }));

    // The name input is labelled by a heading, not a <label>, so the placeholder is the handle.
    const name = await screen.findByPlaceholderText(i18n.t('custom.name_placeholder'));
    fireEvent.change(name, { target: { value: 'Club Meetup' } });

    // Continue stays disabled until at least one named event exists.
    await click(i18n.t('settings.advanced.add_custom_event'));
    fireEvent.change(
      screen.getByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder')),
      { target: { value: 'Mystery Puzzle' } },
    );
    await click(i18n.t('custom.continue'));
    await click(i18n.t('settings.generate_button'));

    const settings = readSettings()!;
    expect(settings.isCustomCompetition).toBe(true);
    // A custom competition has no WCIF; fetching one would 404 on a real run.
    expect(mockWcif).not.toHaveBeenCalled();
  });
});

describe('settings defaults', () => {
  it('start from the fixture defaults, so a fresh run is generatable', async () => {
    enter('/competitions');
    await walkToSettings();
    await click(i18n.t('settings.generate_button'));

    const settings = readSettings()!;
    const defaults = testSettings();
    expect(settings.paperFormat).toBe(defaults.paperFormat);
    expect(settings.language).toBeTruthy();
  });
});
