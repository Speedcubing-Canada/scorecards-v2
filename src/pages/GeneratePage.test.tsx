// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

vi.mock('../auth/wca', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/wca')>()),
  fetchWcif: vi.fn(),
}));
vi.mock('../lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/analytics')>()),
  send: vi.fn(),
}));

import { fetchWcif } from '../auth/wca';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { writeCompetition, writeSettings } from '../lib/flowState';
import { buildPdfJobs, downloadTarget } from '../lib/pdfJobs';
import { parseWCIF } from '../lib/wcif-parser';
import { sampleWcif, testSettings } from '../test/fixtures';
import { renderWithProviders, signedInAuth, useEnglish } from '../test/render';
import GeneratePage from './GeneratePage';

const mockWcif = vi.mocked(fetchWcif);

// The download step. Its PDF count and button label are derived from the same
// buildPdfJobs list the worker renders from, so a drift between them ships an
// organizer a bundle that does not match what the page promised.
//
// The worker itself is stubbed: jsdom implements no Worker, and vitest cannot load
// a `new URL(..., import.meta.url)` module worker. Rendering is covered headlessly
// by src/pdf/render.integration.test.ts instead.

const posted: unknown[] = [];
class StubWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(msg: unknown) { posted.push(msg); }
  terminate() {}
}

const settings = testSettings({ competitionId: 'GrosJouetsaMontreal2026' });
const jobs = buildPdfJobs(parseWCIF(sampleWcif(), settings), settings);
const downloadName = i18n.t('generate.download_button', {
  filename: downloadTarget(jobs, settings.competitionId).filename,
});
const downloadButton = () => screen.findByRole('button', { name: downloadName });

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  posted.length = 0;
  markAllSeen();
  await useEnglish();
  vi.clearAllMocks();
  vi.stubGlobal('Worker', StubWorker);
  mockWcif.mockResolvedValue(sampleWcif());
  writeCompetition(settings.competitionId, settings.competitionName);
  writeSettings(settings);
});
afterEach(cleanup);

describe('GeneratePage', () => {
  it('offers a download whose file count matches buildPdfJobs', async () => {
    renderWithProviders(<GeneratePage />, { auth: signedInAuth });

    expect(await downloadButton()).toBeTruthy();
    expect(screen.getByText(String(jobs.length))).toBeTruthy();
  });

  it('hands the worker the parsed competition when download is clicked', async () => {
    renderWithProviders(<GeneratePage />, { auth: signedInAuth });

    fireEvent.click(await downloadButton());

    expect(posted).toHaveLength(1);
    const req = posted[0] as { settings: typeof settings; parsed: { nametags: unknown[] } };
    expect(req.settings.competitionId).toBe(settings.competitionId);
    expect(req.parsed.nametags).toHaveLength(4);
  });
});
