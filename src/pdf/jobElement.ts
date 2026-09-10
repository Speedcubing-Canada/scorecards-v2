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
 * The document each job kind renders. Adding a document type means adding one line here
 * and one in `buildPdfJobs` - the two lists are what keep the worker and the generate
 * page's file count in agreement.
 *
 * Kept out of scorecardWorker.ts, which assigns `self.onmessage` at module scope and so
 * cannot be imported anywhere else: this is what render.integration.test.ts exercises.
 */
export function jobElement(
  job: PdfJob, parsed: ParsedWCIF, settings: CompetitionSettings,
): Element {
  switch (job.kind) {
    case 'nametags':     return e(NametTagDocument,        { nametags: parsed.nametags, settings });
    case 'schedule':     return e(ScheduleTrackerDocument, { days: parsed.scheduleDays, settings });
    case 'checking':     return e(CheckingSheetDocument,   { days: parsed.checkingDays, settings });
    case 'first-timers': return e(FirstTimerSlipDocument,  { entries: parsed.firstTimers, settings });
    case 'custom':       return e(ScorecardDocument,       { entries: buildCustomEntries(job.custom), settings });
    case 'scorecards':   return e(ScorecardDocument,       { entries: job.entries, settings });
  }
}
