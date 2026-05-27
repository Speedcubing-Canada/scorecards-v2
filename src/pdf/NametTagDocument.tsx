import { Document, Page, View, Text, Image, StyleSheet, Font, Svg, Rect } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { CompetitionSettings, NametTagLogoMode } from '../types/settings';
import type { NametTagEntry } from '../lib/wcif-parser';
import { EVENT_ICONS } from '../assets/events';
import { getNametTagStrings, type NametTagStrings } from '../lib/i18n';

Font.registerHyphenationCallback((word) => [word]);

// ── Page geometry ─────────────────────────────────────────────────────────────
// Landscape pages: 4 panels wide × 2 panels tall = 8 panels = 4 nametag pairs.
// Layout per page (persons A, B, C, D):
//   row 0: [Front_A] [Back_A] [Front_B] [Back_B]
//   row 1: [Front_C] [Back_C] [Front_D] [Back_D]
// When cut and folded front-to-back, each pair becomes one nametag.

const CONFIGS = {
  LETTER: { panelW: 189, panelH: 292, margin: 12, gapH: 4, gapV: 4 },
  A4:     { panelW: 201, panelH: 283, margin: 12, gapH: 4, gapV: 4 },
} as const;

type PF = keyof typeof CONFIGS;

function panelPositions(cfg: (typeof CONFIGS)[PF]) {
  const { panelW, panelH, margin, gapH, gapV } = cfg;
  const pos: { left: number; top: number }[] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++)
      pos.push({ left: margin + col * (panelW + gapH), top: margin + row * (panelH + gapV) });
  return pos;
}

