import { Document, Page, View, Text, Image, StyleSheet, Font, Svg, Rect } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { CompetitionSettings, NametTagLayout, NametTagLogoMode } from '../types/settings';
import type { NametTagEntry, NametTagRole } from '../lib/wcif-parser';
import { EVENT_ICONS } from '../assets/events';
import { getNametTagStrings, type NametTagStrings } from '../lib/i18n';
import { resolveLogo } from '../lib/logo';

Font.registerHyphenationCallback((word) => [word]);

// ── Page geometry ─────────────────────────────────────────────────────────────
// Vertical — landscape pages: 4 panels wide × 2 panels tall = 8 panels = 4 nametag pairs.
// Layout per page (persons A, B, C, D):
//   row 0: [Front_A] [Back_A] [Front_B] [Back_B]
//   row 1: [Front_C] [Back_C] [Front_D] [Back_D]
//
// Horizontal — landscape pages: 2 panels wide × 3 panels tall = 6 panels = 3 nametag pairs.
// Layout per page (persons A, B, C):
//   row 0: [Front_A] [Back_A]
//   row 1: [Front_B] [Back_B]
//   row 2: [Front_C] [Back_C]
// When cut and folded front-to-back, each pair becomes one nametag.

const CONFIGS = {
  LETTER: { panelW: 189, panelH: 292, margin: 12, gapH: 4, gapV: 4 },
  A4:     { panelW: 201, panelH: 283, margin: 12, gapH: 4, gapV: 4 },
} as const;

