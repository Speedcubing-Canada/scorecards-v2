// Pure layout constants shared between the @react-pdf document components (which run
// in the PDF worker) and the page-count estimator (src/lib/pageEstimate.ts, main thread).
// Kept free of any @react-pdf import so the estimator never pulls the PDF engine - and
// its Buffer polyfill ordering - into the main bundle.

// The PDF typeface. Helvetica is one of the 14 PDF base fonts, so it needs no embedding
// and renders identically in every viewer - which is what makes the printed output
// predictable. Every document uses these two rather than its own copy.
export const PDF_FONT = 'Helvetica';
export const PDF_FONT_BOLD = 'Helvetica-Bold';

// Shared table chrome for the two ruled documents (schedule tracker and Round
// Checklist). They print side by side on the same clipboard, so they have to look like
// one family: outer rule darker than the inner row rules, alternating row tint light
// enough to photocopy.
export const TABLE_BORDER = '0.75pt solid #888';
export const TABLE_BORDER_INNER = '0.5pt solid #bbb';
export const TABLE_ROW_ALT = '#f2f2f2';
export const TABLE_HEADER_BG = '#d8d8d8';

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
// width). `event` is widest: it holds the longest text we print anywhere in the table
// (FR "3x3x3 a Une Main Manche 1", ~127pt) and is the column with the least headroom.
// `dataEntry`/`doubleCheck` must fit several sets of initials AND a right-edge tick box;
// `scorecards` holds only a box, so it is sized purely by its header.
// checking-sheet-layout.test.ts asserts every header and every cell fits in every locale
// on both paper sizes - widen the column rather than truncating a translation.
export const CHECKING_FLEX = {
  start: 1,
  event: 2.7,
  groups: 1,
  scorecards: 1.1,
  dataEntry: 1.3,
  doubleCheck: 1.35,
  takenBy: 1.55,
};

// Vertical padding in a checking-sheet data cell. Taller than the schedule tracker's
// 6pt: most columns are filled in by hand, and initials need room.
export const CHECKING_CELL_PAD_V = 9;

// Tick box edge length, shared by the checking sheet and the cover card
// (ScorecardDocument styles.coverCheckBox) so a delegate sees the same box in either mode.
export const CHECKING_BOX = 9;

// The rule drawn where lunch splits a day, on both the checking sheet and the schedule
// tracker. Must read as a divider against the 0.5pt #bbb line between ordinary rows.
export const CHECKING_BREAK_RULE = '1.5pt solid #444';
export const CHECKING_BREAK_RULE_W = 1.5;

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

// The scorecard's "WCA Live: …" line. `hideWcaLiveId` only suppresses it where there is
// no ID to print - blank/extra cards and custom-event cards, which all carry liveId ''.
// A card with a competitor always keeps its ID, whatever the setting says.
export const showLiveIdLine = (hideWcaLiveId: boolean, liveId: string) =>
  !hideWcaLiveId || liveId !== '';
