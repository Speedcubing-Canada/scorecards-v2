import { describe, it, expect } from 'vitest';
import { getStrings } from '../lib/i18n';

// ── Layout geometry constraints ──────────────────────────────────────────────
// Dimensions measured from the original Sarah-scorecard LETTER PDF:
//   Cards: 257×345pt  |  margins ~22-24pt  |  gaps ~52-53pt
//   V gap ≈ 2× margin (not 3×) — Sarah's key constraint.
//   E1 row must nearly touch the card bottom (verified by: content fills ~335pt inner height).

const LETTER_W = 612;
const LETTER_H = 792;
const A4_W = 595;
const A4_H = 842;

const CONFIGS = {
  LETTER: {
    cardW: 257, cardH: 345,
    positions: [
      { left: 22,  top: 24  },
      { left: 332, top: 24  },
      { left: 22,  top: 421 },
      { left: 332, top: 421 },
    ],
  },
  A4: {
    cardW: 249, cardH: 373,
    positions: [
      { left: 22,  top: 22  },
      { left: 324, top: 22  },
      { left: 22,  top: 447 },
      { left: 324, top: 447 },
    ],
  },
} as const;

describe('Scorecard layout geometry', () => {
  for (const [fmt, page] of [['LETTER', { w: LETTER_W, h: LETTER_H }], ['A4', { w: A4_W, h: A4_H }]] as const) {
    const cfg = CONFIGS[fmt];
    const [p0, p1, p2, p3] = cfg.positions;
    const { cardW, cardH } = cfg;

    describe(fmt, () => {
      it('all four cards fit within the page', () => {
        for (const p of [p0, p1, p2, p3]) {
          expect(p.left).toBeGreaterThanOrEqual(0);
          expect(p.top).toBeGreaterThanOrEqual(0);
          expect(p.left + cardW).toBeLessThanOrEqual(page.w);
          expect(p.top  + cardH).toBeLessThanOrEqual(page.h);
        }
      });

      it('top-left and top-right cards share the same top edge', () => {
        expect(p0.top).toBe(p1.top);
      });

      it('bottom-left and bottom-right cards share the same top edge', () => {
        expect(p2.top).toBe(p3.top);
      });

      it('left cards share the same left edge', () => {
        expect(p0.left).toBe(p2.left);
      });

      it('right cards share the same left edge', () => {
        expect(p1.left).toBe(p3.left);
      });

      it('horizontal gap equals right-card left minus (left-card left + cardW)', () => {
        const hGap = p1.left - (p0.left + cardW);
        expect(hGap).toBeGreaterThan(0);
      });

      it('vertical gap is approximately 2× the top margin (not 3×+)', () => {
        const topMargin = p0.top;
        const vGap = p2.top - (p0.top + cardH);
        // The original PDF has vGap ≈ 2× margin. Allow a tolerance of ±15pt.
        expect(vGap).toBeLessThanOrEqual(topMargin * 2 + 15);
        expect(vGap).toBeGreaterThan(0);
      });

      it('LETTER card dimensions match original PDF measurements (257×345pt)', () => {
        if (fmt === 'LETTER') {
          expect(cardW).toBe(257);
          expect(cardH).toBe(345);
        }
      });
    });
  }
});

// ── Header text fit ──────────────────────────────────────────────────────────
// Standard Helvetica AFM glyph widths (1/1000 em units).
// Accented variants share the width of their base glyph.
const HW: Record<string, number> = {
  A:667,B:667,C:667,D:722,E:611,F:611,G:722,H:722,I:278,J:500,K:667,L:611,
  M:833,N:722,O:722,P:611,Q:722,R:667,S:556,T:611,U:722,V:667,W:944,X:667,
  Y:611,Z:611,
  a:556,b:556,c:500,d:556,e:556,f:278,g:556,h:556,i:222,j:222,k:500,l:222,
  m:833,n:556,o:556,p:556,q:556,r:333,s:500,t:278,u:556,v:500,w:722,x:500,
  y:500,z:500,
  // accented (same width as base)
  À:667,Â:667,Ä:667,È:611,É:611,Ê:611,Ë:611,Î:278,Ï:278,Ô:722,Ö:722,Ù:722,
  Û:722,Ü:722,Ç:667,Ñ:722,
  à:556,â:556,ä:556,è:556,é:556,ê:556,ë:556,î:222,ï:222,ô:556,ö:556,ù:556,
  û:556,ü:556,ç:500,ñ:556,
  ' ':278,'-':333,'_':556,':':278,'!':278,'?':556,' ':278,
};

function helveticaWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) w += ((HW[ch] ?? 556) / 1000) * fontSize;
  return w;
}

// Max text width across all newline-separated lines in a string
function maxLineWidth(text: string, fontSize: number): number {
  return Math.max(...text.split('\n').map(l => helveticaWidth(l, fontSize)));
}

// Layout constants (must stay in sync with ScorecardDocument.tsx)
const CARD_W        = 257;   // pt, from CONFIGS.LETTER
const CARD_BORDER   = 1.5;   // pt
const CARD_PAD_H    = 3;     // pt
const TABLE_BORDER  = 1;     // pt (borderLeft on table)
const CELL_BORDER   = 1;     // pt (borderRight on cell)
const HEADER_FONT   = 5.5;   // pt

const CARD_CONTENT_W  = CARD_W - 2 * CARD_BORDER - 2 * CARD_PAD_H;   // 248pt
const TABLE_CONTENT_W = CARD_CONTENT_W - TABLE_BORDER;                  // 247pt

const COL_FRAC = { scrambler: 0.13, attempt: 0.10, result: 0.52, judge: 0.12, competitor: 0.13 };

function colContentW(frac: number): number {
  return TABLE_CONTENT_W * frac - CELL_BORDER;
}

const LANGUAGES = ['en', 'fr', 'es', 'bilingual-fr', 'bilingual-en'] as const;

describe('Scorecard header labels fit within their columns', () => {
  for (const lang of LANGUAGES) {
    const s = getStrings(lang);
    describe(`language: ${lang}`, () => {
      it('competitor label fits', () => {
        expect(maxLineWidth(s.competitor, HEADER_FONT)).toBeLessThanOrEqual(colContentW(COL_FRAC.competitor));
      });
      it('scrambler label fits', () => {
        expect(maxLineWidth(s.scrambler, HEADER_FONT)).toBeLessThanOrEqual(colContentW(COL_FRAC.scrambler));
      });
      it('judge label fits', () => {
        expect(maxLineWidth(s.judge, HEADER_FONT)).toBeLessThanOrEqual(colContentW(COL_FRAC.judge));
      });
      it('attempt label fits', () => {
        expect(maxLineWidth(s.attempt, HEADER_FONT)).toBeLessThanOrEqual(colContentW(COL_FRAC.attempt));
      });
    });
  }
});
