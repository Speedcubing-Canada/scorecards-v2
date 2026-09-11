import type { LiveResultsMode } from '../types/settings';

// Shared by the PDF documents (worker) and the page-count estimator (main thread).
// Must stay free of any @react-pdf import, or the estimator drags the PDF engine into
// the main bundle.

// One of the 14 PDF base fonts: no embedding, identical in every viewer.
export const PDF_FONT = 'Helvetica';
export const PDF_FONT_BOLD = 'Helvetica-Bold';

// Schedule tracker and Round Checklist share a clipboard, so they share their chrome.
// Row tint stays light enough to photocopy.
export const TABLE_BORDER = '0.75pt solid #888';
export const TABLE_BORDER_INNER = '0.5pt solid #bbb';
export const TABLE_ROW_ALT = '#f2f2f2';
export const TABLE_HEADER_BG = '#d8d8d8';

// 2x2 grid.
export const SCORECARDS_PER_PAGE = 4;

// Past this, a bucket splits into one PDF per event. See "Generation performance" in the README.
export const MAX_PAGES_PER_SCORECARD_PDF = 250;

// Tuned so the flex spacers around the provisional label stay 6-8pt each; the budget
// formula is in ScorecardDocument.tsx, the guard in scorecard-layout.test.ts.
export const ROW_HEIGHTS = {
  avg5: 34, 'bo2-avg5': 31, mo3: 51, 'bo1-mo3': 49, bo2: 55, bo1: 100,
} as const;

// Four people per page, front + back panel each.
export const NAMETAGS_PER_PAGE = 4;

// Same ceiling, same reason.
export const MAX_PAGES_PER_NAMETAG_PDF = 250;

// The compact layout is tight enough that the QR side must stay uncluttered.
export function eventIconsVisible({ isQrSide, compact }: { isQrSide: boolean; compact: boolean }): boolean {
  return !(isQrSide && compact);
}

// Flex units, not points: the table fills the page width. `event` carries the longest
// text in the table (FR "3x3x3 à Une Main Tour 1", ~127pt) and has the least headroom.
// checking-sheet-layout.test.ts asserts every cell fits in every locale on both paper
// sizes: widen the column rather than truncating a translation.
export const CHECKING_FLEX = {
  start: 1,
  event: 2.7,
  groups: 1,
  scorecards: 1.1,
  dataEntry: 1.3,
  doubleCheck: 1.35,
  takenBy: 1.55,
};

// Taller than the schedule tracker's 6pt: these columns are filled in by hand.
export const CHECKING_CELL_PAD_V = 9;

// Shared with ScorecardDocument styles.coverCheckBox: same box in either mode.
export const CHECKING_BOX = 9;

// Lunch divider. Must read as one against the 0.5pt #bbb ordinary row rule.
export const CHECKING_BREAK_RULE = '1.5pt solid #444';
export const CHECKING_BREAK_RULE_W = 1.5;

// First-timer slip pitch. Fixed-height rows because @react-pdf inflates lineHeight by a
// constant factor. Sized so three large slips (4-5 events) still fit one page.
export const SLIP_FONT_SIZE = 10;
export const SLIP_LINE_H = 13;
export const SLIP_PAGE_PAD_TOP = 38;
export const SLIP_PAGE_PAD_BOTTOM = 36;
// One blank line beyond the base 18pt, so the cut point is unmistakable.
export const SLIP_MARGIN_BOTTOM = 18 + SLIP_LINE_H;
export const SLIP_INTRO_MARGIN_BOTTOM = 20;

// `hideWcaLiveId` only suppresses the line where there is no ID to print (liveId ''):
// blank, extra and custom-event cards. A competitor's card always keeps its ID.
export const showLiveIdLine = (hideWcaLiveId: boolean, liveId: string) =>
  !hideWcaLiveId || liveId !== '';

// The two live-results systems use unrelated competitor ids: wca-live needs a numeric
// competition id and person id off its GraphQL API, ilr builds the URL from ids already
// in hand. A missing wca-live id falls back to the home page, so the QR still scans.
export function liveQrTarget(
  cfg: {
    mode: LiveResultsMode;
    competitionId: string;
    wcaLiveId: string | null;
    wcaLivePersonIds: Record<number, string> | null;
  },
  entry: { registrantId: number; registrationId: number },
): { url: string; label: string } {
  if (cfg.mode === 'ilr') {
    return {
      url: `https://www.worldcubeassociation.org/competitions/${cfg.competitionId}/live/competitors/${entry.registrationId}`,
      label: 'worldcubeassociation.org',
    };
  }
  const personId = cfg.wcaLivePersonIds?.[entry.registrantId] ?? null;
  return {
    url: cfg.wcaLiveId && personId
      ? `https://live.worldcubeassociation.org/competitions/${cfg.wcaLiveId}/competitors/${personId}`
      : 'https://live.worldcubeassociation.org',
    label: 'live.worldcubeassociation.org',
  };
}
