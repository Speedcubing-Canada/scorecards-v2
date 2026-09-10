import { describe, it, expect } from 'vitest';
import { renderToBuffer } from '@react-pdf/renderer';
import { parseWCIF } from '../lib/wcif-parser';
import { buildPdfJobs } from '../lib/pdfJobs';
import { sampleWcif, testSettings } from '../test/fixtures';
import { jobElement } from './jobElement';

// The layout tests assert measurements; this asserts the documents render at all.
// Nothing else in the suite executes src/pdf/*Document.tsx, so a job kind that
// buildPdfJobs can emit but no document can render would otherwise only surface
// on an organizer's download.
//
// renderToBuffer is @react-pdf's Node entry point - the worker's pdf().toBlob()
// path needs a browser. Both go through the same `jobElement` mapping, which is
// the part that can drift.

const settings = testSettings({
  customEvents: [{ name: 'Team BLD', iconDataUrl: null, format: 'mo3', cutoff: '', limit: '' }],
});
const parsed = parseWCIF(sampleWcif(), settings);
const jobs = buildPdfJobs(parsed, settings);

describe('PDF rendering', () => {
  it('emits one job of every kind', () => {
    expect(new Set(jobs.map(j => j.kind))).toEqual(
      new Set(['scorecards', 'schedule', 'checking', 'nametags', 'first-timers', 'custom']),
    );
  });

  it.each(jobs.map(j => [j.filename, j] as const))('renders %s', async (_name, job) => {
    const buf = await renderToBuffer(jobElement(job, parsed, settings));
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    // A document that renders zero pages still produces a valid, tiny PDF.
    expect(buf.byteLength).toBeGreaterThan(2000);
  });
});