// ── QR code (react-pdf native SVG) ────────────────────────────────────────────
function QrSvg({ url, size }: { url: string; size: number }) {
  const qr   = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const n    = qr.modules.size;
  const data = qr.modules.data as unknown as Uint8Array;

  const bars: { x: number; y: number; w: number }[] = [];
  for (let row = 0; row < n; row++) {
    let start = -1;
    for (let col = 0; col <= n; col++) {
      const dark = col < n && data[row * n + col] !== 0;
      if (dark && start === -1) start = col;
      else if (!dark && start !== -1) { bars.push({ x: start, y: row, w: col - start }); start = -1; }
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      {bars.map((b, i) => <Rect key={i} x={b.x} y={b.y} width={b.w} height={1} fill="black" />)}
    </Svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const FONT      = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const NBSP = ' ';

function nameFontSize(name: string, panelW: number) {
  const avail = panelW - 14;
  return Math.min(20, Math.max(9, Math.floor(avail / Math.max(name.length * 0.55, 1))));
}

function badgeColors(titleEn: string) {
  if (titleEn === 'DELEGATE' || titleEn === 'ORGANIZER')
    return { bg: '#343434', fg: 'white' };
  if (titleEn === 'NEW COMPETITOR')
    return { bg: '#A9A9A9', fg: 'black' };
  return { bg: '#DCDCDC', fg: 'black' };
}

// ── Duty lines — flex-wrap row, each item is its own Text so no dash artifacts ─
function DutyLines({ duties, fontSize }: { duties: string[]; fontSize: number }) {
  const sorted = [...duties].sort();
  return (
    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
      {sorted.map((duty, i) => {
        const sep = duty.indexOf(': ');
        if (sep === -1) return <Text key={i} style={{ fontSize }}>{duty}</Text>;
        const event = duty.slice(0, sep).replace(/ /g, NBSP);
        const group = duty.slice(sep + 2).replace(/ /g, NBSP);
        return (
          <Text key={i} style={{ fontSize }}>
            <Text style={{ fontFamily: FONT }}>{event + NBSP}</Text>
            <Text style={{ fontFamily: FONT_BOLD }}>{group}</Text>
          </Text>
        );
      })}
    </View>
  );
}

// ── Shared top section ────────────────────────────────────────────────────────
// logoMode:
//   'hidden'    → comp name text only
//   'with-name' → small logo + comp name text side-by-side
//   'logo-only' → large logo centred, no comp name text
function PanelTop({ entry, panelW, compName, titleText, logoMode, logoDataUrl }: {
  entry: NametTagEntry; panelW: number; compName: string; titleText: string;
  logoMode: NametTagLogoMode; logoDataUrl: string | null;
}) {
  const { bg, fg } = badgeColors(entry.titleEn);
  const nameFs = nameFontSize(entry.name, panelW);
  const iconSz = 12;

  return (
    <View>
      {logoMode === 'logo-only' && logoDataUrl ? (
        <Image src={logoDataUrl} style={s.logoLarge} />
      ) : logoMode === 'with-name' && logoDataUrl ? (
        <View style={s.logoHeaderRow}>
          <Image src={logoDataUrl} style={s.logoSmall} />
          <Text style={s.compName}>{compName}</Text>
        </View>
      ) : (
        <Text style={s.compName}>{compName}</Text>
      )}
      <Text style={[s.name, { fontSize: nameFs }]}>{entry.name}</Text>
      <View style={[s.badge, { backgroundColor: bg }]}>
        <Text style={[s.badgeText, { color: fg }]}>{titleText}</Text>
      </View>
      <View style={s.iconsRow}>
        {entry.events.map(evId =>
          EVENT_ICONS[evId]
            ? <Image key={evId} src={EVENT_ICONS[evId]} style={{ width: iconSz, height: iconSz, marginHorizontal: 1.5 }} />
            : null
        )}
      </View>
      <Text style={s.wcaId}>{entry.wcaId || ' '}</Text>
    </View>
  );
}

// ── QR code section ───────────────────────────────────────────────────────────
function QrSection({ entry, competitionId, wcaLiveId, wcaLivePersonIds, qrSize }: {
  entry: NametTagEntry; competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null; qrSize: number;
}) {
  const cgUrl = `https://www.competitiongroups.com/competitions/${competitionId}/persons/${entry.registrantId}`;
  const wcaLivePersonId = wcaLivePersonIds?.[entry.registrantId] ?? null;
  const liveUrl = (wcaLiveId && wcaLivePersonId)
    ? `https://live.worldcubeassociation.org/competitions/${wcaLiveId}/competitors/${wcaLivePersonId}`
    : 'https://live.worldcubeassociation.org';

  return (
    <View style={s.qrSection}>
      <View style={s.qrCol}>
        <QrSvg url={cgUrl} size={qrSize} />
        <Text style={s.qrLabel}>competitiongroups.com</Text>
      </View>
      <View style={s.qrCol}>
        <QrSvg url={liveUrl} size={qrSize} />
        <Text style={s.qrLabel}>live.worldcubeassociation.org</Text>
      </View>
    </View>
  );
}

// ── Empirical top-section height used for duty font-size estimation ────────────
// 'logo-only' makes the header row taller (~28pt logo vs ~8.5pt text), adding ~19pt.
function topSectionH(logoMode: NametTagLogoMode) {
  return logoMode === 'logo-only' ? 146 : 127;
}

// ── Front panel ───────────────────────────────────────────────────────────────
function FrontPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, wcaLivePersonIds, logoMode, logoDataUrl, qrBothSides, qrSize, nametTagStrings }: {
  entry: NametTagEntry; panelW: number; panelH: number;
  pos: { left: number; top: number }; compName: string;
  competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  logoMode: NametTagLogoMode; logoDataUrl: string | null;
  qrBothSides: boolean; qrSize: number;
  nametTagStrings: NametTagStrings;
}) {
  const panelStyle = [s.panel, { position: 'absolute' as const, left: pos.left, top: pos.top, width: panelW, height: panelH }];

  if (qrBothSides) {
    return (
      <View style={panelStyle}>
        <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleFr} logoMode={logoMode} logoDataUrl={logoDataUrl} />
        <QrSection entry={entry} competitionId={competitionId} wcaLiveId={wcaLiveId} wcaLivePersonIds={wcaLivePersonIds} qrSize={qrSize} />
      </View>
    );
  }

  const rows = [
    { label: nametTagStrings.compete,  duties: entry.compete  },
    { label: nametTagStrings.scramble, duties: entry.scramble },
    { label: nametTagStrings.judge,    duties: entry.judge    },
    { label: nametTagStrings.run,      duties: entry.run      },
  ].filter(r => r.duties.length > 0);

  // Scale font down for dense assignment lists to prevent overflow.
  const totalItems = rows.reduce((sum, r) => sum + r.duties.length, 0);
  const dutyFs = Math.max(5, Math.min(7.5, 7.5 - Math.max(0, totalItems - 8) * 0.12));

  // Estimate whether space-evenly is safe. Assumes ~2 items/line, lineH = fontSize * 1.4.
  const lineH = dutyFs * 1.4;
  const estLines = rows.reduce((sum, r) => sum + Math.ceil(r.duties.length / 2), 0);
  const estH = (estLines + rows.length) * lineH;
  const spaceEvenly = estH < (panelH - topSectionH(logoMode)) * 0.65;

  return (
    <View style={panelStyle}>
      <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleFr} logoMode={logoMode} logoDataUrl={logoDataUrl} />
      <View style={[s.dutiesSection, spaceEvenly ? { justifyContent: 'space-evenly' } : {}]}>
        {rows.map(({ label, duties }) => (
          <View key={label} style={[s.dutyRow, spaceEvenly ? {} : { marginBottom: 3 }]}>
            <Text style={[s.dutyLabel, { fontSize: dutyFs }]}>{label}</Text>
            <DutyLines duties={duties} fontSize={dutyFs} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Back panel ────────────────────────────────────────────────────────────────
function BackPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, wcaLivePersonIds, logoMode, logoDataUrl, qrSize }: {
  entry: NametTagEntry; panelW: number; panelH: number;
  pos: { left: number; top: number }; compName: string;
  competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  logoMode: NametTagLogoMode; logoDataUrl: string | null; qrSize: number;
}) {
  return (
    <View style={[s.panel, { position: 'absolute', left: pos.left, top: pos.top, width: panelW, height: panelH }]}>
      <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleEn} logoMode={logoMode} logoDataUrl={logoDataUrl} />
      <QrSection entry={entry} competitionId={competitionId} wcaLiveId={wcaLiveId} wcaLivePersonIds={wcaLivePersonIds} qrSize={qrSize} />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  panel: {
    border: '1.5pt solid black', borderRadius: 6,
    paddingHorizontal: 7, paddingTop: 7, paddingBottom: 6,
    fontFamily: FONT, overflow: 'hidden', backgroundColor: '#ffffff',
    flexDirection: 'column',
  },
  logoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 3, gap: 6 },
  logoSmall:  { width: 20, height: 20, objectFit: 'contain' },
  logoLarge:  { height: 28, objectFit: 'contain', alignSelf: 'center', marginBottom: 4 },
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
});

