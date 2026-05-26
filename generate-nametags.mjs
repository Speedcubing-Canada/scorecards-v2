// Standalone Node.js script to render nametag PDF using the same logic as NametTagDocument.tsx
// Run with: node generate-nametags.mjs
// Outputs: ../current-output/GrosJouetsaMontreal2026_nametags.pdf

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { Document, Page, View, Text, Image, Font, Svg, Rect, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Event icons ───────────────────────────────────────────────────────────────
function iconB64(name) {
  const p = resolve(__dir, 'src/assets/events', `${name}.png`);
  return 'data:image/png;base64,' + readFileSync(p).toString('base64');
}

const EVENT_ICONS = {
  '222': iconB64('222'), '333': iconB64('333'), '444': iconB64('444'),
  '555': iconB64('555'), '666': iconB64('666'), '777': iconB64('777'),
  '333bf': iconB64('333bf'), '333fm': iconB64('333fm'), '333oh': iconB64('333oh'),
  'clock': iconB64('clock'), 'minx': iconB64('minx'), 'pyram': iconB64('pyram'),
  'skewb': iconB64('skewb'), 'sq1': iconB64('sq1'), '444bf': iconB64('444bf'),
  '555bf': iconB64('555bf'), '333mbf': iconB64('333mbf'),
};

// ── Load GJ 2026 nametags data ─────────────────────────────────────────────
// Build path via readdir to avoid WSL/NTFS Unicode path resolution issues
const exampleDir = resolve(__dir, '../example-comp');
const { readdirSync } = await import('fs');
const outerDir = readdirSync(exampleDir).find(n => n.includes('Nametags') && !n.startsWith('_'));
const innerDir = readdirSync(resolve(exampleDir, outerDir)).find(n => n.includes('Nametags') && !n.startsWith('_'));
const rawPath = resolve(exampleDir, outerDir, innerDir, 'gj_2026_nametags.js');
const raw = readFileSync(rawPath, 'utf-8');

// Execute the JS to populate a window-like object
const fakeWindow = {};
const fn = new Function('window', raw);
fn(fakeWindow);

const competitionId = fakeWindow.competitionId;   // "GrosJouetsaMontreal2026"
const competitionName = fakeWindow.competitionName; // "Gros Jouets à Montréal 2026"
const wcaLiveId = fakeWindow.wcaLive;              // "9667"

// Convert legacy competitor objects to NametTagEntry shape.
// live_id = sequential person ID used by competitiongroups.com (registrantId)
// competitor_id = WCA user account ID used by WCA Live (wcaUserId)
const nametags = fakeWindow.competitors.map(c => ({
  name: c.name,
  wcaId: c.wca_id || '',
  registrantId: parseInt(c.live_id, 10),
  wcaUserId: parseInt(c.competitor_id, 10),
  gender: c.gender,
  titleEn: c.title_en,
  titleFr: c.title_fr,
  events: c.events,
  // Keep 'Aucun' in arrays (don't filter); sort alphabetically
  compete: (c.groups ?? []).sort(),
  scramble: (c.scramble ?? []).sort(),
  judge: (c.judge ?? []).sort(),
  run: (c.run ?? []).sort(),
}));

// ── Page geometry ──────────────────────────────────────────────────────────
const CONFIGS = {
  LETTER: { panelW: 189, panelH: 292, margin: 12, gapH: 4, gapV: 4 },
  A4:     { panelW: 201, panelH: 283, margin: 12, gapH: 4, gapV: 4 },
};

function panelPositions(cfg) {
  const { panelW, panelH, margin, gapH, gapV } = cfg;
  const pos = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++)
      pos.push({ left: margin + col * (panelW + gapH), top: margin + row * (panelH + gapV) });
  return pos;
}

// ── QR code ────────────────────────────────────────────────────────────────
Font.registerHyphenationCallback(word => [word]);

const FONT      = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const NBSP = '\xa0';

