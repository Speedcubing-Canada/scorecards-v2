// bufferPolyfill MUST be the first import - ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ScorecardData, ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings } from '../types/settings';
import { buildCustomEntries } from '../lib/customScorecards';
import { buildPdfJobs, downloadTarget } from '../lib/pdfJobs';
import { ScorecardDocument } from './ScorecardDocument';
import { NametTagDocument } from './NametTagDocument';
import { ScheduleTrackerDocument } from './ScheduleTrackerDocument';
import { CheckingSheetDocument } from './CheckingSheetDocument';
import { FirstTimerSlipDocument } from './FirstTimerSlipDocument';

export type WorkerRequest = {
  parsed: ParsedWCIF;
  settings: CompetitionSettings;
  uiLanguage: 'en' | 'fr' | 'es' | 'pt';
};

const WORKER_MSGS = {
  en: {
    starting: 'Starting…',
    rendering: (label: string) => `Rendering ${label}…`,
    done: (label: string) => `${label} done`,
    creatingZip: 'Creating ZIP…',
    finalizing: 'Finalizing…',
    noEntries: 'No entries to render.',
  },
  fr: {
    starting: 'Démarrage…',
    rendering: (label: string) => `Rendu de ${label}…`,
    done: (label: string) => `${label} terminé`,
    creatingZip: 'Création du ZIP…',
    finalizing: 'Finalisation…',
    noEntries: 'Aucune feuille à générer.',
  },
  es: {
    starting: 'Iniciando…',
    rendering: (label: string) => `Renderizando ${label}…`,
    done: (label: string) => `${label} listo`,
    creatingZip: 'Creando ZIP…',
    finalizing: 'Finalizando…',
    noEntries: 'Sin hojas que generar.',
  },
  pt: {
    starting: 'Iniciando…',
    rendering: (label: string) => `Renderizando ${label}…`,
    done: (label: string) => `${label} concluído`,
    creatingZip: 'Criando ZIP…',
    finalizing: 'Finalizando…',
    noEntries: 'Nenhuma folha para gerar.',
  },
};

export type WorkerResponse =
  | { type: 'progress'; percent: number; message: string }
  // `buffer` is a ZIP or a bare PDF depending on how many documents were built;
  // `filename` and `mimeType` say which, so the main thread never re-derives it.
  | { type: 'done'; buffer: ArrayBuffer; filename: string; mimeType: string }
  | { type: 'error'; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workerSelf = self as any;

async function renderPdf(entries: ScorecardData[], settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ScorecardDocument, { entries, settings }) as any;
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

async function renderFirstTimerSlips(parsed: ParsedWCIF, settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(FirstTimerSlipDocument, { entries: parsed.firstTimers, settings }) as any;
  const blob = await pdf(element).toBlob();
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

async function renderScheduleTracker(parsed: ParsedWCIF, settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ScheduleTrackerDocument, { days: parsed.scheduleDays, settings }) as any;
  const blob = await pdf(element).toBlob();
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

async function renderCheckingSheet(parsed: ParsedWCIF, settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(CheckingSheetDocument, { days: parsed.checkingDays, settings }) as any;
  const blob = await pdf(element).toBlob();
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

workerSelf.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  function post(msg: WorkerResponse, transfer?: Transferable[]) {
    workerSelf.postMessage(msg, transfer ?? []);
  }

  const { parsed, settings, uiLanguage } = e.data;
  const msgs = WORKER_MSGS[uiLanguage] ?? WORKER_MSGS.en;

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
        const data = job.kind === 'nametags'
          ? await renderNametags(parsed, settings)
          : job.kind === 'schedule'
          ? await renderScheduleTracker(parsed, settings)
          : job.kind === 'checking'
          ? await renderCheckingSheet(parsed, settings)
          : job.kind === 'first-timers'
          ? await renderFirstTimerSlips(parsed, settings)
          : job.kind === 'custom'
          ? await renderPdf(buildCustomEntries(job.custom), settings)
          : await renderPdf(job.entries, settings);
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
