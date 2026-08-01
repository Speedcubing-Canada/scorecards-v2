import { describe, it, expect } from 'vitest';
import { CHECKING_FLEX, CHECKING_CELL_PAD_V } from './layoutConstants';
import { getCheckingSheetStrings, type CheckingSheetStrings } from '../lib/i18n';
import type { LocaleCode, PaperFormat } from '../types/settings';

// ── Header text fit ──────────────────────────────────────────────────────────
// Standard Helvetica AFM glyph widths (1/1000 em units), same table as
// scorecard-layout.test.ts. Accented variants share the width of their base glyph.
const HW: Record<string, number> = {
  A:667,B:667,C:667,D:722,E:611,F:611,G:722,H:722,I:278,J:500,K:667,L:611,
  M:833,N:722,O:722,P:611,Q:722,R:667,S:556,T:611,U:722,V:667,W:944,X:667,
  Y:611,Z:611,
  a:556,b:556,c:500,d:556,e:556,f:278,g:556,h:556,i:222,j:222,k:500,l:222,
  m:833,n:556,o:556,p:556,q:556,r:333,s:500,t:278,u:556,v:500,w:722,x:500,
  y:500,z:500,
  À:667,Â:667,Ä:667,È:611,É:611,Ê:611,Ë:611,Î:278,Ï:278,Ô:722,Ö:722,Ù:722,
  Û:722,Ü:722,Ç:667,Ñ:722,
  à:556,â:556,ä:556,è:556,é:556,ê:556,ë:556,î:222,ï:222,ô:556,ö:556,ù:556,
  û:556,ü:556,ç:500,ñ:556,
  ' ':278,'-':333,'_':556,':':278,'.':278,'(':333,')':333,
};

// Headers render in Helvetica-BOLD, whose glyphs run a few percent wider than the
// regular widths tabulated above. The factor keeps the estimate on the safe side.
const BOLD_FACTOR = 1.08;

function helveticaBoldWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += ((HW[ch] ?? 556) / 1000) * fontSize * BOLD_FACTOR;
  return w;
}

// Headers embed '\n'; each line must fit on its own.
function maxLineWidth(text: string, fontSize: number): number {
  return Math.max(...text.split('\n').map(l => helveticaBoldWidth(l, fontSize)));
}

// ── Layout constants (must stay in sync with CheckingSheetDocument.tsx) ──────
const PAGE_W: Record<PaperFormat, number> = { LETTER: 612, A4: 595.28 };
const PAGE_H: Record<PaperFormat, number> = { LETTER: 792, A4: 842 };
const PAGE_PAD_H  = 30;    // styles.page paddingHorizontal
const PAGE_PAD_V  = 36;    // styles.page paddingVertical
const TABLE_BORDER = 0.75; // styles.table border, both sides
const CELL_PAD_H   = 4;    // cellStyle paddingHorizontal, both sides
const CELL_BORDER  = 0.5;  // cellStyle borderRight (BORDER_INNER)
const HEADER_FONT  = 8;    // styles.headerText fontSize
const CELL_FONT    = 10;   // styles.cellText fontSize
const CHECKBOX_W   = 9;    // styles.checkBox width
const CHECKBOX_ML  = 6;    // styles.checkBox marginLeft
const TITLE_BLOCK  = 18 + 22;  // styles.title fontSize + marginBottom
const DAY_LABEL_H  = 13 + 6;   // styles.dayLabel fontSize + marginBottom
const STAGE_NAME_H = 11 + 4;   // styles.stageName fontSize + marginBottom
const STAGE_GAP    = 14;       // styles.stageBlock marginBottom

const TOTAL_FLEX = Object.values(CHECKING_FLEX).reduce((a, b) => a + b, 0);

function tableContentW(format: PaperFormat): number {
  return PAGE_W[format] - 2 * PAGE_PAD_H - 2 * TABLE_BORDER;
}

// Usable text width inside one column, after cell padding and the divider.
function colContentW(flex: number, format: PaperFormat): number {
  return tableContentW(format) * (flex / TOTAL_FLEX) - 2 * CELL_PAD_H - CELL_BORDER;
}

const LOCALES: LocaleCode[] = ['en', 'fr', 'es', 'pt'];
const FORMATS: PaperFormat[] = ['LETTER', 'A4'];