const HORIZONTAL_CONFIGS = {
  LETTER: { panelW: 382, panelH: 193, margin: 12, gapH: 4, gapV: 4 },
  A4:     { panelW: 407, panelH: 188, margin: 12, gapH: 4, gapV: 4 },
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

function panelPositionsHorizontal(cfg: (typeof HORIZONTAL_CONFIGS)[PF]) {
  const { panelW, panelH, margin, gapH, gapV } = cfg;
  const pos: { left: number; top: number }[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 2; col++)
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

function badgeColors(role: NametTagRole) {
  if (role === 'delegate' || role === 'organizer')
    return { bg: '#343434', fg: 'white' };
  if (role === 'new-competitor')
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
function PanelTop({ entry, panelW, compName, titleText, logoMode, logoDataUrl, compact = false, showWcaId = true }: {
  entry: NametTagEntry; panelW: number; compName: string; titleText: string;
  logoMode: NametTagLogoMode; logoDataUrl: string | null;
  compact?: boolean; showWcaId?: boolean;
}) {
  const { bg, fg } = badgeColors(entry.role);
  const maxNameFs = compact ? 16 : 20;
  const nameFs = Math.min(maxNameFs, nameFontSize(entry.name, panelW));
  const iconSz = compact ? 10 : 12;
  const compNameStyle = compact ? [s.compName, { fontSize: 7, marginBottom: 2 }] : s.compName;
  const badgeStyle = compact
    ? [s.badge, { backgroundColor: bg, paddingVertical: 3, marginBottom: 2 }]
    : [s.badge, { backgroundColor: bg }];

  return (
    <View style={{ height: topSectionH(logoMode, compact), flexDirection: 'column' }}>
      {logoMode === 'logo-only' && logoDataUrl ? (
        <Image src={logoDataUrl} style={s.logoLarge} />
      ) : logoMode === 'with-name' && logoDataUrl ? (
        <View style={s.logoHeaderRow}>
          <Image src={logoDataUrl} style={s.logoSmall} />
          <Text style={compNameStyle}>{compName}</Text>
        </View>
      ) : (
        <Text style={compNameStyle}>{compName}</Text>
      )}
      <Text style={[s.name, { fontSize: nameFs }]}>{entry.name}</Text>
      {!compact && <View style={{ flex: 1 }} />}
      <View style={badgeStyle}>
        <Text style={[s.badgeText, { color: fg }, compact ? { fontSize: 11 } : {}]}>{titleText}</Text>
      </View>
      <View style={[s.iconsRow, compact ? { marginTop: 3, marginBottom: 2 } : {}]}>
        {entry.events.map(evId =>
          EVENT_ICONS[evId]
            ? <Image key={evId} src={EVENT_ICONS[evId]} style={{ width: iconSz, height: iconSz, marginHorizontal: 1 }} />
            : null
        )}
      </View>
      {showWcaId && !compact && <Text style={s.wcaId}>{entry.wcaId || ' '}</Text>}
    </View>
  );
}

// ── QR code section ───────────────────────────────────────────────────────────
function QrSection({ entry, competitionId, wcaLiveId, wcaLivePersonIds, qrSize, compact = false }: {
  entry: NametTagEntry; competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null; qrSize: number; compact?: boolean;
}) {
  const cgUrl = `https://www.competitiongroups.com/competitions/${competitionId}/persons/${entry.registrantId}`;
  const wcaLivePersonId = wcaLivePersonIds?.[entry.registrantId] ?? null;
  const liveUrl = (wcaLiveId && wcaLivePersonId)
    ? `https://live.worldcubeassociation.org/competitions/${wcaLiveId}/competitors/${wcaLivePersonId}`
    : 'https://live.worldcubeassociation.org';

  return (
    <View style={[s.qrSection, compact ? { gap: 8 } : {}]}>
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
// compact (horizontal layout) compresses the section to fit the shorter card height.
function topSectionH(logoMode: NametTagLogoMode, compact = false) {
  if (compact) return logoMode === 'logo-only' ? 85 : 75;
  return logoMode === 'logo-only' ? 146 : 127;
}

// ── Front panel ───────────────────────────────────────────────────────────────
function FrontPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, wcaLivePersonIds, logoMode, logoDataUrl, qrBothSides, qrSize, nametTagStrings, compact = false }: {
  entry: NametTagEntry; panelW: number; panelH: number;
  pos: { left: number; top: number }; compName: string;
  competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  logoMode: NametTagLogoMode; logoDataUrl: string | null;
  qrBothSides: boolean; qrSize: number;
  nametTagStrings: NametTagStrings;
  compact?: boolean;
}) {
  const panelStyle = [s.panel, { position: 'absolute' as const, left: pos.left, top: pos.top, width: panelW, height: panelH }];

  if (qrBothSides) {
    return (
      <View style={panelStyle}>
        <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleFront} logoMode={logoMode} logoDataUrl={logoDataUrl} compact={compact} showWcaId={!compact} />
        <QrSection entry={entry} competitionId={competitionId} wcaLiveId={wcaLiveId} wcaLivePersonIds={wcaLivePersonIds} qrSize={qrSize} compact={compact} />
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
  const spaceEvenly = estH < (panelH - topSectionH(logoMode, compact)) * 0.90;

  return (
    <View style={panelStyle}>
      <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleFront} logoMode={logoMode} logoDataUrl={logoDataUrl} compact={compact} showWcaId={!compact} />
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
function BackPanel({ entry, panelW, panelH, pos, compName, competitionId, wcaLiveId, wcaLivePersonIds, logoMode, logoDataUrl, qrSize, compact = false }: {
  entry: NametTagEntry; panelW: number; panelH: number;
  pos: { left: number; top: number }; compName: string;
  competitionId: string; wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  logoMode: NametTagLogoMode; logoDataUrl: string | null; qrSize: number;
  compact?: boolean;
}) {
  return (
    <View style={[s.panel, { position: 'absolute', left: pos.left, top: pos.top, width: panelW, height: panelH }]}>
      <PanelTop entry={entry} panelW={panelW} compName={compName} titleText={entry.titleBack} logoMode={logoMode} logoDataUrl={logoDataUrl} compact={compact} />
      {compact && <Text style={[s.wcaId, { marginTop: 2, marginBottom: 2 }]}>{entry.wcaId || ' '}</Text>}
      <QrSection entry={entry} competitionId={competitionId} wcaLiveId={wcaLiveId} wcaLivePersonIds={wcaLivePersonIds} qrSize={qrSize} compact={compact} />
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
  badge:      { borderRadius: 2, paddingVertical: 5, marginBottom: 4 },
  badgeText:  { fontSize: 13, textAlign: 'center', fontFamily: FONT_BOLD },
  iconsRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 6, marginBottom: 4 },
  wcaId:      { fontSize: 13, textAlign: 'center', marginBottom: 4, color: '#222', fontFamily: FONT },
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
  const layout: NametTagLayout = settings.nametagLayout ?? 'vertical';
  const horizontal = layout === 'horizontal';
  const cfg = horizontal
    ? (HORIZONTAL_CONFIGS[settings.paperFormat as PF] ?? HORIZONTAL_CONFIGS.LETTER)
    : (CONFIGS[settings.paperFormat as PF] ?? CONFIGS.LETTER);
  const pos = horizontal ? panelPositionsHorizontal(cfg as (typeof HORIZONTAL_CONFIGS)[PF]) : panelPositions(cfg as (typeof CONFIGS)[PF]);
  const personsPerPage = horizontal ? 3 : 4;
  const { competitionId, competitionName, wcaLiveId, wcaLivePersonIds, nametagLogoMode, nametagQrMode } = settings;

  // Custom logo (if any) wins; otherwise fall back to the bundled SCC logo when enabled.
  const logoDataUrl = resolveLogo(settings);

  // If no logo is available at all, force any logo mode to hidden.
  const logoMode: NametTagLogoMode = logoDataUrl ? nametagLogoMode : 'hidden';
  const qrSize = horizontal ? (logoMode === 'logo-only' ? 50 : 60) : (logoMode === 'logo-only' ? 65 : 75);
  const qrBothSides = nametagQrMode === 'both-sides';
  const nametTagStrings = getNametTagStrings(settings.language);

  const pages: NametTagEntry[][] = [];
  for (let i = 0; i < nametags.length; i += personsPerPage) pages.push(nametags.slice(i, i + personsPerPage));

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
                compact={horizontal}
              />,
              <BackPanel
                key={`b${ei}`} entry={entry}
                panelW={cfg.panelW} panelH={cfg.panelH} pos={backPos}
                compName={competitionName}
                competitionId={competitionId} wcaLiveId={wcaLiveId}
                wcaLivePersonIds={wcaLivePersonIds}
                logoMode={logoMode} logoDataUrl={logoDataUrl}
                qrSize={qrSize}
                compact={horizontal}
              />,
            ];
          })}
        </Page>
      ))}
    </Document>
  );
}
