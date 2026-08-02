// The UI calls this document the **Round Checklist**; the internals kept the older
// "checking sheet" vocabulary (CheckingDay/CheckingRow/CHECKING_*).
import { Document, Page, View, Text, StyleSheet, Font, Svg, Polyline } from '@react-pdf/renderer';
import type { CompetitionSettings } from '../types/settings';
import type { CheckingDay, CheckingRow } from '../lib/wcif-parser';
import { getCheckingSheetStrings, type CheckingSheetStrings } from '../lib/i18n';
import {
  CHECKING_FLEX, CHECKING_CELL_PAD_V, CHECKING_BOX, CHECKING_BREAK_RULE,
} from './layoutConstants';

Font.registerHyphenationCallback((word) => [word]);

const FONT      = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const BORDER       = '0.75pt solid #888';
const BORDER_INNER = '0.5pt solid #bbb';
const ROW_ALT   = '#f2f2f2';
const HEADER_BG = '#d8d8d8';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 30,
    paddingVertical: 36,
    fontFamily: FONT,
  },
  title: {
    fontSize: 18,
    textAlign: 'center',
    fontFamily: FONT_BOLD,
    marginBottom: 22,
  },
  // Wraps [optional day label] + [optional stage name] + table.
  // wrap={false} prevents this block from splitting across pages.
  stageBlock: {
    marginBottom: 14,
  },
  dayLabel: {
    fontSize: 13,
    fontFamily: FONT_BOLD,
    marginBottom: 6,
  },
  stageName: {
    fontSize: 11,
    fontFamily: FONT_BOLD,
    marginBottom: 4,
    marginLeft: 2,
  },
  table: {
    border: BORDER,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
    borderBottom: BORDER,
  },
  dataRowEven: {
    flexDirection: 'row',
    borderBottom: BORDER_INNER,
    backgroundColor: '#ffffff',
  },
  dataRowOdd: {
    flexDirection: 'row',
    borderBottom: BORDER_INNER,
    backgroundColor: ROW_ALT,
  },
  headerText: {
    fontSize: 8,
    fontFamily: FONT_BOLD,
    textAlign: 'center',
  },
  cellText: {
    fontSize: 10,
    textAlign: 'center',
  },
  // Group count + tick box, side by side and centred as a unit.
  groupsInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Pins a tick box to the right edge of a cell, leaving the flex to its left free for
  // hand-written initials. Data entry and double-checking can take several passes (a
  // scoretaker may enter half a round and leave), so the initials and the "this round is
  // finished" tick are separate marks in the same cell.
  initialsInner: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  // Same geometry as the cover card's checkbox (ScorecardDocument styles.coverCheckBox).
  checkBox: {
    width: CHECKING_BOX,
    height: CHECKING_BOX,
    border: '0.75pt solid black',
    flexShrink: 0,
  },
  // Only the groups cell puts the box beside text; elsewhere it stands alone.
  checkBoxSpaced: {
    marginLeft: 6,
  },
});

// Helvetica has no U+2713, so a ticked box is drawn rather than typeset.
function CheckBox({ checked, spaced }: { checked: boolean; spaced?: boolean }) {
  return (
    <View style={spaced ? [styles.checkBox, styles.checkBoxSpaced] : styles.checkBox}>
      {checked && (
        <Svg viewBox="0 0 9 9" width={CHECKING_BOX} height={CHECKING_BOX}>
          <Polyline points="1.6,4.7 3.6,7 7.4,2.1" stroke="black" strokeWidth={1.2} fill="none" />
        </Svg>
      )}
    </View>
  );
}

// Cells are built from the flex map so a column can never get a width here and a
// different one in the header.
function cellStyle(flex: number, last: boolean, header: boolean) {
  return {
    flex,
    paddingVertical: header ? 6 : CHECKING_CELL_PAD_V,
    paddingHorizontal: 4,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    ...(last ? {} : { borderRight: header ? BORDER : BORDER_INNER }),
  };
}

