import React from 'react';
import type { ParsedWCIF } from '../lib/wcif-parser';
import type { CompetitionSettings } from '../types/settings';
import { buildCustomEntries } from '../lib/customScorecards';
import type { PdfJob } from '../lib/pdfJobs';
import { ScorecardDocument } from './ScorecardDocument';
import { NametTagDocument } from './NametTagDocument';
import { ScheduleTrackerDocument } from './ScheduleTrackerDocument';
import { CheckingSheetDocument } from './CheckingSheetDocument';
import { FirstTimerSlipDocument } from './FirstTimerSlipDocument';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Element = any;

/** @react-pdf's element typing does not survive a generic component, so the casts live here. */
function e<P extends object>(component: (props: P) => Element, props: P): Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return React.createElement(component as any, props);
}

/**
 * Out of scorecardWorker.ts, which assigns `self.onmessage` at module scope and so cannot be
 * imported: this is what render.integration.test.ts exercises.
 */
export function jobElement(
  job: PdfJob, parsed: ParsedWCIF, settings: CompetitionSettings,
): Element {
  switch (job.kind) {
    case 'nametags':     return e(NametTagDocument,        { nametags: job.nametags, settings });
    case 'schedule':     return e(ScheduleTrackerDocument, { days: parsed.scheduleDays, settings });
    case 'checking':     return e(CheckingSheetDocument,   { days: parsed.checkingDays, settings });
    case 'first-timers': return e(FirstTimerSlipDocument,  { entries: parsed.firstTimers, settings });
    case 'custom':       return e(ScorecardDocument,       { entries: buildCustomEntries(job.custom), settings });
    case 'scorecards':   return e(ScorecardDocument,       { entries: job.entries, settings });
    // Element is `any`, so a missing case would compile and hand the worker `undefined`.
    default: { const _exhaustive: never = job; throw new Error(`unhandled job kind: ${JSON.stringify(_exhaustive)}`); }
  }
}
