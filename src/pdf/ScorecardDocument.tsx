import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import type { CompetitionSettings } from '../types/settings';
import type { ScorecardData, ScorecardFormat } from '../lib/wcif-parser';
import { getStrings } from '../lib/i18n';
import { EVENT_ICONS } from '../assets/events';

// Prevent react-pdf from hyphenating words — lets computed font size control line breaks instead.
Font.registerHyphenationCallback((word) => [word]);

// ── Page/card geometry (points) ───────────────────────────────────────────
// Cards preserve original HTML 561:726 aspect ratio (≈ 0.773).
// Absolute positioning creates cutting guides between cards.
// Derivation: scale = cardW/561; cardH = cardW*(726/561)
// LETTER: cardW=282 → gap H=48, gap V=62 (fills 612×792 exactly)
// A4:     cardW=274 → gap H=47, centering adds 36pt top/bottom margin

const CONFIGS = {
  LETTER: {
    cardW: 282, cardH: 365,
    positions: [
      { left: 12,  top: 12  },  // top-left    (12pt margins; H gap=24, V gap=38)
      { left: 318, top: 12  },  // top-right
      { left: 12,  top: 415 },  // bottom-left
      { left: 318, top: 415 },  // bottom-right
    ],
  },
  A4: {
    cardW: 274, cardH: 354,
    positions: [
      { left: 12,  top: 36  },  // 12pt L/R; 36pt T/B (H gap=23, V gap=62)
      { left: 309, top: 36  },
      { left: 12,  top: 452 },
      { left: 309, top: 452 },
    ],
  },
} as const;

const BORDER      = '1.5pt solid black';
const BORDER_THIN = '1pt solid black';
const FONT        = 'Helvetica';
const FONT_BOLD   = 'Helvetica-Bold';

// Column widths: scaled from HTML 65/55/300/70/70 px proportions
const COL = { scrambler: '12%', attempt: '10%', result: '54%', judge: '12%', competitor: '12%' };

// Row heights: scaled from HTML (64→32, 52→26, 93→47, 98→49, 90→45)
const ROW_HEIGHTS: Record<ScorecardFormat, number> = {
  avg5: 32, 'bo2-avg5': 26, mo3: 49, 'bo1-mo3': 47, bo2: 45,
};

// Scale name font to fit the nameCell on one line (Helvetica-Bold ~0.65pt/pt/char).
// With logo: nameCell ≈ 182pt (no compNameCell). Without logo: nameCell ≈ 242pt.
function nameFontSize(name: string, hasLogo: boolean): number {
  const available = hasLogo ? 175 : 235;
  return Math.min(18, Math.max(7, Math.floor(available / Math.max(name.length * 0.65, 1))));
}

const styles = StyleSheet.create({
  page: { backgroundColor: '#ffffff' },

  card: {
    border: BORDER, borderRadius: 7.5,
    paddingTop: 5, paddingBottom: 5,
    paddingHorizontal: 3,
    fontFamily: FONT, overflow: 'hidden',
  },

  // Header (comp name | logo | competitor name + id)
  header: { flexDirection: 'row', height: 56 },
  compNameCell: { width: 28, justifyContent: 'center', alignItems: 'center' },
  compNameText: { fontSize: 8, textAlign: 'center', color: '#111' },
  logoCell: { width: 88, justifyContent: 'center', alignItems: 'center' },
  logoImg: { width: 60, height: 60, objectFit: 'contain' },
  nameCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  nameText: { fontFamily: FONT_BOLD, textAlign: 'center' },
  idText: { fontSize: 7.5, textAlign: 'center', marginTop: 2, color: '#222' },

  // Event row — underlined text only, no box, icon is left clear
  eventRow: {
    flexDirection: 'row', alignItems: 'stretch',
    marginTop: 4, marginBottom: 6,
  },
  eventIcon: { width: 14, height: 14, marginHorizontal: 3, alignSelf: 'center' },
  eventCell:  { flex: 2,   fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },
  roundCell:  { flex: 1.5, fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },
  groupCell:  { flex: 1.5, fontSize: 9, textAlign: 'center', paddingVertical: 2, borderBottom: BORDER_THIN, marginHorizontal: 3 },

  // Attempt table
  table:          { borderTop: BORDER_THIN, borderLeft: BORDER_THIN },
  headerRow:      { flexDirection: 'row', backgroundColor: '#f8f8f8' },
  attemptRow:     { flexDirection: 'row' },
  cellBase:       { borderRight: BORDER_THIN, borderBottom: BORDER_THIN, justifyContent: 'center', alignItems: 'center' },
  headerText:     { fontSize: 6, textAlign: 'center', paddingVertical: 2, paddingHorizontal: 0 },
  attemptNumText: { fontSize: 12, textAlign: 'center', fontFamily: FONT_BOLD },

  cutoffLine:     { fontSize: 7, textAlign: 'center', marginVertical: 2, color: '#333' },
  provisionalLine:{ fontSize: 7, textAlign: 'center', marginTop: 2, color: '#333' },

  // Cover card
  coverCard: {
    border: BORDER, borderRadius: 7.5,
    paddingVertical: 10, paddingHorizontal: 8,
    fontFamily: FONT, justifyContent: 'flex-start',
  },
  coverCompName:     { fontSize: 12, textAlign: 'center', marginBottom: 4 },
  coverEventRound:   { fontSize: 18, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 3 },
  coverGroup:        { fontSize: 19, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 8 },
  coverDividerRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 7 },
  coverDividerLine:  { flex: 1, height: 0.75, backgroundColor: '#444' },
  coverDividerText:  { fontSize: 10, fontFamily: FONT_BOLD, marginHorizontal: 7 },
  coverCheckRow:     { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, marginBottom: 8 },
  coverCheckText:    { fontSize: 9 },
  coverCheckBox:     { width: 9, height: 9, border: '0.75pt solid black', marginLeft: 5, flexShrink: 0 },
  coverItem:         { fontSize: 9, paddingLeft: 14, marginBottom: 8 },
  coverInitials:     { fontSize: 10, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 12 },
});