const COLUMNS: { key: keyof typeof CHECKING_FLEX; label: (s: CheckingSheetStrings) => string }[] = [
  { key: 'start',       label: (s) => s.start },
  { key: 'event',       label: (s) => s.event },
  { key: 'groups',      label: (s) => s.groupsMade },
  { key: 'scorecards',  label: (s) => s.scorecards },
  { key: 'dataEntry',   label: (s) => s.dataEntry },
  { key: 'doubleCheck', label: (s) => s.doubleCheck },
  { key: 'takenBy',     label: (s) => s.takenBy },
];

function TableHeader({ strings }: { strings: CheckingSheetStrings }) {
  return (
    <View style={styles.headerRow}>
      {COLUMNS.map((col, i) => (
        <View key={col.key} style={cellStyle(CHECKING_FLEX[col.key], i === COLUMNS.length - 1, true)}>
          <Text style={styles.headerText}>{col.label(strings)}</Text>
        </View>
      ))}
    </View>
  );
}

function DataRow({ row, alt }: { row: CheckingRow; alt: boolean }) {
  const base = alt ? styles.dataRowOdd : styles.dataRowEven;
  return (
    // A lunch break above this row draws a thick rule. The previous row's 0.5pt #bbb
    // bottom border sits directly under it and vanishes beneath the heavier line.
    <View style={row.breakBefore ? [base, { borderTop: CHECKING_BREAK_RULE }] : base}>
      <View style={cellStyle(CHECKING_FLEX.start, false, false)}>
        <Text style={styles.cellText}>{row.startTime}</Text>
      </View>
      <View style={cellStyle(CHECKING_FLEX.event, false, false)}>
        <Text style={styles.cellText}>{row.eventRound}</Text>
      </View>
      {/* Groups created, and the scorecards produced for them: both are done ahead of
          time for a first round, so both boxes print ticked there. */}
      <View style={cellStyle(CHECKING_FLEX.groups, false, false)}>
        <View style={styles.groupsInner}>
          <Text style={styles.cellText}>{row.groupCount}</Text>
          <CheckBox checked={row.preChecked} spaced />
        </View>
      </View>
      <View style={cellStyle(CHECKING_FLEX.scorecards, false, false)}>
        <CheckBox checked={row.preChecked} />
      </View>
      {/* Initials go in the empty space; the box is ticked once the round is fully done. */}
      <View style={cellStyle(CHECKING_FLEX.dataEntry, false, false)}>
        <View style={styles.initialsInner}><CheckBox checked={false} /></View>
      </View>
      <View style={cellStyle(CHECKING_FLEX.doubleCheck, false, false)}>
        <View style={styles.initialsInner}><CheckBox checked={false} /></View>
      </View>
      {/* Blank for a name. */}
      <View style={cellStyle(CHECKING_FLEX.takenBy, true, false)} />
    </View>
  );
}

interface Props {
  days: CheckingDay[];
  settings: CompetitionSettings;
}

export function CheckingSheetDocument({ days, settings }: Props) {
  // Show room names only when there are multiple rooms in any day.
  const multiStage = days.some(d => d.stages.length > 1);
  const strings = getCheckingSheetStrings(settings.language);

  return (
    <Document title={`${settings.competitionName} - Round Checklist`} author="WCA Scorecard Generator">
      <Page size={settings.paperFormat} style={styles.page}>
        <Text style={styles.title}>{settings.competitionName} {strings.title}</Text>

        {days.map((day, di) =>
          day.stages.map((stage, si) => (
            // Each (day × room) block is non-breaking. The day label is included only in
            // the first room's block so it stays anchored to its content.
            <View key={`${di}-${si}`} style={styles.stageBlock} wrap={false}>
              {si === 0 && (
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
              )}
              {multiStage && (
                <Text style={styles.stageName}>{stage.stageName}</Text>
              )}
              <View style={styles.table}>
                <TableHeader strings={strings} />
                {stage.rows.map((row, ri) => (
                  <DataRow key={ri} row={row} alt={ri % 2 === 1} />
                ))}
              </View>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
