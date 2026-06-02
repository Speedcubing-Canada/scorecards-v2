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
