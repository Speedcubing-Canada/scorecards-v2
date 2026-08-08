import { Document, Page, View, Text, Image, StyleSheet, Font } from '@react-pdf/renderer';
import type { CompetitionSettings } from '../types/settings';
import type { ScorecardData } from '../lib/wcif-parser';
import { getStrings, splitLabelTotal } from '../lib/i18n';
import type { Style } from '@react-pdf/types';
import { EVENT_ICONS } from '../assets/events';
import { logoState, resolveLogo } from '../lib/logo';
import { SCORECARDS_PER_PAGE, ROW_HEIGHTS, showLiveIdLine } from './layoutConstants';

// Prevent react-pdf from hyphenating words - lets computed font size control line breaks instead.
Font.registerHyphenationCallback((word) => [word]);

// ── Page/card geometry (points) ───────────────────────────────────────────
// Dimensions measured from the original Sarah-scorecard LETTER PDF output:
//   Cards: 257×345pt  |  L/R margins: ~22pt  |  T/B margins: ~24-26pt
//   H gap: ~53pt  |  V gap: ~52pt  (gap ≈ 2× margin on both axes)
// A4 uses the same absolute margins/gaps; cardH fills the remaining page height.
// LETTER: 22+257+53+257+23=612  |  24+345+52+345+26=792
// A4:     22+249+53+249+22=595  |  22+373+52+373+22=842

const CONFIGS = {
  LETTER: {
    cardW: 257, cardH: 345,
    positions: [
      { left: 22,  top: 24  },  // top-left    (L=22, T=24; H gap=53, V gap=52)
      { left: 332, top: 24  },  // top-right
      { left: 22,  top: 421 },  // bottom-left
      { left: 332, top: 421 },  // bottom-right
    ],
  },
  A4: {
    cardW: 249, cardH: 373,
    positions: [
      { left: 22,  top: 22  },  // 22pt margins on all sides; H gap=53, V gap=52
      { left: 324, top: 22  },
      { left: 22,  top: 447 },
      { left: 324, top: 447 },
    ],
  },
} as const;

const BORDER      = '1.5pt solid black';
const BORDER_THIN = '1pt solid black';
const FONT        = 'Helvetica';
const FONT_BOLD   = 'Helvetica-Bold';

// Column widths: match HTML original proportions 75/55/290/70/70 out of 560px
const COL = { scrambler: '13%', attempt: '10%', result: '52%', judge: '12%', competitor: '13%' };
// Scramble double-checking: a second scrambler-signature column is inserted after the
// first one. Its 13% is taken entirely from `result` (52% → 39%) so every other column
// - and the card's outer geometry - stays unchanged. Both variants sum to 100%.
const COL_DC = { scrambler: '13%', scramblerCheck: '12%', attempt: '10%', result: '40%', judge: '12%', competitor: '13%' };
// Column key order for the header/rows, with and without the double-check column.
const COLS_5 = ['scrambler', 'attempt', 'result', 'judge', 'competitor'] as const;
const COLS_6 = ['scrambler', 'scramblerCheck', 'attempt', 'result', 'judge', 'competitor'] as const;

// Row heights (ROW_HEIGHTS, in layoutConstants.ts) are tuned so the two flex spacers
// around the provisional label are ~6–8pt each.
// Formula: spacer = (inner(335) - header(56) - eventRow(25) - tableHeader(19)
//                   - [cutoff(13)] - rows×rowH - provLine(19) - extraRow) / 2

// Scale cover-card event+round text to fit the card width (Helvetica-Bold ~0.6pt/pt/char).
// cardW(257) - 2×paddingH(8) = 241pt available.
function coverEventFontSize(text: string): number {
  const available = 241;
  return Math.min(18, Math.max(10, Math.floor(available / Math.max(text.length * 0.6, 1))));
}