// ── Document ──────────────────────────────────────────────────────────────────
interface Props {
  nametags: NametTagEntry[];
  settings: CompetitionSettings;
}

export function NametTagDocument({ nametags, settings }: Props) {
  const cfg = CONFIGS[settings.paperFormat as PF] ?? CONFIGS.LETTER;
  const pos = panelPositions(cfg);
  const { competitionId, competitionName, wcaLiveId, wcaLivePersonIds, nametagLogoMode, logoDataUrl, nametagQrMode } = settings;

  // If no logo was uploaded, treat any logo mode as hidden.
  const logoMode: NametTagLogoMode = logoDataUrl ? nametagLogoMode : 'hidden';
  const qrSize = logoMode === 'logo-only' ? 65 : 75;
  const qrBothSides = nametagQrMode === 'both-sides';
  const nametTagStrings = getNametTagStrings(settings.language);

  const pages: NametTagEntry[][] = [];
  for (let i = 0; i < nametags.length; i += 4) pages.push(nametags.slice(i, i + 4));

  return (
    <Document title={`${competitionName} — Name Tags`} author="WCA Scorecard Generator">
      {pages.map((page, pi) => (
        <Page key={pi} size={settings.paperFormat} orientation="landscape" style={{ backgroundColor: '#ffffff' }}>
          {page.flatMap((entry, ei) => {
            const frontPos = pos[ei * 2];
            const backPos  = pos[ei * 2 + 1];
            if (!frontPos || !backPos) return [];
            return [
              <FrontPanel
                key={`f${ei}`} entry={entry}
                panelW={cfg.panelW} panelH={cfg.panelH} pos={frontPos}
                compName={competitionName}
                competitionId={competitionId} wcaLiveId={wcaLiveId}
                wcaLivePersonIds={wcaLivePersonIds}
                logoMode={logoMode} logoDataUrl={logoDataUrl}
                qrBothSides={qrBothSides} qrSize={qrSize}
                nametTagStrings={nametTagStrings}
              />,
              <BackPanel
                key={`b${ei}`} entry={entry}
                panelW={cfg.panelW} panelH={cfg.panelH} pos={backPos}
                compName={competitionName}
                competitionId={competitionId} wcaLiveId={wcaLiveId}
                wcaLivePersonIds={wcaLivePersonIds}
                logoMode={logoMode} logoDataUrl={logoDataUrl}
                qrSize={qrSize}
              />,
            ];
          })}
        </Page>
      ))}
    </Document>
  );
}
