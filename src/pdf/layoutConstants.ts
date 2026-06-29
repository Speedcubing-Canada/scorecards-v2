// Pure layout constants shared between the @react-pdf document components (which run
// in the PDF worker) and the page-count estimator (src/lib/pageEstimate.ts, main thread).
// Kept free of any @react-pdf import so the estimator never pulls the PDF engine — and
// its Buffer polyfill ordering — into the main bundle.

// Four scorecards per printed page (2×2 grid).
export const SCORECARDS_PER_PAGE = 4;

// Four people per page in both name-tag layouts (each uses a front + back panel).
export const NAMETAGS_PER_PAGE = 4;

// First-timer slip pitch. Each line is LINE_H tall; a slip adds its bottom margin plus
// the intro block's bottom margin. @react-pdf inflates lineHeight by a constant factor,
// so fixed-height rows give a predictable pitch.
export const SLIP_LINE_H = 14;
export const SLIP_PAGE_PAD_TOP = 38;
export const SLIP_PAGE_PAD_BOTTOM = 36;
export const SLIP_MARGIN_BOTTOM = 18;
export const SLIP_INTRO_MARGIN_BOTTOM = 20;
