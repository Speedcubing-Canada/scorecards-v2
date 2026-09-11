import type { LocaleCode } from '../types/settings';

export interface LanguageOption {
  code: LocaleCode;
  label: string;
}

/**
 * The default scorecard language, from the interface locale. Matched on the base subtag, since
 * the UI locale may be region-tagged. Falls back to the first supported language.
 */
export function resolveDefaultPrimaryLanguage(
  uiLanguage: string | undefined | null,
  languages: readonly LanguageOption[],
): LocaleCode {
  const base = (uiLanguage ?? '').split('-')[0];
  return languages.find((l) => l.code === base)?.code ?? languages[0].code;
}

/** A column in the secondary-language row. `value === null` is the "None" tile. */
export interface SecondaryTile {
  value: LocaleCode | null;
  selected: boolean;
}

const CANADIAN_LANGUAGE_CODES = ['en', 'fr'] as const;

/**
 * Whether the SCC logo defaults on. An allowlist, so a language added later never shows a
 * Canadian org logo to non-Canadian users by accident.
 */
export function isCanadianLanguage(uiLanguage: string | null | undefined): boolean {
  const base = (uiLanguage ?? '').split('-')[0];
  return (CANADIAN_LANGUAGE_CODES as readonly string[]).includes(base);
}

/**
 * Columns mirror the primary row; the one matching `primary` becomes the "None" tile, so
 * nothing shifts when the primary changes.
 */
export function secondaryLanguageRow(
  languages: readonly LanguageOption[],
  primary: LocaleCode,
  secondary: LocaleCode | null,
): SecondaryTile[] {
  return languages.map((l) =>
    l.code === primary
      ? { value: null, selected: secondary === null }
      : { value: l.code, selected: secondary === l.code },
  );
}
