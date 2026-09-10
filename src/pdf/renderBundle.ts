import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import { buildPdfJobs, downloadTarget, type PdfJob } from '../lib/pdfJobs';
import { getWorkerStrings } from '../lib/i18n';
import { jobElement } from './jobElement';

// Split out of scorecardWorker.ts so it imports neither `self` nor the Buffer polyfill and
// can run outside a worker.

export type WorkerRequest = {
  parsed: ParsedWCIF;
  settings: CompetitionSettings;
  uiLanguage: LocaleCode;
};

export type WorkerResponse =
  | { type: 'progress'; percent: number; message: string }
  // A ZIP or a bare PDF, depending on how many documents were built. `mimeType` says which,
  // so the main thread never re-derives it.
  | { type: 'done'; buffer: ArrayBuffer; filename: string; mimeType: string }
  | { type: 'error'; message: string };

export type Post = (msg: WorkerResponse, transfer?: Transferable[]) => void;

async function renderJob(
  job: PdfJob, parsed: ParsedWCIF, settings: CompetitionSettings,
): Promise<Uint8Array> {
  const blob = await pdf(jobElement(job, parsed, settings)).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

export async function runJobs({ parsed, settings, uiLanguage }: WorkerRequest, post: Post) {
  const msgs = getWorkerStrings(uiLanguage);

  // Shared with the generate page, so its stat and button label cannot drift from this.
  const jobs = buildPdfJobs(parsed, settings);
  const target = downloadTarget(jobs, settings.competitionId);

  if (jobs.length === 0) {
    post({ type: 'error', message: msgs.noEntries });
    return;
  }

  post({ type: 'progress', percent: 2, message: msgs.starting });

  try {
    const files: Record<string, [Uint8Array, { level: number }]> = {};

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const startPct = Math.round(5  + (i / jobs.length) * 87);
      const endPct   = Math.round(5  + ((i + 1) / jobs.length) * 87);
      const capPct   = endPct - 3;

      post({ type: 'progress', percent: startPct, message: msgs.rendering(job.label) });

      // Closes 6% of the remaining gap per tick, minimum 0.4%: visibly moving, never stalled.
      let fpct = startPct;
      const timer = setInterval(() => {
        fpct = Math.min(fpct + Math.max(0.4, (capPct - fpct) * 0.06), capPct);
        post({ type: 'progress', percent: Math.round(fpct), message: msgs.rendering(job.label) });
      }, 100);

      try {
        const data = await renderJob(job, parsed, settings);
        clearInterval(timer);
        files[job.filename] = [data, { level: 0 }];
        post({ type: 'progress', percent: endPct, message: msgs.done(job.label) });
      } catch (err) {
        clearInterval(timer);
        throw err;
      }
    }

    // A single document ships as the PDF itself, not a one-file zip.
    if (jobs.length === 1) {
      const only = files[jobs[0].filename][0];
      // Sliced by the view's own bounds, in case one ever arrives offset into a larger buffer.
      const buffer = only.buffer.slice(only.byteOffset, only.byteOffset + only.byteLength) as ArrayBuffer;
      post({ type: 'progress', percent: 99, message: msgs.finalizing });
      post({ type: 'done', buffer, filename: target.filename, mimeType: target.mimeType }, [buffer]);
      return;
    }

    post({ type: 'progress', percent: 95, message: msgs.creatingZip });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zipped = zipSync(files as any);
    post({ type: 'progress', percent: 99, message: msgs.finalizing });
    post(
      { type: 'done', buffer: zipped.buffer, filename: target.filename, mimeType: target.mimeType },
      [zipped.buffer],
    );
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
}
