// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  fetchManagedCompetitions: vi.fn(),
}));

import { fetchManagedCompetitions } from '../auth/wca';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { renderWithProviders, signedInAuth, useEnglish } from '../test/render';
import CompetitionPickerPage from './CompetitionPickerPage';

const mockFetch = vi.mocked(fetchManagedCompetitions);

// Mount smoke test. Assertions go through i18n keys, never literal copy.

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

  it('shows the error state when the WCA API fails', async () => {
    mockFetch.mockRejectedValue(new Error('boom'));
    renderWithProviders(<CompetitionPickerPage />, { auth: signedInAuth });

    expect(await screen.findByText(i18n.t('picker.error', { message: 'boom' }))).toBeTruthy();
  });
});
