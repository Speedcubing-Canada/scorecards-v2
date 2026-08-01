import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import type { CompetitionSettings } from '../types/settings';
import type { CheckingDay } from '../lib/wcif-parser';
import { getCheckingSheetStrings, type CheckingSheetStrings } from '../lib/i18n';
import { CHECKING_FLEX, CHECKING_CELL_PAD_V } from './layoutConstants';

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
  // Same geometry as the cover card's checkbox (ScorecardDocument styles.coverCheckBox).
  checkBox: {
    width: 9,
    height: 9,
    border: '0.75pt solid black',
    marginLeft: 6,
    flexShrink: 0,
  },
});

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
  { key: 'groups',      label: (s) => s.groupsDone },
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

interface Props {
  days: CheckingDay[];
  settings: CompetitionSettings;
}

export function CheckingSheetDocument({ days, settings }: Props) {
  // Show room names only when there are multiple rooms in any day.
  const multiStage = days.some(d => d.stages.length > 1);
  const strings = getCheckingSheetStrings(settings.language);

  return (
    <Document title={`${settings.competitionName} - Scorecard Checking`} author="WCA Scorecard Generator">
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
                  <View key={ri} style={ri % 2 === 0 ? styles.dataRowEven : styles.dataRowOdd}>
                    <View style={cellStyle(CHECKING_FLEX.start, false, false)}>
                      <Text style={styles.cellText}>{row.startTime}</Text>
                    </View>
                    <View style={cellStyle(CHECKING_FLEX.event, false, false)}>
                      <Text style={styles.cellText}>{row.eventRound}</Text>
                    </View>
                    <View style={cellStyle(CHECKING_FLEX.groups, false, false)}>
                      <View style={styles.groupsInner}>
                        <Text style={styles.cellText}>{row.groupCount}</Text>
                        <View style={styles.checkBox} />
                      </View>
                    </View>
                    {/* Blank for hand-writing: scorecards checked, data entry, double-check, taken by. */}
                    <View style={cellStyle(CHECKING_FLEX.scorecards, false, false)} />
                    <View style={cellStyle(CHECKING_FLEX.dataEntry, false, false)} />
                    <View style={cellStyle(CHECKING_FLEX.doubleCheck, false, false)} />
                    <View style={cellStyle(CHECKING_FLEX.takenBy, true, false)} />
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
