// bufferPolyfill MUST be the first import — ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ScorecardData, ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings } from '../types/settings';
import { ScorecardDocument } from './ScorecardDocument';
import { NametTagDocument } from './NametTagDocument';

export type WorkerRequest = {
  parsed: ParsedWCIF;
  settings: CompetitionSettings;
};

export type WorkerResponse =
  | { type: 'progress'; percent: number; message: string }
  | { type: 'done'; buffer: ArrayBuffer }
  | { type: 'error'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

async function renderPdf(entries: ScorecardData[], settings: CompetitionSettings): Promise<Uint8Array> {
  const element = React.createElement(ScorecardDocument, { entries, settings });
  const blob = await pdf(element).toBlob();
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

async function renderNametags(parsed: ParsedWCIF, settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(NametTagDocument, { nametags: parsed.nametags, settings }) as any;
  const blob = await pdf(element).toBlob();
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  function post(msg: WorkerResponse, transfer?: Transferable[]) {
    workerSelf.postMessage(msg, transfer ?? []);
  }

  const { parsed, settings } = e.data;
  const id = settings.competitionId;

  // Build list of PDFs to render: round1, intermediate (round2), semis, finals, nametags
  type PdfJob =
    | { kind: 'scorecards'; filename: string; entries: ScorecardData[]; label: string }
    | { kind: 'nametags';   filename: string; label: string };

  const jobs: PdfJob[] = [];
  if (parsed.firstRound.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round1.pdf`,  entries: parsed.firstRound,   label: 'Round 1' });
  if (parsed.intermediate.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round2.pdf`,  entries: parsed.intermediate, label: 'Round 2' });
  if (parsed.semis.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_semis.pdf`,   entries: parsed.semis,        label: 'Semis' });
  if (parsed.finals.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_finals.pdf`,  entries: parsed.finals,       label: 'Finals' });
  if (parsed.nametags.length > 0)
    jobs.push({ kind: 'nametags',   filename: `${id}_nametags.pdf`, label: 'Name Tags' });

  if (jobs.length === 0) {
    post({ type: 'error', message: 'No entries to render.' });
    return;
  }

  post({ type: 'progress', percent: 2, message: 'Starting…' });

  try {
    const files: Record<string, [Uint8Array, { level: number }]> = {};

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const startPct = Math.round(5  + (i / jobs.length) * 87);
      const endPct   = Math.round(5  + ((i + 1) / jobs.length) * 87);
      const capPct   = endPct - 3;

      post({ type: 'progress', percent: startPct, message: `Rendering ${job.label}…` });

      // Exponential easing: closes 6% of remaining gap each 100ms, minimum 0.4%/tick.
      // This keeps the bar visibly moving throughout without ever truly stalling at capPct.
      let fpct = startPct;
      const timer = setInterval(() => {
        fpct = Math.min(fpct + Math.max(0.4, (capPct - fpct) * 0.06), capPct);
        post({ type: 'progress', percent: Math.round(fpct), message: `Rendering ${job.label}…` });
      }, 100);

      try {
        const data = job.kind === 'nametags'
          ? await renderNametags(parsed, settings)
          : await renderPdf(job.entries, settings);
        clearInterval(timer);
        files[job.filename] = [data, { level: 0 }];
        post({ type: 'progress', percent: endPct, message: `${job.label} done` });
      } catch (err) {
        clearInterval(timer);
        throw err;
      }
    }

    post({ type: 'progress', percent: 95, message: 'Creating ZIP…' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zipped = zipSync(files as any);
    post({ type: 'progress', percent: 99, message: 'Finalizing…' });
    post({ type: 'done', buffer: zipped.buffer }, [zipped.buffer]);
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
};