// ── Attempt row ───────────────────────────────────────────────────────────
function AttemptRow({ num, rowH, isMBF }: { num: number | ''; rowH: number; isMBF: boolean }) {
  return (
    <View style={[styles.attemptRow, { height: rowH }]}>
      <View style={[styles.cellBase, { width: COL.scrambler }]} />
      <View style={[styles.cellBase, { width: COL.attempt }]}>
        {num !== '' && <Text style={styles.attemptNumText}>{num}</Text>}
      </View>
      <View style={[styles.cellBase, { width: COL.result }]}>
        {isMBF && (
          <Text style={{ fontSize: 6.5, textAlign: 'center', color: '#333' }}>
            {'_____ out of _____\nTime\n_______________'}
          </Text>
        )}
      </View>
      <View style={[styles.cellBase, { width: COL.judge }]} />
      <View style={[styles.cellBase, { width: COL.competitor }]} />
    </View>
  );
}

// ── Scorecard ─────────────────────────────────────────────────────────────
function ScorecardCard({
  card, settings, cardW, cardH, pos,
}: {
  card: Extract<ScorecardData, { kind: 'scorecard' }>;
  settings: CompetitionSettings;
  cardW: number; cardH: number;
  pos: { left: number; top: number };
}) {
  const strings = getStrings(settings.language);
  const rowH    = ROW_HEIGHTS[card.format];
  const isMBF   = card.eventId === '333mbf';
  const icon    = card.iconDataUrl ?? EVENT_ICONS[card.eventId];

  const resultSuffix = card.isCumulative ? strings.cumulativeSuffix(card.limit)
                     : isMBF             ? strings.mbfSuffix
                     :                    strings.dnfSuffix(card.limit);

  // For bilingual languages the prefix and suffix each have 2 lines (EN + FR).
  // Merge them per-language so each language occupies exactly one line.
  const prefLines = strings.resultPrefix.split('\n');
  const sufLines  = resultSuffix.split('\n');
  const resultHeader = (prefLines.length === sufLines.length && prefLines.length > 1)
    ? prefLines.map((p, i) => `${p} ${sufLines[i]}`).join('\n')
    : `${strings.resultPrefix}\n${resultSuffix}`;

  const preRows  = isMBF                        ? [1, 2]
                 : card.format === 'avg5'       ? [1,2,3,4,5]
                 : card.format === 'bo2-avg5'   ? [1,2]
                 : card.format === 'mo3'        ? [1,2,3]
                 : card.format === 'bo2'        ? [1,2]   // 6x6, 7x7 (bo2 non-MBF)
                 : [1];                                    // 'bo1-mo3': 1 pre-cutoff row
  const postRows = card.format === 'bo2-avg5' ? [3,4,5] : card.format === 'bo1-mo3' ? [2,3] : [];
  const hasCutoff = card.cutoff !== '';

  return (
    <View style={[styles.card, { position: 'absolute', left: pos.left, top: pos.top, width: cardW, height: cardH }]}>
      {/* Header: logo OR comp name — not both */}
      <View style={styles.header}>
        {settings.logoDataUrl ? (
          <View style={styles.logoCell}>
            <Image src={settings.logoDataUrl} style={styles.logoImg} />
          </View>
        ) : (
          <View style={styles.compNameCell}>
            <Text style={styles.compNameText}>{settings.competitionName}</Text>
          </View>
        )}
        <View style={styles.nameCell}>
          <Text style={[styles.nameText, { fontSize: nameFontSize(card.name || ' ', !!settings.logoDataUrl) }]}>
            {card.name || ' '}
          </Text>
          <Text style={styles.idText}>
            {card.wcaId}{'    '}WCA Live: <Text style={{ fontFamily: FONT_BOLD }}>{card.liveId}</Text>
          </Text>
        </View>
      </View>

      {/* Event info row */}
      <View style={styles.eventRow}>
        {icon && <Image src={icon} style={styles.eventIcon} />}
        <Text style={styles.eventCell}>{card.eventName}</Text>
        <Text style={styles.roundCell}>{card.roundLabel}</Text>
        <Text style={styles.groupCell}>{card.group}</Text>
      </View>

      {/* Pre-cutoff attempts */}
      <View style={styles.table}>
        <View style={styles.headerRow}>
          {(['scrambler','attempt','result','judge','competitor'] as const).map((col) => (
            <View key={col} style={[styles.cellBase, { width: COL[col] }]}>
              <Text style={styles.headerText}>
                {col === 'result'     ? resultHeader
               : col === 'scrambler' ? strings.scrambler
               : col === 'attempt'   ? strings.attempt
               : col === 'judge'     ? strings.judge
               : strings.competitor}
              </Text>
            </View>
          ))}
        </View>
        {preRows.map(n => <AttemptRow key={n} num={n} rowH={rowH} isMBF={isMBF} />)}
      </View>

      {hasCutoff && (
        <Text style={styles.cutoffLine}>{strings.cutoffLine(card.cutoff, card.format === 'bo1-mo3')}</Text>
      )}

      {postRows.length > 0 && (
        <View style={styles.table}>
          {postRows.map(n => <AttemptRow key={n} num={n} rowH={rowH} isMBF={false} />)}
        </View>
      )}

      <Text style={styles.provisionalLine}>{strings.provisionalLine}</Text>

      {/* Extra/provisional row */}
      <View style={styles.table}>
        <AttemptRow num='' rowH={rowH} isMBF={isMBF} />
      </View>
    </View>
  );
}