// Scale name font to fit the nameCell on one line (Helvetica-Bold ~0.65pt/pt/char).
// Card inner width ≈ 248pt (257 - 2×border - 2×paddingH).
//   'custom'  → 80pt logo cell           → nameCell ≈ 162pt → available ≈ 158pt
//   'default' → 80pt comp name + logo    → nameCell ≈ 162pt → available ≈ 158pt
//   'none'    → 26pt comp name cell      → nameCell ≈ 216pt → available ≈ 210pt
function nameFontSize(name: string, state: 'custom' | 'default' | 'none'): number {
  const available = state === 'none' ? 210 : 158;
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
  compNameCell: { width: 26, justifyContent: 'center', alignItems: 'center' },
  compNameText: { fontSize: 8, textAlign: 'center', color: '#111' },
  logoCell: { width: 80, justifyContent: 'center', alignItems: 'center' },
  logoImg: { width: 54, height: 54, objectFit: 'contain' },
  // Default-logo cell: comp name text (left) + SCC logo (right), both centred vertically
  defaultLogoCell: { width: 80, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  defaultCompNameText: { fontSize: 7.5, textAlign: 'center', color: '#111', flex: 1, paddingRight: 2 },
  defaultLogoImg: { width: 30, height: 30, objectFit: 'contain' },
  nameCell: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  nameText: { fontFamily: FONT_BOLD, textAlign: 'center' },
  idText: { fontSize: 7.5, textAlign: 'center', marginTop: 2, color: '#222' },

  // Event row - underlined text only, no box, icon is left clear
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
  headerText:     { fontSize: 5.5, textAlign: 'center', paddingVertical: 2, paddingHorizontal: 0 },
  attemptNumText: { fontSize: 12, textAlign: 'center', fontFamily: FONT_BOLD },

  cutoffLine:     { fontSize: 7, textAlign: 'center', marginVertical: 2, color: '#333' },
  provisionalLine:{ fontSize: 7, textAlign: 'center', marginTop: 2, color: '#333' },

  // Cover card
  coverCard: {
    border: BORDER, borderRadius: 7.5,
    paddingVertical: 10, paddingHorizontal: 14,
    fontFamily: FONT, justifyContent: 'flex-start',
  },
  coverCompName:     { fontSize: 12, textAlign: 'center', marginBottom: 4 },
  coverEventRound:   { fontSize: 18, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 3 },
  coverGroup:        { fontSize: 19, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 8 },
  coverDividerRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 7 },
  coverDividerLine:  { flex: 1, height: 0.75, backgroundColor: '#444' },
  coverDividerText:  { fontSize: 10, fontFamily: FONT_BOLD, marginHorizontal: 7 },
  coverCheckRow:     { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, marginBottom: 8 },
  coverCheckText:    { fontSize: 9 },
  coverCheckBox:     { width: 9, height: 9, border: '0.75pt solid black', marginLeft: 5, flexShrink: 0 },
  coverItem:         { fontSize: 9, paddingLeft: 20, marginBottom: 8 },
  coverInitials:     { fontSize: 10, textAlign: 'center', fontFamily: FONT_BOLD, marginBottom: 12 },
});

// ── Attempt row ───────────────────────────────────────────────────────────
function AttemptRow({ num, rowH, isMBF, doubleCheck }: { num: number | ''; rowH: number; isMBF: boolean; doubleCheck: boolean }) {
  const cols = doubleCheck ? COL_DC : COL;
  return (
    <View style={[styles.attemptRow, { height: rowH }]}>
      <View style={[styles.cellBase, { width: cols.scrambler }]} />
      {doubleCheck && <View style={[styles.cellBase, { width: COL_DC.scramblerCheck }]} />}
      <View style={[styles.cellBase, { width: cols.attempt }]}>
        {num !== '' && <Text style={styles.attemptNumText}>{num}</Text>}
      </View>
      <View style={[styles.cellBase, { width: cols.result }]}>
        {isMBF && (
          <Text style={{ fontSize: 6.5, textAlign: 'center', color: '#333' }}>
            {'_____ out of _____\nTime\n_______________'}
          </Text>
        )}
      </View>
      <View style={[styles.cellBase, { width: cols.judge }]} />
      <View style={[styles.cellBase, { width: cols.competitor }]} />
    </View>
  );
}

