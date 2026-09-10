// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  fetchWcif: vi.fn(),
}));

import { fetchWcif } from '../auth/wca';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { writeCompetition, readStoredScope } from '../lib/flowState';
import { sampleWcif } from '../test/fixtures';
import { renderWithProviders, signedInAuth, useEnglish } from '../test/render';
import RoundScopePage from './RoundScopePage';

const mockWcif = vi.mocked(fetchWcif);

// Mount smoke test, on the real fixture WCIF: this is the only test that runs a
// fetched WCIF through parseWCIF and into a rendered page.

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  markAllSeen();
  await useEnglish();
  vi.clearAllMocks();
  mockWcif.mockResolvedValue(sampleWcif());
  writeCompetition('GrosJouetsaMontreal2026', 'Gros Jouets à Montréal 2026');
});
afterEach(cleanup);

describe('RoundScopePage', () => {
  it('renders the document choices once the WCIF loads', async () => {
    renderWithProviders(<RoundScopePage />, { auth: signedInAuth });

    expect(await screen.findByText(i18n.t('scope.docs_title'))).toBeTruthy();
    expect(mockWcif).toHaveBeenCalledWith('GrosJouetsaMontreal2026', 'test-token');
    expect(screen.getByRole('button', { name: i18n.t('scope.continue') })).toBeTruthy();
    // Nothing is written until Continue.
    expect(readStoredScope()).toBeNull();
  });

  it('surfaces a WCIF fetch failure instead of hanging on the skeleton', async () => {
    mockWcif.mockRejectedValue(new Error('boom'));
    // wcifCache is module-level and outlives a test: a competition the previous
    // test loaded would be served from cache and never hit the failing fetch.
    writeCompetition('Uncached2026', 'Uncached 2026');
    renderWithProviders(<RoundScopePage />, { auth: signedInAuth });

    expect(await screen.findByText(/boom/)).toBeTruthy();
  });
});
