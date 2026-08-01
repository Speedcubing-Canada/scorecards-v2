// Standalone Node.js script to render the first-timer slips PDF, mirroring
// FirstTimerSlipDocument.tsx. Run with: node generate-first-timer-slips.mjs
// Outputs: ../current-output/GrosJouetsaMontreal2026_first_timers.pdf
//
// The fixture below is the real newcomer list reconstructed from the original
// "Gros Jouets à Montréal – First-Timer Slips" PDF (names/DOB/country/events), so
// the output can be diffed against the original for layout fidelity. Birthdates
// are real here; from the live WCIF they appear only when DOB is exposed.

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';

const __dir = dirname(fileURLToPath(import.meta.url));
const e = React.createElement;

Font.registerHyphenationCallback((word) => [word]);

const FONT      = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';

// ── Newcomers (parsed shape: gender code, ISO birthdate, countryIso2, eventIds) ──
const ENTRIES = [
  { name: 'Alex Yang',          gender: 'm', birthdate: '2008-12-06', countryIso2: 'CA', eventIds: ['444','555','666','777'] },
  { name: 'Alexandre Fredette', gender: 'm', birthdate: '2015-01-13', countryIso2: 'CA', eventIds: ['444','minx'] },
  { name: 'Alexandre Mailloux', gender: 'm', birthdate: '2016-01-26', countryIso2: 'CA', eventIds: ['555','minx'] },
  { name: 'Ali Hakim',          gender: 'm', birthdate: '2016-01-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Brandon Morrissette',gender: 'm', birthdate: '2014-02-13', countryIso2: 'CA', eventIds: ['minx'] },
  { name: 'Lou Brunet',         gender: 'm', birthdate: '2017-01-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Paul Boutin',        gender: 'm', birthdate: '2015-04-29', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Raphaël Rishan',     gender: 'm', birthdate: '2016-06-04', countryIso2: 'CA', eventIds: ['444','minx'] },
  { name: 'Ryan Lee',           gender: 'm', birthdate: '2015-07-21', countryIso2: 'CA', eventIds: ['444'] },
  { name: 'Shawn Kang',         gender: 'm', birthdate: '2012-09-07', countryIso2: 'KR', eventIds: ['444'] },
  { name: 'Yuri Famelis',       gender: 'm', birthdate: '2015-07-02', countryIso2: 'CA', eventIds: ['444','minx'] },
];

// ── English strings + event names (mirror src/lib/i18n.ts) ──────────────────────
const S = {
  confirmIntro1: 'Please check off the boxes to confirm everything is correct.',
  confirmIntro2: 'If anything is incorrect, please let us know.',
  firstCompetition: 'This is my first WCA competition',
  preferredNamePrefix: 'My preferred name is',
  genderPrefix: 'My gender identity is',
  birthdatePrefix: 'My birthdate is',
  citizenshipPrefix: 'I hold citizenship in',
  parentalConsent: 'I have permission from a parent/guardian/caregiver to compete',
  solveSingle: (ev) => `I can solve the ${ev}`,
  solveMultipleIntro: 'I can solve all these puzzles/events:',
  genderMale: 'male', genderFemale: 'female', genderOther: 'non-binary or undisclosed',
};
const EVENT_NAMES = {
  '444': '4x4x4 Cube', '555': '5x5x5 Cube', '666': '6x6x6 Cube', '777': '7x7x7 Cube', 'minx': 'Megaminx',
};
const LANG = 'en';

// ── Styles (mirror FirstTimerSlipDocument.tsx) ──────────────────────────────────
const LINE_H = 13;
const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingLeft: 36, paddingRight: 36, paddingTop: 38, paddingBottom: 36,
    fontFamily: FONT, fontSize: 10, color: '#000000',
  },
  slip: { marginBottom: 31 },  // 18 + one line (13) - extra gap to mark the cut point
  intro: { marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', height: LINE_H },
  bold: { fontFamily: FONT_BOLD },
  checkbox: { width: 9, height: 9, border: '0.7pt solid #000000', marginLeft: 6 },
});

function TextRow({ children }) {
  return e(View, { style: styles.row }, e(Text, null, children));
}

function Item({ prefix, value }) {
  return e(View, { style: styles.row },
    e(Text, null, prefix, value ? e(Text, { style: styles.bold }, ` ${value}`) : null),
    e(View, { style: styles.checkbox }),
  );
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat(LANG, { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(`${iso}T00:00:00`));
}
function country(iso2) {
  return new Intl.DisplayNames([LANG], { type: 'region' }).of(iso2) ?? iso2;
}
function isMinor(iso) {
  const d = new Date(`${iso}T00:00:00`), now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a < 18;
}
function genderWord(g) { return g === 'm' ? S.genderMale : g === 'f' ? S.genderFemale : S.genderOther; }

function Slip({ entry }) {
  const names = entry.eventIds.map((id) => EVENT_NAMES[id] ?? id);
  const minor = entry.birthdate ? isMinor(entry.birthdate) : false;
  return e(View, { style: styles.slip, wrap: false },
    e(View, { style: styles.intro },
      e(TextRow, null, S.confirmIntro1),
      e(TextRow, null, S.confirmIntro2),
    ),
    e(Item, { prefix: S.firstCompetition }),
    e(Item, { prefix: S.preferredNamePrefix, value: entry.name }),
    e(Item, { prefix: S.genderPrefix, value: genderWord(entry.gender) }),
    entry.birthdate ? e(Item, { prefix: S.birthdatePrefix, value: fmtDate(entry.birthdate) }) : null,
    e(Item, { prefix: S.citizenshipPrefix, value: country(entry.countryIso2) }),
    minor ? e(Item, { prefix: S.parentalConsent }) : null,
    names.length === 1
      ? e(Item, { prefix: S.solveSingle(names[0]) })
      : e(React.Fragment, null,
          e(TextRow, null, S.solveMultipleIntro),
          ...names.map((n, i) => e(Item, { key: i, prefix: `• ${n}` })),
        ),
  );
}

const doc = e(Document, { title: 'Gros Jouets à Montréal 2026 - First-Timer Slips', author: 'WCA Scorecard Generator' },
  e(Page, { size: 'LETTER', style: styles.page },
    ...ENTRIES.map((entry, i) => e(Slip, { key: i, entry })),
  ),
);

const outPath = resolve(__dir, '../current-output/GrosJouetsaMontreal2026_first_timers.pdf');
console.log(`Rendering ${ENTRIES.length} first-timer slips…`);
writeFileSync(outPath, await renderToBuffer(doc));
console.log(`Saved → ${outPath}`);