// Render a round/group label with the trailing "of Y" (connector + total) greyed
// (#808080) to de-emphasise it. Labels without a connector (e.g. "Final Round")
// render entirely in the base style. `extra` lets the caller append text (e.g. a
// trailing space + group) that stays in the base colour.
const GREY = '#808080';
function LabelWithGreyTotal({ label, connector, style }: {
  label: string; connector: string; style: Style | Style[];
}) {
  const { head, tail } = splitLabelTotal(label, connector);
  return (
    <Text style={style}>
      {head}{tail && <Text style={{ color: GREY }}>{tail}</Text>}
    </Text>
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
  const strings = getStrings(settings.language, settings.secondaryLanguage);
  const rowH    = ROW_HEIGHTS[card.format];
  const isMBF   = card.eventId === '333mbf';
  const doubleCheck = card.scrambleDoubleCheck === true;
  const icon    = card.iconDataUrl ?? EVENT_ICONS[card.eventId];

  // In the 6-column (double-check) layout the result column is narrower (40% vs 52%),
  // so use compact suffixes to prevent the bilingual header from wrapping to 4 lines.
  const resultSuffix = doubleCheck
    ? (card.isCumulative ? strings.shortCumulativeSuffix(card.limit)
       : isMBF           ? strings.mbfSuffix
       :                   strings.shortDnfSuffix(card.limit))
    : (card.isCumulative ? strings.cumulativeSuffix(card.limit)
       : isMBF           ? strings.mbfSuffix
       :                   strings.dnfSuffix(card.limit));

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
                 : card.format === 'bo1'        ? [1]     // custom-event single attempt
                 : [1];                                    // 'bo1-mo3': 1 pre-cutoff row
  const postRows = card.format === 'bo2-avg5' ? [3,4,5] : card.format === 'bo1-mo3' ? [2,3] : [];
  const hasCutoff = card.cutoff !== '';

  const logoMode = logoState(settings);
  const headerLogo = resolveLogo(settings);

  return (
    <View style={[styles.card, { position: 'absolute', left: pos.left, top: pos.top, width: cardW, height: cardH }]}>
      {/* Header: custom logo (alone) | comp name + SCC logo | comp name only */}
      <View style={styles.header}>
        {logoMode === 'custom' && headerLogo ? (
          <View style={styles.logoCell}>
            <Image src={headerLogo} style={styles.logoImg} />
          </View>
        ) : logoMode === 'default' && headerLogo ? (
          <View style={styles.defaultLogoCell}>
            <Text style={styles.defaultCompNameText}>{settings.competitionName}</Text>
            <Image src={headerLogo} style={styles.defaultLogoImg} />
          </View>
        ) : (
          <View style={styles.compNameCell}>
            <Text style={styles.compNameText}>{settings.competitionName}</Text>
          </View>
        )}
        <View style={styles.nameCell}>
          <Text style={[styles.nameText, { fontSize: nameFontSize(card.name || ' ', logoMode) }]}>
            {card.name || ' '}
          </Text>
          <Text style={styles.idText}>
            {card.wcaId}{showLiveIdLine(settings.hideWcaLiveId, card.liveId) && <>{'    '}WCA Live: <Text style={{ fontFamily: FONT_BOLD }}>{card.liveId}</Text></>}
          </Text>
        </View>
      </View>

      {/* Event info row */}
      <View style={styles.eventRow}>
        {icon && <Image src={icon} style={styles.eventIcon} />}
        <Text style={styles.eventCell}>{card.eventName}</Text>
        <LabelWithGreyTotal label={card.roundLabel} connector={strings.ofConnector} style={styles.roundCell} />
        <LabelWithGreyTotal label={card.group} connector={strings.ofConnector} style={styles.groupCell} />
      </View>

      {/* Pre-cutoff attempts */}
      <View style={styles.table}>
        <View style={styles.headerRow}>
          {(doubleCheck ? COLS_6 : COLS_5).map((col) => (
            <View key={col} style={[styles.cellBase, { width: (doubleCheck ? COL_DC : COL as Record<string, string>)[col] }]}>
              <Text style={styles.headerText}>
                {col === 'result'        ? resultHeader
               : col === 'scrambler'     ? strings.scrambler
               : col === 'scramblerCheck' ? strings.scramblerCheck
               : col === 'attempt'       ? strings.attempt
               : col === 'judge'         ? strings.judge
               : strings.competitor}
              </Text>
            </View>
          ))}
        </View>
        {preRows.map(n => <AttemptRow key={n} num={n} rowH={rowH} isMBF={isMBF} doubleCheck={doubleCheck} />)}
      </View>

      {hasCutoff && (
        <Text style={styles.cutoffLine}>{strings.cutoffLine(card.cutoff, card.format === 'bo1-mo3')}</Text>
      )}

      {postRows.length > 0 && (
        <View style={styles.table}>
          {postRows.map(n => <AttemptRow key={n} num={n} rowH={rowH} isMBF={false} doubleCheck={doubleCheck} />)}
        </View>
      )}

      {/* Equal spacers centre the provisional label between the last attempt row and the extra row */}
      <View style={{ flex: 1 }} />
      <Text style={styles.provisionalLine}>{strings.provisionalLine}</Text>
      <View style={{ flex: 1 }} />

      {/* Extra/provisional row */}
      <View style={styles.table}>
        <AttemptRow num='' rowH={rowH} isMBF={isMBF} doubleCheck={doubleCheck} />
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
  const strings = getStrings(settings.language);
  const cover = strings.cover;
  const round = splitLabelTotal(card.roundLabel, strings.ofConnector);
  return (
    <View style={[styles.coverCard, { position: 'absolute', left: pos.left, top: pos.top, width: cardW, height: cardH }]}>
      <Text style={styles.coverCompName}>{settings.competitionName}</Text>
      <Text style={[styles.coverEventRound, { fontSize: coverEventFontSize(`${card.eventName} ${card.roundLabel}`) }]}>
        {card.eventName} {round.head}{round.tail && <Text style={{ color: GREY }}>{round.tail}</Text>}
      </Text>
      {/* 'per-round-card' covers carry no group label - they stand for the whole round,
          so the group line becomes the group count instead. */}
      {card.group === ''
        ? <Text style={styles.coverGroup}>{cover.allGroups(card.numGroups)}</Text>
        : <LabelWithGreyTotal label={card.group} connector={strings.ofConnector} style={styles.coverGroup} />}

      <View style={styles.coverDividerRow}>
        <View style={styles.coverDividerLine} />
        <Text style={styles.coverDividerText}>{cover.forDelegate}</Text>
        <View style={styles.coverDividerLine} />
      </View>

      <View style={styles.coverCheckRow}>
        <Text style={styles.coverCheckText}>{cover.bundledScorecards(card.numScorecards)}</Text>
        <View style={styles.coverCheckBox} />
      </View>
      <View style={styles.coverCheckRow}>
        <Text style={styles.coverCheckText}>{cover.checkedSignatures}</Text>
        <View style={styles.coverCheckBox} />
      </View>
      <Text style={styles.coverItem}>{cover.incidentsCount}</Text>
      <Text style={styles.coverInitials}>{cover.delegateInitials}</Text>

      <View style={styles.coverDividerRow}>
        <View style={styles.coverDividerLine} />
        <Text style={styles.coverDividerText}>{cover.forDataEntry}</Text>
        <View style={styles.coverDividerLine} />
      </View>

      <Text style={styles.coverItem}>{cover.resultsEntered}</Text>
      <Text style={styles.coverInitials}>{cover.scoretakerInitials}</Text>
      <Text style={styles.coverItem}>{cover.incidentsLogged}</Text>
      <Text style={styles.coverInitials}>{cover.delegateInitials}</Text>
      <Text style={styles.coverItem}>{cover.resultsChecked}</Text>
      <Text style={styles.coverInitials}>{cover.delegateInitials}</Text>
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
  for (let i = 0; i < entries.length; i += SCORECARDS_PER_PAGE) pages.push(entries.slice(i, i + SCORECARDS_PER_PAGE));

  return (
    <Document title={`${settings.competitionName} - Scorecards`} author="WCA Scorecard Generator">
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
