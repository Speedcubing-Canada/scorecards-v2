// Pure layout constants shared between the @react-pdf document components (which run
// in the PDF worker) and the page-count estimator (src/lib/pageEstimate.ts, main thread).
// Kept free of any @react-pdf import so the estimator never pulls the PDF engine - and
// its Buffer polyfill ordering - into the main bundle.

// Four scorecards per printed page (2×2 grid).
export const SCORECARDS_PER_PAGE = 4;

// Attempt-row heights per scorecard format. Tuned so the two flex spacers around
// the provisional label stay ~6–8pt each (see the budget formula in
// ScorecardDocument.tsx and the guard in scorecard-layout.test.ts).
export const ROW_HEIGHTS = {
  avg5: 34, 'bo2-avg5': 31, mo3: 51, 'bo1-mo3': 49, bo2: 55, bo1: 100,
} as const;

// Four people per page in both name-tag layouts (each uses a front + back panel).
export const NAMETAGS_PER_PAGE = 4;

// Event icons appear only on the side WITHOUT QR codes - but only in the compact
// (horizontal) layout, where space is tight and Sarah asked to declutter the QR
// side. The vertical layout keeps icons on both panels as before.
export function eventIconsVisible({ isQrSide, compact }: { isQrSide: boolean; compact: boolean }): boolean {
  return !(isQrSide && compact);
}

// Checking-sheet column widths (flex units, not points - the table fills the page
// width). `doubleCheck` is wider than its neighbours because "Double-check" is the
// longest header we ship; `takenBy` is widest because it holds a name, not initials.
// checking-sheet-layout.test.ts asserts every header fits in every locale on both
// paper sizes - widen the column rather than truncating a translation.
export const CHECKING_FLEX = {
  start: 1,
  event: 2.5,
  groups: 1.1,
  scorecards: 1,
  dataEntry: 1.1,
  doubleCheck: 1.25,
  takenBy: 1.6,
};

// Vertical padding in a checking-sheet data cell. Taller than the schedule tracker's
// 6pt: every column but "groups" is filled in by hand, and initials need room.
export const CHECKING_CELL_PAD_V = 9;

// First-timer slip pitch. Each line is LINE_H tall; a slip adds its bottom margin plus
// the intro block's bottom margin. @react-pdf inflates lineHeight by a constant factor,
// so fixed-height rows give a predictable pitch.
// Font size + line pitch reduced from 11/14 so that three large slips (4–5 events)
// still fit one page after the inter-slip gap grew by a full line (Sarah's feedback).
export const SLIP_FONT_SIZE = 10;
export const SLIP_LINE_H = 13;
export const SLIP_PAGE_PAD_TOP = 38;
export const SLIP_PAGE_PAD_BOTTOM = 36;
// Gap between consecutive slips. One extra blank line (SLIP_LINE_H) beyond the
// base 18pt makes the cut point between slips more obvious (Sarah's feedback).
export const SLIP_MARGIN_BOTTOM = 18 + SLIP_LINE_H;
export const SLIP_INTRO_MARGIN_BOTTOM = 20;
