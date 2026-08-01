import type { LocaleCode } from '../types/settings';

export interface LanguageOption {
  code: LocaleCode;
  label: string;
}

/**
 * Resolve the default primary scorecard language from the interface locale.
 * The UI locale may be region-tagged (e.g. "en-US"), so we match on the base
 * subtag. Falls back to the first supported language when the UI locale isn't
 * one we generate scorecards in.
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
 * Returns true when the UI language is one of the Canadian-native languages
 * (English or French). Used to decide whether the SCC logo is on by default -
 * any language not in this allowlist defaults to no logo, so future additions
 * don't accidentally show a Canadian org logo to non-Canadian users.
 */
export function isCanadianLanguage(uiLanguage: string | null | undefined): boolean {
  const base = (uiLanguage ?? '').split('-')[0];
  return (CANADIAN_LANGUAGE_CODES as readonly string[]).includes(base);
}

/**
 * Build the column-aligned secondary-language row. Columns mirror the primary
 * row (one language each); the column matching the selected `primary` becomes
 * the "None" tile, so columns never shift when the primary changes.
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
