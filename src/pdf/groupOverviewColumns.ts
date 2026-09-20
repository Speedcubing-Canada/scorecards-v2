import type { GroupOverviewEntry } from '../lib/wcif-parser';
import type { GroupOverviewStrings } from '../lib/i18n';
import { GROUP_OVERVIEW_FLEX } from './layoutConstants';

// Beside the document rather than in it, so the layout test can import this without
// dragging @react-pdf in (and so the document file only exports a component).

export type ColumnKey = 'competitors' | 'scramblers' | 'runners' | 'judges';

export const COLUMNS: { key: ColumnKey; flex: number; label: (s: GroupOverviewStrings) => string }[] = [
  { key: 'competitors', flex: GROUP_OVERVIEW_FLEX.competitors, label: (s) => s.competitors },
  { key: 'scramblers',  flex: GROUP_OVERVIEW_FLEX.scramblers,  label: (s) => s.scramblers },
  { key: 'runners',     flex: GROUP_OVERVIEW_FLEX.runners,     label: (s) => s.runners },
  { key: 'judges',      flex: GROUP_OVERVIEW_FLEX.judges,      label: (s) => s.judges },
];

/**
 * A staff column empty for every group is dropped rather than printed blank: before the
 * organizer assigns staff, the WCIF has groups but no scramblers, runners or judges.
 * Document-wide, not per group, so the columns do not shift between blocks on one page.
 */
export function visibleColumns(entries: Pick<GroupOverviewEntry, ColumnKey>[]) {
  return COLUMNS.filter(
    (c) => c.key === 'competitors' || entries.some((e) => e[c.key].length > 0),
  );
}