// ── Cover card ────────────────────────────────────────────────────────────
function CoverCard({
  card, settings, cardW, cardH, pos,
}: {
  card: Extract<ScorecardData, { kind: 'cover' }>;
  settings: CompetitionSettings;
  cardW: number; cardH: number;
  pos: { left: number; top: number };
}) {
  if (!card.eventId) return null;
  return (
    <View style={[styles.coverCard, { position: 'absolute', left: pos.left, top: pos.top, width: cardW, height: cardH }]}>
      <Text style={styles.coverCompName}>{settings.competitionName}</Text>
      <Text style={styles.coverEventRound}>{card.eventName} {card.roundLabel}</Text>
      <Text style={styles.coverGroup}>{card.group}</Text>

      <View style={styles.coverDividerRow}>
        <View style={styles.coverDividerLine} />
        <Text style={styles.coverDividerText}>FOR DELEGATE</Text>
        <View style={styles.coverDividerLine} />
      </View>

      <View style={styles.coverCheckRow}>
        <Text style={styles.coverCheckText}>
          1. Bundled all <Text style={{ fontFamily: FONT_BOLD }}>{card.numScorecards}</Text> scorecards
        </Text>
        <View style={styles.coverCheckBox} />
      </View>
      <View style={styles.coverCheckRow}>
        <Text style={styles.coverCheckText}>2. Checked for missing signatures</Text>
        <View style={styles.coverCheckBox} />
      </View>
      <Text style={styles.coverItem}>3. Number of scorecards with incidents: _____</Text>
      <Text style={styles.coverInitials}>Delegate Initials ______</Text>

      <View style={styles.coverDividerRow}>
        <View style={styles.coverDividerLine} />
        <Text style={styles.coverDividerText}>FOR DATA ENTRY</Text>
        <View style={styles.coverDividerLine} />
      </View>

      <Text style={styles.coverItem}>4. Results entered by Scoretaker</Text>
      <Text style={styles.coverInitials}>Scoretaker Initials ______</Text>
      <Text style={styles.coverItem}>5. Incidents logged by Delegate</Text>
      <Text style={styles.coverInitials}>Delegate Initials ______</Text>
      <Text style={styles.coverItem}>6. Results checked by Delegate</Text>
      <Text style={styles.coverInitials}>Delegate Initials ______</Text>
    </View>
  );
}

// ── Document ──────────────────────────────────────────────────────────────
interface Props {
  entries: ScorecardData[];
  settings: CompetitionSettings;
}

export function ScorecardDocument({ entries, settings }: Props) {
  const size   = settings.paperFormat;
  const config = CONFIGS[size];
  const pages: ScorecardData[][] = [];
  for (let i = 0; i < entries.length; i += 4) pages.push(entries.slice(i, i + 4));

  return (
    <Document title={`${settings.competitionName} — Scorecards`} author="WCA Scorecard Generator">
      {pages.map((page, pi) => (
        <Page key={pi} size={size} style={styles.page}>
          {page.map((entry, ei) => {
            const pos = config.positions[ei] ?? config.positions[0];
            return entry.kind === 'scorecard'
              ? <ScorecardCard key={ei} card={entry} settings={settings}
                  cardW={config.cardW} cardH={config.cardH} pos={pos} />
              : <CoverCard key={ei} card={entry} settings={settings}
                  cardW={config.cardW} cardH={config.cardH} pos={pos} />;
          })}
        </Page>
      ))}
    </Document>
  );
}
