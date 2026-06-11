import { describe, it, expect } from 'vitest';
import { resolveDefaultPrimaryLanguage, secondaryLanguageRow, isCanadianLanguage, type LanguageOption } from './languageSelector';

const LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
];

describe('resolveDefaultPrimaryLanguage', () => {
  it('uses the UI language when it is supported', () => {
    expect(resolveDefaultPrimaryLanguage('fr', LANGUAGES)).toBe('fr');
    expect(resolveDefaultPrimaryLanguage('pt', LANGUAGES)).toBe('pt');
  });

  it('strips a region subtag before matching', () => {
    expect(resolveDefaultPrimaryLanguage('en-US', LANGUAGES)).toBe('en');
    expect(resolveDefaultPrimaryLanguage('pt-BR', LANGUAGES)).toBe('pt');
  });

  it('falls back to the first language for unsupported or missing locales', () => {
    expect(resolveDefaultPrimaryLanguage('de', LANGUAGES)).toBe('en');
    expect(resolveDefaultPrimaryLanguage('', LANGUAGES)).toBe('en');
    expect(resolveDefaultPrimaryLanguage(undefined, LANGUAGES)).toBe('en');
    expect(resolveDefaultPrimaryLanguage(null, LANGUAGES)).toBe('en');
  });
});

describe('isCanadianLanguage', () => {
  it('returns true for en and fr (with and without region tags)', () => {
    expect(isCanadianLanguage('en')).toBe(true);
    expect(isCanadianLanguage('en-CA')).toBe(true);
    expect(isCanadianLanguage('fr')).toBe(true);
    expect(isCanadianLanguage('fr-CA')).toBe(true);
  });

  it('returns false for all other languages and empty values', () => {
    expect(isCanadianLanguage('es')).toBe(false);
    expect(isCanadianLanguage('pt')).toBe(false);
    expect(isCanadianLanguage('pt-BR')).toBe(false);
    expect(isCanadianLanguage(null)).toBe(false);
    expect(isCanadianLanguage(undefined)).toBe(false);
    expect(isCanadianLanguage('')).toBe(false);
  });
});

describe('secondaryLanguageRow', () => {
  it('keeps one fixed column per language regardless of the primary', () => {
    const row = secondaryLanguageRow(LANGUAGES, 'fr', null);
    expect(row).toHaveLength(LANGUAGES.length);
    // Columns line up positionally with LANGUAGES; the primary column is None.
    expect(row.map((t) => t.value)).toEqual(['en', null, 'es', 'pt']);
  });

  it('puts the None tile under the selected primary and moves only it', () => {
    expect(secondaryLanguageRow(LANGUAGES, 'en', null).map((t) => t.value))
      .toEqual([null, 'fr', 'es', 'pt']);
    expect(secondaryLanguageRow(LANGUAGES, 'pt', null).map((t) => t.value))
      .toEqual(['en', 'fr', 'es', null]);
  });

  it('marks the None tile selected when no secondary is chosen', () => {
    const row = secondaryLanguageRow(LANGUAGES, 'fr', null);
    const none = row.find((t) => t.value === null)!;
    expect(none.selected).toBe(true);
    expect(row.filter((t) => t.selected)).toHaveLength(1);
  });

  it('marks the chosen secondary column selected, not None', () => {
    const row = secondaryLanguageRow(LANGUAGES, 'fr', 'es');
    expect(row.find((t) => t.value === 'es')!.selected).toBe(true);
    expect(row.find((t) => t.value === null)!.selected).toBe(false);
    expect(row.filter((t) => t.selected)).toHaveLength(1);
  });

  it('never offers the primary language as a secondary option', () => {
    for (const primary of LANGUAGES.map((l) => l.code)) {
      const row = secondaryLanguageRow(LANGUAGES, primary, null);
      expect(row.some((t) => t.value === primary)).toBe(false);
    }
  });
});
