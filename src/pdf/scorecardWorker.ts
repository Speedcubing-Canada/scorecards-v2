// bufferPolyfill MUST be the first import - ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings, LocaleCode } from '../types/settings';
import { buildCustomEntries } from '../lib/customScorecards';
import { buildPdfJobs, downloadTarget, type PdfJob } from '../lib/pdfJobs';
import { getWorkerStrings } from '../lib/i18n';
import { ScorecardDocument } from './ScorecardDocument';
import { NametTagDocument } from './NametTagDocument';
import { ScheduleTrackerDocument } from './ScheduleTrackerDocument';
import { CheckingSheetDocument } from './CheckingSheetDocument';
import { FirstTimerSlipDocument } from './FirstTimerSlipDocument';

export type WorkerRequest = {
  parsed: ParsedWCIF;
  settings: CompetitionSettings;
  uiLanguage: LocaleCode;
};

export type WorkerResponse =
  | { type: 'progress'; percent: number; message: string }
  // `buffer` is a ZIP or a bare PDF depending on how many documents were built;
  // `filename` and `mimeType` say which, so the main thread never re-derives it.
  | { type: 'done'; buffer: ArrayBuffer; filename: string; mimeType: string }
  | { type: 'error'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

/**
 * Render one document component to PDF bytes. Every document goes through here, so the
 * `any` casts that @react-pdf's element typing forces on us live in exactly one place.
 */
async function renderDoc<P extends object>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: (props: P) => any,
  props: P,
): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(component as any, props) as any;
  const blob = await pdf(element).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * The document each job kind renders. Adding a document type means adding one line here
 * and one in `buildPdfJobs` - the two lists are what keep the worker and the generate
 * page's file count in agreement.
 */
function renderJob(
  job: PdfJob, parsed: ParsedWCIF, settings: CompetitionSettings,
): Promise<Uint8Array> {
  switch (job.kind) {
    case 'nametags':     return renderDoc(NametTagDocument,        { nametags: parsed.nametags, settings });
    case 'schedule':     return renderDoc(ScheduleTrackerDocument, { days: parsed.scheduleDays, settings });
    case 'checking':     return renderDoc(CheckingSheetDocument,   { days: parsed.checkingDays, settings });
    case 'first-timers': return renderDoc(FirstTimerSlipDocument,  { entries: parsed.firstTimers, settings });
    case 'custom':       return renderDoc(ScorecardDocument,       { entries: buildCustomEntries(job.custom), settings });
    case 'scorecards':   return renderDoc(ScorecardDocument,       { entries: job.entries, settings });
  }
}

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  function post(msg: WorkerResponse, transfer?: Transferable[]) {
    workerSelf.postMessage(msg, transfer ?? []);
  }

  const { parsed, settings, uiLanguage } = e.data;
  const msgs = getWorkerStrings(uiLanguage);

  // Which PDFs to render, and what the browser will receive. Shared with the
  // generate page so its "PDFs" stat and button label can't drift from this.
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

      // Exponential easing: closes 6% of remaining gap each 100ms, minimum 0.4%/tick.
      // This keeps the bar visibly moving throughout without ever truly stalling at capPct.
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

    // A single document ships as the PDF itself - zipping one file would only
    // make the user unzip it before printing.
    if (jobs.length === 1) {
      const only = files[jobs[0].filename][0];
      // The renderers wrap a fresh ArrayBuffer, but slicing by the view's own
      // bounds stays correct if one ever arrives offset into a larger buffer.
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
};
