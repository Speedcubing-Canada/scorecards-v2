// bufferPolyfill MUST be the first import — ES modules execute in dependency
// order, so this sets globalThis.Buffer before @react-pdf/renderer initializes.
import './bufferPolyfill';

import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';
import type { ScorecardData, ScorecardEntry, ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings, CustomEvent } from '../types/settings';
import { ScorecardDocument } from './ScorecardDocument';
import { NametTagDocument } from './NametTagDocument';
import { ScheduleTrackerDocument } from './ScheduleTrackerDocument';

export type WorkerRequest = {
  parsed: ParsedWCIF;
  settings: CompetitionSettings;
  uiLanguage: 'en' | 'fr' | 'es';
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

function buildCustomEntries(custom: CustomEvent): ScorecardData[] {
  const hasCutoff = custom.cutoff.trim() !== '';
  const format = custom.format === 'mo3'
    ? (hasCutoff ? 'bo1-mo3' : 'mo3')
    : (hasCutoff ? 'bo2-avg5' : 'avg5');
  const entry: ScorecardEntry = {
    kind: 'scorecard',
    timeslot: 'ZZZ',
    eventId: 'custom',
    eventName: custom.name,
    roundLabel: '',
    group: '',
    name: '',
    wcaId: '',
    liveId: '',
    gender: '',
    cutoff: custom.cutoff.trim(),
    limit: custom.limit.trim(),
    format,
    isCumulative: false,
    iconDataUrl: custom.iconDataUrl ?? undefined,
  };
  return [entry, entry, entry, entry];
}

async function renderScheduleTracker(parsed: ParsedWCIF, settings: CompetitionSettings): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ScheduleTrackerDocument, { days: parsed.scheduleDays, settings }) as any;
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
  const id = settings.competitionId;

  // Build list of PDFs to render: round1, intermediate (round2), semis, finals, nametags, extras, schedule
  type PdfJob =
    | { kind: 'scorecards'; filename: string; entries: ScorecardData[]; label: string }
    | { kind: 'nametags';   filename: string; label: string }
    | { kind: 'schedule';   filename: string; label: string };

  const jobs: PdfJob[] = [];
  if (parsed.firstRound.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round1.pdf`,   entries: parsed.firstRound,   label: 'Round 1' });
  if (parsed.intermediate.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_round2.pdf`,   entries: parsed.intermediate, label: 'Round 2' });
  if (parsed.semis.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_semis.pdf`,    entries: parsed.semis,        label: 'Semis' });
  if (parsed.finals.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_finals.pdf`,   entries: parsed.finals,       label: 'Finals' });
  if (parsed.extras.length > 0)
    jobs.push({ kind: 'scorecards', filename: `${id}_extras.pdf`,   entries: parsed.extras,       label: 'Extras' });
  if (parsed.scheduleDays.length > 0)
    jobs.push({ kind: 'schedule',   filename: `${id}_schedule.pdf`, label: 'Schedule Tracker' });
  if (parsed.nametags.length > 0)
    jobs.push({ kind: 'nametags',   filename: `${id}_nametags.pdf`, label: 'Name Tags' });
  for (const custom of settings.customEvents ?? []) {
    if (!custom.name.trim()) continue;
    const safeName = custom.name.trim().replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
    jobs.push({ kind: 'scorecards', filename: `${id}_custom_${safeName}.pdf`, entries: buildCustomEntries(custom), label: custom.name });
  }

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
          : await renderPdf(job.entries, settings);
        clearInterval(timer);
        files[job.filename] = [data, { level: 0 }];
        post({ type: 'progress', percent: endPct, message: msgs.done(job.label) });
      } catch (err) {
        clearInterval(timer);
        throw err;
      }
    }

    post({ type: 'progress', percent: 95, message: msgs.creatingZip });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zipped = zipSync(files as any);
    post({ type: 'progress', percent: 99, message: msgs.finalizing });
    post({ type: 'done', buffer: zipped.buffer }, [zipped.buffer]);
  } catch (err) {
    post({ type: 'error', message: String(err) });
  }
};
