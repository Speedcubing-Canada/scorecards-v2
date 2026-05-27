import { writeFileSync } from 'fs';
import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';

Font.registerHyphenationCallback((word) => [word]);

const CONFIGS = { LETTER: { cardW: 257, cardH: 345, positions: [{ left: 22, top: 24 }, { left: 332, top: 24 }, { left: 22, top: 421 }, { left: 332, top: 421 }] } };
const BORDER = '1.5pt solid black', BORDER_THIN = '1pt solid black';
const FONT = 'Helvetica', FONT_BOLD = 'Helvetica-Bold';
const COL = { scrambler: '13%', attempt: '10%', result: '52%', judge: '12%', competitor: '13%' };

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff' },
  card: { border: BORDER, borderRadius: 7.5, paddingTop: 5, paddingBottom: 5, paddingHorizontal: 3, fontFamily: FONT, overflow: 'hidden' },
  header: { flexDirection: 'row', height: 56 },
  compNameCell: { width: 26, justifyContent: 'center', alignItems: 'center' },
  compNameText: { fontSize: 8, textAlign: 'center', color: '#111' },
  nameCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  nameText: { fontFamily: FONT_BOLD, textAlign: 'center' },
  idText: { fontSize: 7.5, textAlign: 'center', marginTop: 2, color: '#222' },
  eventRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 4, marginBottom: 6 },
  eventCell: { flex: 2, fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },
  roundCell: { flex: 1.5, fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },
  groupCell: { flex: 1.5, fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },
  table: { borderTop: BORDER_THIN, borderLeft: BORDER_THIN },
  headerRow: { flexDirection: 'row', backgroundColor: '#f8f8f8' },
  attemptRow: { flexDirection: 'row' },
  cellBase: { borderRight: BORDER_THIN, borderBottom: BORDER_THIN, justifyContent: 'center', alignItems: 'center' },
  headerText: { fontSize: 5.5, textAlign: 'center', paddingVertical: 2 },
  attemptNumText: { fontSize: 12, textAlign: 'center', fontFamily: FONT_BOLD },
  cutoffLine: { fontSize: 7, textAlign: 'center', marginVertical: 2, color: '#333' },
  provisionalLine: { fontSize: 7, textAlign: 'center', marginTop: 2, color: '#333' },
});

const e = React.createElement;

function AttemptRow({ num, rowH }) {
  return e(View, { style: [styles.attemptRow, { height: rowH }] },
    e(View, { style: [styles.cellBase, { width: COL.scrambler }] }),
    e(View, { style: [styles.cellBase, { width: COL.attempt }] }, num !== '' ? e(Text, { style: styles.attemptNumText }, String(num)) : null),
    e(View, { style: [styles.cellBase, { width: COL.result }] }),
    e(View, { style: [styles.cellBase, { width: COL.judge }] }),
    e(View, { style: [styles.cellBase, { width: COL.competitor }] }),
  );
}

const PROV = '─── Extra or Provisional Solve / Essai extra ou provisoire ─── (Delegate Initials / Initiales du Délégué _______)';

function Card({ label, rowH, preRows, postRows, hasCutoff, pos, cardW, cardH }) {
  return e(View, { style: [styles.card, { position: 'absolute', left: pos.left, top: pos.top, width: cardW, height: cardH }] },
    e(View, { style: styles.header },
      e(View, { style: styles.compNameCell }, e(Text, { style: styles.compNameText }, 'Test')),
      e(View, { style: styles.nameCell },
        e(Text, { style: [styles.nameText, { fontSize: 13 }] }, `Test (${label})`),
        e(Text, { style: styles.idText }, '2024TST01  WCA Live: 99'),
      ),
    ),
    e(View, { style: styles.eventRow },
      e(Text, { style: styles.eventCell }, '3x3x3 Cube'),
      e(Text, { style: styles.roundCell }, 'Round 1 of 2'),
      e(Text, { style: styles.groupCell }, 'Group 1 of 4'),
    ),
    e(View, { style: styles.table },
      e(View, { style: styles.headerRow }, ...Object.entries(COL).map(([col, w]) => {
        const labels = { scrambler: 'Mélangeur\nScrambler', attempt: 'Essai\nAttempt', result: 'Résultat (DNF si n\'est pas inférieur à ...)\nResult (DNF if not under ...)', judge: 'Juge\nJudge', competitor: 'Compétiteur\nCompetitor' };
        return e(View, { key: col, style: [styles.cellBase, { width: w }] }, e(Text, { style: styles.headerText }, labels[col]));
      })),
      ...preRows.map(n => e(AttemptRow, { key: n, num: n, rowH })),
    ),
    hasCutoff ? e(Text, { style: styles.cutoffLine }, '─── Continue if Attempt 1 or 2 is below 1:00 ───') : null,
    postRows.length > 0 ? e(View, { style: styles.table }, ...postRows.map(n => e(AttemptRow, { key: n, num: n, rowH }))) : null,
    e(View, { style: { flex: 1 } }),
    e(Text, { style: styles.provisionalLine }, PROV),
    e(View, { style: { flex: 1 } }),
    e(View, { style: styles.table }, e(AttemptRow, { num: '', rowH })),
  );
}

const tests = [
  { label: 'avg5 (34)',     rowH: 34, preRows: [1,2,3,4,5], postRows: [],     hasCutoff: false },
  { label: 'bo2-avg5 (31)', rowH: 31, preRows: [1,2],       postRows: [3,4,5], hasCutoff: true  },
  { label: 'mo3 (51)',      rowH: 51, preRows: [1,2,3],     postRows: [],     hasCutoff: false },
  { label: 'bo1-mo3 (49)',  rowH: 49, preRows: [1],         postRows: [2,3],  hasCutoff: true  },
];

const cfg = CONFIGS.LETTER;
const doc = e(Document, { title: 'Test' },
  e(Page, { size: 'LETTER', style: styles.page },
    ...tests.map((t, i) => e(Card, { key: i, ...t, pos: cfg.positions[i], cardW: cfg.cardW, cardH: cfg.cardH })),
  ),
);

writeFileSync('/tmp/scorecard-layout-test.pdf', await renderToBuffer(doc));
console.log('Saved → /tmp/scorecard-layout-test.pdf');
