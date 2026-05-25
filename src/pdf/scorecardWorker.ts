// bufferPolyfill MUST be the first import — ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ScorecardData, ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings } from '../types/settings';
import { ScorecardDocument } from './ScorecardDocument';

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

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  function post(msg: WorkerResponse, transfer?: Transferable[]) {
    workerSelf.postMessage(msg, transfer ?? []);
  }

  const { parsed, settings } = e.data;
  const id = settings.competitionId;

  // Build list of PDFs to render: round1, intermediate (round2), finals
  const pdfsToRender: Array<{ filename: string; entries: ScorecardData[]; label: string }> = [];
  if (parsed.firstRound.length > 0)
    pdfsToRender.push({ filename: `${id}_round1.pdf`, entries: parsed.firstRound, label: 'Round 1' });
  if (parsed.intermediate.length > 0)
    pdfsToRender.push({ filename: `${id}_round2.pdf`, entries: parsed.intermediate, label: 'Round 2' });
  if (parsed.finals.length > 0)
    pdfsToRender.push({ filename: `${id}_finals.pdf`, entries: parsed.finals, label: 'Finals' });

  if (pdfsToRender.length === 0) {
    post({ type: 'error', message: 'No entries to render.' });
    return;
  }

  post({ type: 'progress', percent: 2, message: 'Starting…' });

  try {
    const files: Record<string, [Uint8Array, { level: number }]> = {};

    for (let i = 0; i < pdfsToRender.length; i++) {
      const { filename, entries, label } = pdfsToRender[i];
      const startPct = Math.round(5  + (i / pdfsToRender.length) * 87);
      const endPct   = Math.round(5  + ((i + 1) / pdfsToRender.length) * 87);
      const capPct   = endPct - 3;

      let pct = startPct;
      const pages = Math.ceil(entries.length / 4);
      const intervalMs = Math.max(80, Math.round((pages * 250) / Math.max(1, capPct - startPct)));

      post({ type: 'progress', percent: startPct, message: `Rendering ${label}…` });

      const timer = setInterval(() => {
        pct = Math.min(pct + 1, capPct);
        post({ type: 'progress', percent: pct, message: `Rendering ${label}…` });
      }, intervalMs);

      try {
        const data = await renderPdf(entries, settings);
        clearInterval(timer);
        files[filename] = [data, { level: 0 }];
        post({ type: 'progress', percent: endPct, message: `${label} done` });
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
