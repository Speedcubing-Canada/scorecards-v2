import { describe, expect, it } from 'vitest';
import { CHANGELOG, isStale, unseenEntries } from './changelog';

const DAY = 24 * 60 * 60 * 1000;
/** A day after the newest entry, so these tests never rot as the wall clock moves on. */
const FRESH = Date.parse(CHANGELOG[0].id.slice(0, 10)) + DAY;
const STALE = FRESH + 366 * DAY;

describe('unseenEntries', () => {
  it('shows everything to a visitor with no marker', () => {
    expect(unseenEntries(null, FRESH)).toEqual(CHANGELOG);
  });

  it('shows nothing once the newest entry is marked seen', () => {
    expect(unseenEntries(CHANGELOG[0].id, FRESH)).toEqual([]);
  });

  it('shows only entries strictly newer than the marker', () => {
    // Marker set on the second-newest entry: only the newest is left.
    expect(unseenEntries(CHANGELOG[1].id, FRESH)).toEqual([CHANGELOG[0]]);
  });

  it('shows everything again when the marker predates the whole changelog', () => {
    expect(unseenEntries('2000-01-01', FRESH)).toEqual(CHANGELOG);
  });

  it('shows nothing at all once the newest entry is over a year old', () => {
    expect(unseenEntries(null, STALE)).toEqual([]);
    expect(unseenEntries('2000-01-01', STALE)).toEqual([]);
  });
});

describe('isStale', () => {
  it('is false while the newest entry is under a year old', () => {
    expect(isStale(FRESH)).toBe(false);
    expect(isStale(Date.parse(CHANGELOG[0].id.slice(0, 10)) + 364 * DAY)).toBe(false);
  });

  it('is true once the newest entry passes a year', () => {
    expect(isStale(Date.parse(CHANGELOG[0].id.slice(0, 10)) + 366 * DAY)).toBe(true);
  });
});

describe('CHANGELOG data', () => {
  it('is sorted newest first with unique ids', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Strictly descending — string comparison is what unseenEntries relies on.
    for (let i = 1; i < ids.length; i++) {
      expect(ids[i - 1] > ids[i]).toBe(true);
    }
  });

  it('uses sortable YYYY-MM-DD ids that parse as real dates', () => {
    for (const entry of CHANGELOG) {
      expect(entry.id).toMatch(/^\d{4}-\d{2}-\d{2}[a-z]?$/);
      expect(Number.isNaN(Date.parse(entry.id.slice(0, 10)))).toBe(false);
    }
  });

  it('has non-empty English bullets, plus non-empty text in every locale provided', () => {
    for (const entry of CHANGELOG) {
      expect(entry.items.en.length).toBeGreaterThan(0);
      for (const [locale, items] of Object.entries(entry.items)) {
        expect(items.length, `${entry.id}/${locale}`).toBeGreaterThan(0);
        for (const item of items) {
          expect(item.trim(), `${entry.id}/${locale}`).not.toBe('');
        }
      }
    }
  });
});
