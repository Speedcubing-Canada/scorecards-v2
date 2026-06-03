import type { GenerationScope } from '../lib/generationScope';

// A single printable language. The set of supported codes is mirrored by the
// `LANGUAGES` registry in src/i18n/index.ts (UI dropdown) and the `LOCALES`
// table in src/lib/i18n.ts (PDF strings) — keep all three in sync.
export type LocaleCode = 'en' | 'fr' | 'es' | 'pt';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export type NametTagQrMode = 'back-only' | 'both-sides';

export type NametTagLogoMode = 'hidden' | 'with-name' | 'logo-only';

// Scramble double-checking: an optional second scrambler-signature column.
// Rounds map 1:1 onto the parser's buckets (Round 1 / Round 2 / Semis / Finals).
export type DoubleCheckRound = 'firstRound' | 'intermediate' | 'semis' | 'finals';
// WCA ID -> event IDs that must always be double-checked for that competitor.
export type ScrambleDoubleCheckOverrides = Record<string, string[]>;

export interface CustomEvent {
  name: string;
  iconDataUrl: string | null;
  format: 'avg5' | 'mo3';
  cutoff: string;  // "" = none, otherwise "M:SS" — triggers bo2-avg5 / bo1-mo3
  limit: string;   // "" = none, otherwise "M:SS"
}

export interface CompetitionSettings {
  competitionId: string;
  competitionName: string;
  // Primary (mandatory) scorecard language.
  language: LocaleCode;
  // Optional second language. When set, scorecard column headers and the
  // cutoff/provisional lines show both languages, and name-tag back-side role
  // badges use this language. `null` ⇒ single-language output.
  secondaryLanguage: LocaleCode | null;
  paperFormat: PaperFormat;
  secondRoundMode: SecondRoundMode;
  logoDataUrl: string | null;
  // Falls back to the bundled Speedcubing Canada logo when no custom logo is uploaded.
  // Disable for competitions outside Canada that don't want the SCC branding.
  useDefaultLogo: boolean;
  wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  hideWcaLiveId: boolean;
  nametagLogoMode: NametTagLogoMode;
  nametagQrMode: NametTagQrMode;
  customEvents: CustomEvent[];
  // Scramble double-checking (optional). When enabled, a second scrambler-signature
  // column is added to scorecards whose round is in `scrambleDoubleCheckRounds`, or
  // whose competitor+event appears in `scrambleDoubleCheckOverrides`.
  scrambleDoubleCheck: boolean;
  scrambleDoubleCheckRounds: DoubleCheckRound[];
  scrambleDoubleCheckOverrides: ScrambleDoubleCheckOverrides;
  // What to generate. Defaults to `{ mode: 'everything' }` (the normal pre-competition case).
  // Set on the scope step when the WCIF already has groups for a later round.
  generationScope: GenerationScope;
}