const COLUMNS: { key: keyof typeof CHECKING_FLEX; pick: (s: CheckingSheetStrings) => string }[] = [
  { key: 'start',       pick: (s) => s.start },
  { key: 'event',       pick: (s) => s.event },
  { key: 'groups',      pick: (s) => s.groupsDone },
  { key: 'scorecards',  pick: (s) => s.scorecards },
  { key: 'dataEntry',   pick: (s) => s.dataEntry },
  { key: 'doubleCheck', pick: (s) => s.doubleCheck },
  { key: 'takenBy',     pick: (s) => s.takenBy },
];

describe('Checking sheet column widths', () => {
  it('declares a flex for every rendered column', () => {
    expect(Object.keys(CHECKING_FLEX).sort()).toEqual(COLUMNS.map(c => c.key).sort());
  });

  it('gives the event column the most room (it holds the longest content)', () => {
    for (const key of Object.keys(CHECKING_FLEX) as (keyof typeof CHECKING_FLEX)[]) {
      if (key === 'event') continue;
      expect(CHECKING_FLEX.event).toBeGreaterThan(CHECKING_FLEX[key]);
    }
  });

  it('gives "taken by" more room than the initials columns - it holds a name', () => {
    expect(CHECKING_FLEX.takenBy).toBeGreaterThan(CHECKING_FLEX.dataEntry);
    expect(CHECKING_FLEX.takenBy).toBeGreaterThan(CHECKING_FLEX.doubleCheck);
  });

  it('gives the double-check column more room than data entry (longer header)', () => {
    expect(CHECKING_FLEX.doubleCheck).toBeGreaterThan(CHECKING_FLEX.dataEntry);
  });
});

describe('Checking sheet header labels fit within their columns', () => {
  for (const format of FORMATS) {
    for (const lc of LOCALES) {
      const strings = getCheckingSheetStrings(lc);
      describe(`${format} / ${lc}`, () => {
        for (const col of COLUMNS) {
          it(`${col.key} header fits`, () => {
            expect(maxLineWidth(col.pick(strings), HEADER_FONT))
              .toBeLessThanOrEqual(colContentW(CHECKING_FLEX[col.key], format));
          });
        }
      });
    }
  }
});

describe('Checking sheet groups cell', () => {
  // The cell holds "<count><gap><box>" on one line; a 3-digit count is far beyond
  // any real competition, so it is a safe upper bound.
  const widest = helveticaBoldWidth('999', CELL_FONT) + CHECKBOX_ML + CHECKBOX_W;

  for (const format of FORMATS) {
    it(`count + checkbox fit on one line (${format})`, () => {
      expect(widest).toBeLessThanOrEqual(colContentW(CHECKING_FLEX.groups, format));
    });
  }

  it('keeps the checkbox the same size as the cover card checkbox', () => {
    // ScorecardDocument styles.coverCheckBox is 9×9 at 0.75pt - the two documents
    // must agree so a delegate sees the same tick box in either mode.
    expect(CHECKBOX_W).toBe(9);
  });
});

describe('Checking sheet vertical budget', () => {
  const rowH = (n: number) => n * (CELL_FONT + 2 * CHECKING_CELL_PAD_V);

  it('leaves room to hand-write initials (taller rows than the schedule tracker)', () => {
    // ScheduleTrackerDocument uses paddingVertical 6; the checking sheet must exceed it.
    expect(CHECKING_CELL_PAD_V).toBeGreaterThan(6);
  });

  for (const format of FORMATS) {
    it(`fits a typical single-stage day of 12 rounds on the first page (${format})`, () => {
      const contentH = PAGE_H[format] - 2 * PAGE_PAD_V;
      const headerH = CELL_FONT + 2 * 6 + 8;  // header row: 6pt padding + two 8pt lines
      const used = TITLE_BLOCK + DAY_LABEL_H + headerH + rowH(12) + STAGE_GAP;
      expect(used).toBeLessThanOrEqual(contentH);
    });

    it(`a two-stage day block still fits on one page (${format})`, () => {
      // Each (day × stage) block is wrap={false}, so a single block must never
      // exceed the page height or @react-pdf drops it.
      const contentH = PAGE_H[format] - 2 * PAGE_PAD_V;
      const headerH = CELL_FONT + 2 * 6 + 8;
      const block = DAY_LABEL_H + STAGE_NAME_H + headerH + rowH(10) + STAGE_GAP;
      expect(block).toBeLessThanOrEqual(contentH);
    });
  }
});
