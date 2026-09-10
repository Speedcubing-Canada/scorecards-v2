import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unzipSync } from 'fflate';

// A stub renderer: real PDF bytes are already covered by ./render.integration.test.ts, so
// this file covers the orchestration around it - which jobs run, what gets zipped, and what
// happens when one throws. Overlapping the two would only make both slower.
const toBlob = vi.fn();
vi.mock('@react-pdf/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-pdf/renderer')>()),
  pdf: () => ({ toBlob }),
}));

import { parseWCIF } from '../lib/wcif-parser';
import { filterParsedByScope } from '../lib/generationScope';
import { buildPdfJobs } from '../lib/pdfJobs';
import { getWorkerStrings } from '../lib/i18n';
import { emptyParsedWcif } from '../lib/wcif-parser';
import { sampleWcif, testSettings } from '../test/fixtures';
import { runJobs, type WorkerResponse } from './renderBundle';

// The seam between "what the generate page promised" and "what the browser receives".
// buildPdfJobs is tested on its own and the documents render on their own; nothing else
// checks that every job in that list actually reaches the bundle, which is the failure that
// hands an organizer a zip missing a document they were told they would get.

const settings = testSettings();
const parsed = parseWCIF(sampleWcif(), settings);

/** A blob standing in for one rendered PDF, tagged so the zip entries can be told apart. */
const fakePdf = (tag: string) => ({
  arrayBuffer: async () => new TextEncoder().encode(`%PDF-${tag}`).buffer,
});

function collect() {
  const msgs: WorkerResponse[] = [];
  return { msgs, post: (m: WorkerResponse) => void msgs.push(m) };
}

const progress = (m: WorkerResponse[]) => m.filter(x => x.type === 'progress');
const done = (m: WorkerResponse[]) => m.find(x => x.type === 'done');
const error = (m: WorkerResponse[]) => m.find(x => x.type === 'error');

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  toBlob.mockImplementation(async () => fakePdf(String(n++)));
});
afterEach(() => vi.useRealTimers());

describe('nothing to render', () => {
  it('reports the localised no-entries message and renders nothing', async () => {
    const { msgs, post } = collect();
    await runJobs({ parsed: emptyParsedWcif(), settings, uiLanguage: 'en' }, post);

    expect(error(msgs)?.message).toBe(getWorkerStrings('en').noEntries);
    expect(progress(msgs)).toHaveLength(0);
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('uses the organizer\'s UI language for that message', async () => {
    const { msgs, post } = collect();
    await runJobs({ parsed: emptyParsedWcif(), settings, uiLanguage: 'fr' }, post);
    expect(error(msgs)?.message).toBe(getWorkerStrings('fr').noEntries);
  });
});

describe('a single document', () => {
  // Only the schedule tracker selected: it ships as the PDF itself, since zipping one file
  // would make the organizer unzip it before printing.
  const scope = {
    mode: 'everything' as const,
    documents: {
      scorecards: false, scheduleTracker: true, nametags: false,
      roundChecklist: false, firstTimerSlips: false,
    },
  };
  const soloSettings = testSettings({ generationScope: scope });
  // The scope is applied by the generate page before the request reaches the worker.
  const solo = filterParsedByScope(parseWCIF(sampleWcif(), soloSettings), scope);

  it('ships the bare PDF, not a zip', async () => {
    const jobs = buildPdfJobs(solo, soloSettings);
    expect(jobs).toHaveLength(1);

    const { msgs, post } = collect();
    await runJobs({ parsed: solo, settings: soloSettings, uiLanguage: 'en' }, post);

    const d = done(msgs)!;
    expect(d.mimeType).toBe('application/pdf');
    expect(d.filename).toBe(jobs[0].filename);
    // The PDF bytes themselves, unwrapped.
    expect(new TextDecoder().decode(d.buffer)).toBe('%PDF-0');
  });
});

describe('a bundle', () => {
  it('zips exactly the jobs buildPdfJobs listed', async () => {
    const jobs = buildPdfJobs(parsed, settings);
    expect(jobs.length).toBeGreaterThan(1);

    const { msgs, post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);

    const d = done(msgs)!;
    expect(d.mimeType).toBe('application/zip');
    expect(d.filename).toBe(`${settings.competitionId}_pdfs.zip`);

    // The assertion that catches a document silently dropped between the count the
    // generate page shows and the bytes that actually download.
    const entries = Object.keys(unzipSync(new Uint8Array(d.buffer)));
    expect(entries.sort()).toEqual(jobs.map(j => j.filename).sort());
  });

  it('renders every job once', async () => {
    const { post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);
    expect(toBlob).toHaveBeenCalledTimes(buildPdfJobs(parsed, settings).length);
  });

  it('includes a custom event in the bundle', async () => {
    const withCustom = testSettings({
      customEvents: [{ name: 'Team BLD', iconDataUrl: null, format: 'mo3', cutoff: '', limit: '' }],
    });
    const p = parseWCIF(sampleWcif(), withCustom);
    const { msgs, post } = collect();
    await runJobs({ parsed: p, settings: withCustom, uiLanguage: 'en' }, post);

    const entries = Object.keys(unzipSync(new Uint8Array(done(msgs)!.buffer)));
    expect(entries).toContain(`${withCustom.competitionId}_custom_Team_BLD.pdf`);
  });
});

describe('progress', () => {
  it('never goes backwards and ends at 99 before the bundle is handed over', async () => {
    const { msgs, post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);

    const percents = progress(msgs).map(m => m.percent);
    expect(percents[0]).toBe(2);
    expect(percents.at(-1)).toBe(99);
    for (let i = 1; i < percents.length; i++) {
      expect(percents[i]).toBeGreaterThanOrEqual(percents[i - 1]);
    }
    // The done message is last; nothing is posted after the buffer goes out.
    expect(msgs.at(-1)!.type).toBe('done');
  });

  it('names the document being rendered, in the organizer\'s language', async () => {
    const { msgs, post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'es' }, post);

    const label = buildPdfJobs(parsed, settings)[0].label;
    expect(progress(msgs).map(m => m.message))
      .toContain(getWorkerStrings('es').rendering(label));
  });
});

describe('a document that fails to render', () => {
  it('reports the error and hands over no bundle', async () => {
    toBlob.mockRejectedValue(new Error('font missing'));
    const { msgs, post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);

    expect(error(msgs)?.message).toContain('font missing');
    expect(done(msgs)).toBeUndefined();
  });

  it('stops after the failing document rather than rendering the rest', async () => {
    toBlob.mockResolvedValueOnce(fakePdf('0')).mockRejectedValue(new Error('boom'));
    const { post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);
    expect(toBlob).toHaveBeenCalledTimes(2);
  });

  it('clears the easing timer, so nothing is posted after the error', async () => {
    vi.useFakeTimers();
    toBlob.mockRejectedValue(new Error('boom'));
    const { msgs, post } = collect();
    await runJobs({ parsed, settings, uiLanguage: 'en' }, post);

    const after = msgs.length;
    // A timer left running would keep posting progress into a closed worker.
    await vi.advanceTimersByTimeAsync(1000);
    expect(msgs).toHaveLength(after);
  });
});