function QrSvg({ url, size }) {
  const qr   = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n    = qr.modules.size;
  const data = qr.modules.data;

  const bars = [];
  for (let row = 0; row < n; row++) {
    let start = -1;
    for (let col = 0; col <= n; col++) {
      const dark = col < n && data[row * n + col] !== 0;
      if (dark && start === -1) start = col;
      else if (!dark && start !== -1) { bars.push({ x: start, y: row, w: col - start }); start = -1; }
    }
  }

  return React.createElement(
    Svg, { width: size, height: size, viewBox: `0 0 ${n} ${n}` },
    ...bars.map((b, i) => React.createElement(Rect, { key: i, x: b.x, y: b.y, width: b.w, height: 1, fill: 'black' })),
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function nameFontSize(name, panelW) {
  const avail = panelW - 14;
  return Math.min(20, Math.max(9, Math.floor(avail / Math.max(name.length * 0.55, 1))));
}

function badgeColors(titleEn) {
  if (titleEn === 'DELEGATE' || titleEn === 'ORGANIZER') return { bg: '#343434', fg: 'white' };
  if (titleEn === 'NEW COMPETITOR') return { bg: '#A9A9A9', fg: 'black' };
  return { bg: '#DCDCDC', fg: 'black' };
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  panel: {
    border: '1.5pt solid black', borderRadius: 6,
    paddingHorizontal: 7, paddingTop: 7, paddingBottom: 6,
    fontFamily: FONT, overflow: 'hidden', backgroundColor: '#ffffff',
    flexDirection: 'column',
  },
  compName:   { fontSize: 8.5, textAlign: 'center', color: '#333', marginBottom: 4, fontFamily: FONT },
  name:       { textAlign: 'center', fontFamily: FONT, marginBottom: 6 },
  badge:      { borderRadius: 2, paddingVertical: 5, marginBottom: 8 },
  badgeText:  { fontSize: 13, textAlign: 'center', fontFamily: FONT_BOLD },
  iconsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 7 },
  wcaId:      { fontSize: 13, textAlign: 'center', marginBottom: 10, color: '#222', fontFamily: FONT },
  dutiesSection: { flexDirection: 'column', flex: 1 },
  dutyRow:    { flexDirection: 'row', alignItems: 'flex-start' },
  dutyLabel:  { fontFamily: FONT_BOLD, width: 46, flexShrink: 0 },
  qrSection:  { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  qrCol:      { flexDirection: 'column', alignItems: 'center' },
  qrLabel:    { fontSize: 6, textAlign: 'center', color: '#444', marginTop: 4, maxWidth: 80 },
};

const e = React.createElement;

function DutyLines({ duties, fontSize }) {
  const sorted = [...duties].sort();
  return e(View, { style: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 2 } },
    ...sorted.map((duty, i) => {
      const sep = duty.indexOf(': ');
      if (sep === -1) return e(Text, { key: i, style: { fontSize } }, duty);
      const event = duty.slice(0, sep).replace(/ /g, NBSP);
      const group = duty.slice(sep + 2).replace(/ /g, NBSP);
      return e(Text, { key: i, style: { fontSize } },
        e(Text, { style: { fontFamily: FONT } }, event + NBSP),
        e(Text, { style: { fontFamily: FONT_BOLD } }, group),
      );
    }),
  );
}

function PanelTop({ entry, panelW, compName, titleText }) {
  const { bg, fg } = badgeColors(entry.titleEn);
  const nameFs = nameFontSize(entry.name, panelW);
  const iconSz = 12;
  return e(View, null,
    e(Text, { style: s.compName }, compName),
    e(Text, { style: { ...s.name, fontSize: nameFs } }, entry.name),
    e(View, { style: { ...s.badge, backgroundColor: bg } },
      e(Text, { style: { ...s.badgeText, color: fg } }, titleText),
    ),
    e(View, { style: s.iconsRow },
      ...entry.events.map(evId =>
        EVENT_ICONS[evId]
          ? e(Image, { key: evId, src: EVENT_ICONS[evId], style: { width: iconSz, height: iconSz, marginHorizontal: 1.5 } })
          : null,
      ).filter(Boolean),
    ),
    e(Text, { style: s.wcaId }, entry.wcaId || ' '),
  );
}

function QrSection({ entry, competitionId: compId, wcaLiveId: liveId, qrSize = 75 }) {
  const cgUrl   = `https://www.competitiongroups.com/competitions/${compId}/persons/${entry.registrantId}`;
  const liveUrl = liveId
    ? `https://live.worldcubeassociation.org/competitions/${liveId}/competitors/${entry.wcaUserId}`
    : 'https://live.worldcubeassociation.org';

  return e(View, { style: s.qrSection },
    e(View, { style: s.qrCol },
      e(QrSvg, { url: cgUrl, size: qrSize }),
      e(Text, { style: s.qrLabel }, 'competitiongroups.com'),
    ),
    e(View, { style: s.qrCol },
      e(QrSvg, { url: liveUrl, size: qrSize }),
      e(Text, { style: s.qrLabel }, 'live.worldcubeassociation.org'),
    ),
  );
}

// topH: empirical top-section height for space-evenly estimation.
function topSectionH(logoMode) { return logoMode === 'logo-only' ? 146 : 127; }

function FrontPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, qrBothSides, qrSize = 75 }) {
  const panelStyle = { ...s.panel, position: 'absolute', left: pos.left, top: pos.top, width: panelW, height: panelH };

  if (qrBothSides) {
    return e(View, { style: panelStyle },
      e(PanelTop, { entry, panelW, compName, titleText: entry.titleFr }),
      e(QrSection, { entry, competitionId, wcaLiveId, qrSize }),
    );
  }

  const rows = [
    { label: 'Concourir:', duties: entry.compete  },
    { label: 'Mélanger:',  duties: entry.scramble },
    { label: 'Juger:',     duties: entry.judge    },
    { label: 'Courir:',    duties: entry.run      },
  ].filter(r => r.duties.length > 0);

  const totalItems = rows.reduce((sum, r) => sum + r.duties.length, 0);
  const dutyFs = Math.max(5, Math.min(7.5, 7.5 - Math.max(0, totalItems - 8) * 0.12));
  const lineH = dutyFs * 1.4;
  const estLines = rows.reduce((sum, r) => sum + Math.ceil(r.duties.length / 2), 0);
  const estH = (estLines + rows.length) * lineH;
  const spaceEvenly = estH < (panelH - topSectionH('hidden')) * 0.65;

  return e(View, { style: panelStyle },
    e(PanelTop, { entry, panelW, compName, titleText: entry.titleFr }),
    e(View, { style: { ...s.dutiesSection, ...(spaceEvenly ? { justifyContent: 'space-evenly' } : {}) } },
      ...rows.map(({ label, duties }) =>
        e(View, { key: label, style: { ...s.dutyRow, ...(spaceEvenly ? {} : { marginBottom: 3 }) } },
          e(Text, { style: { ...s.dutyLabel, fontSize: dutyFs } }, label),
          e(DutyLines, { duties, fontSize: dutyFs }),
        ),
      ),
    ),
  );
}

function BackPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, qrSize = 75 }) {
  return e(View, { style: { ...s.panel, position: 'absolute', left: pos.left, top: pos.top, width: panelW, height: panelH } },
    e(PanelTop, { entry, panelW, compName, titleText: entry.titleEn }),
    e(QrSection, { entry, competitionId, wcaLiveId, qrSize }),
  );
}

function NametTagDocument({ nametags: tags, compName, compId, liveId, paperFormat, qrBothSides = false }) {
  const cfg = CONFIGS[paperFormat] ?? CONFIGS.LETTER;
  const pos = panelPositions(cfg);

  const pages = [];
  for (let i = 0; i < tags.length; i += 4) pages.push(tags.slice(i, i + 4));

  return e(Document, { title: `${compName} — Name Tags`, author: 'WCA Scorecard Generator' },
    ...pages.map((page, pi) =>
      e(Page, { key: pi, size: paperFormat, orientation: 'landscape', style: { backgroundColor: '#ffffff' } },
        ...page.flatMap((entry, ei) => {
          const frontPos = pos[ei * 2];
          const backPos  = pos[ei * 2 + 1];
          if (!frontPos || !backPos) return [];
          return [
            e(FrontPanel, { key: `f${ei}`, entry, panelW: cfg.panelW, panelH: cfg.panelH, pos: frontPos, compName,
                            competitionId: compId, wcaLiveId: liveId, qrBothSides }),
            e(BackPanel,  { key: `b${ei}`, entry, panelW: cfg.panelW, panelH: cfg.panelH, pos: backPos, compName,
                            competitionId: compId, wcaLiveId: liveId }),
          ];
        }),
      ),
    ),
  );
}

// ── Render ─────────────────────────────────────────────────────────────────
const outPath = resolve(__dir, '../current-output/GrosJouetsaMontreal2026_nametags.pdf');

console.log(`Rendering ${nametags.length} nametags…`);
const element = e(NametTagDocument, {
  nametags,
  compName: competitionName,
  compId: competitionId,
  liveId: wcaLiveId,
  paperFormat: 'LETTER',
  qrBothSides: false,
});

const buffer = await renderToBuffer(element);
writeFileSync(outPath, buffer);
console.log(`Saved → ${outPath}`);
