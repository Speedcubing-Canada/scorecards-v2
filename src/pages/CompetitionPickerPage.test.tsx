// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  fetchManagedCompetitions: vi.fn(),
}));

import { fetchManagedCompetitions } from '../auth/wca';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import {
  DEFAULT_SCOPE, readCompetition, readCustomEvents, readIsCustom, readStoredScope,
  writeCompetition, writeCustom, writeScope,
} from '../lib/flowState';
import { renderWithProviders, signedInAuth, useEnglish } from '../test/render';
import CompetitionPickerPage from './CompetitionPickerPage';

const mockFetch = vi.mocked(fetchManagedCompetitions);

// The step where a competition is chosen and everything downstream of a previous choice
// has to be dropped. Assertions go through i18n keys, never literal copy.

const comp = (over: Record<string, unknown> = {}) => ({
  id: 'GrosJouetsaMontreal2026',
  name: 'Gros Jouets à Montréal 2026',
  city: 'Montréal', country_iso2: 'CA',
  start_date: '2999-05-16', end_date: '2999-05-16',
  announced_at: '2026-01-01', registration_open: '2026-01-01', registration_close: '2026-02-01',
  competitor_limit: null, website: '',
  ...over,
});

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  // Keeps the What's New dialog from opening over the page.
  markAllSeen();
  await useEnglish();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('CompetitionPickerPage', () => {
  it('lists the competitions the organizer manages', async () => {
    mockFetch.mockResolvedValue([comp()]);
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });

    expect(await screen.findByText('Gros Jouets à Montréal 2026')).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith('test-token');
  });

  it('says so when the organizer manages nothing upcoming', async () => {
    mockFetch.mockResolvedValue([]);
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    expect(await screen.findByText(i18n.t('picker.empty'))).toBeTruthy();
  });

  it('announces the skeleton while the list loads', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    // A silent skeleton leaves a screen reader with nothing between sign-in and the list.
    expect(screen.getByRole('status', { name: i18n.t('picker.loading') })).toBeTruthy();
  });

  it('hands the chosen competition to the next step', async () => {
    mockFetch.mockResolvedValue([comp()]);
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    fireEvent.click(await screen.findByText('Gros Jouets à Montréal 2026'));

    expect(readCompetition()).toEqual({
      id: 'GrosJouetsaMontreal2026', name: 'Gros Jouets à Montréal 2026',
    });
  });

  it('clears a competition\'s downstream answers when a different one is picked', async () => {
    // Otherwise competition A's scope and settings generate the wrong documents under B's name.
    writeCompetition('Older2026', 'Older 2026');
    writeScope(DEFAULT_SCOPE, { showSecondRoundMode: true });
    mockFetch.mockResolvedValue([comp()]);

    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    fireEvent.click(await screen.findByText('Gros Jouets à Montréal 2026'));

    expect(readStoredScope()).toBeNull();
  });

  it('keeps them when the same competition is picked again', async () => {
    writeCompetition('GrosJouetsaMontreal2026', 'Gros Jouets à Montréal 2026');
    writeScope(DEFAULT_SCOPE, { showSecondRoundMode: true });
    mockFetch.mockResolvedValue([comp()]);

    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    fireEvent.click(await screen.findByText('Gros Jouets à Montréal 2026'));

    expect(readStoredScope()).not.toBeNull();
  });

  it('leaves no custom-competition state behind on a WCA competition', async () => {
    writeCustom([{ name: 'Mystery', iconDataUrl: null, format: 'avg5', cutoff: '', limit: '' }]);
    mockFetch.mockResolvedValue([comp()]);

    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });
    fireEvent.click(await screen.findByText('Gros Jouets à Montréal 2026'));

    // A leaked custom event would print an extra scorecard PDF nobody asked for.
    expect(readIsCustom()).toBe(false);
    expect(readCustomEvents()).toEqual([]);
  });

  it('shows the error state when the WCA API fails', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });

    expect(await screen.findByText(i18n.t('picker.error', { message: 'boom' }))).toBeTruthy();
  });
});
