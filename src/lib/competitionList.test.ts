import { describe, it, expect } from 'vitest';
import { visibleCompetitions } from './competitionList';
import type { WCACompetition } from '../types/wcif';

const TODAY = '2026-09-09';

function comp(id: string, start: string, end = start): WCACompetition {
  return { id, start_date: start, end_date: end } as WCACompetition;
}

const past = comp('Past2024', '2024-05-01');
const older = comp('Past2023', '2023-05-01');
const yesterday = comp('Yesterday', '2026-09-07', '2026-09-08');
const ongoing = comp('Ongoing', '2026-09-08', TODAY);
const soon = comp('Soon', '2026-10-01');
const later = comp('Later', '2027-01-01');
const all = [past, later, ongoing, soon, older, yesterday];

const ids = (c: WCACompetition[]) => c.map(x => x.id);

describe('visibleCompetitions', () => {
  it('keeps a competition ending today', () => {
    expect(ids(visibleCompetitions([ongoing], TODAY, false))).toEqual(['Ongoing']);
  });

  it('drops finished competitions in prod', () => {
    expect(ids(visibleCompetitions(all, TODAY, false))).toEqual(['Ongoing', 'Soon', 'Later']);
  });

  it('appends finished competitions in dev, most recent first', () => {
    expect(ids(visibleCompetitions(all, TODAY, true)))
      .toEqual(['Ongoing', 'Soon', 'Later', 'Yesterday', 'Past2024', 'Past2023']);
  });
});
