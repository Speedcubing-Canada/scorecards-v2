import { describe, it, expect } from 'vitest';
import { isChampionship } from './championship';

describe('isChampionship', () => {
  it('matches the word in every supported locale', () => {
    expect(isChampionship('Rubik\'s WCA World Championship 2025')).toBe(true);
    expect(isChampionship('Championnat du Québec 2026')).toBe(true);
    expect(isChampionship('Campeonato Nacional de México 2026')).toBe(true);
    expect(isChampionship('CANADIAN CHAMPIONSHIP 2026')).toBe(true);
  });

  it('does not match an ordinary competition', () => {
    expect(isChampionship('Toronto Open 2026')).toBe(false);
    expect(isChampionship('Cubing Québec Automne 2026')).toBe(false);
    expect(isChampionship('')).toBe(false);
  });
});
