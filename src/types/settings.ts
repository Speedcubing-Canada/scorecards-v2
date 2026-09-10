import type { GenerationScope } from '../lib/generationScope';

// Mirrored by `LANGUAGES` in src/i18n/index.ts and `LOCALES` in src/lib/i18n.ts.
// Keep all three in sync.
export type LocaleCode = 'en' | 'fr' | 'es' | 'pt';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export type NametTagQrMode = 'back-only' | 'both-sides';

export type NametTagLogoMode = 'hidden' | 'with-name' | 'logo-only';

export type NametTagLayout = 'vertical' | 'horizontal';

// Decides the name tag QR target. 'wca-live' needs wcaLiveId + the person id map;
// 'ilr' (integrated live results on the WCA site) needs neither.
export type LiveResultsMode = 'wca-live' | 'ilr';

// Cover cards only; the Round Checklist is a separate document chosen in DocumentSelection.
// 'per-round-card' is per event+round, and per stage when a round spans stages.
export type ScorecardCheckMode =
  | 'per-group-card' | 'per-round-card' | 'none';

// Maps 1:1 onto the parser's buckets.
export type DoubleCheckRound = 'firstRound' | 'intermediate' | 'semis' | 'finals';
// WCA ID -> event IDs always double-checked for that competitor.
export type ScrambleDoubleCheckOverrides = Record<string, string[]>;
export type DoubleCheckRegionScope = 'continental' | 'national';

// bo3 renders with the mo3 layout (same 3 rows, as WCIF format '3' does); bo2/bo1 take
// no cutoff.
export type CustomEventFormat = 'avg5' | 'mo3' | 'bo3' | 'bo2' | 'bo1';

// wcaId is '' for newcomers.
export interface CustomCompetitor {
  name: string;
  wcaId: string;
}

export interface CustomEvent {
  name: string;
  iconDataUrl: string | null;
  format: CustomEventFormat;
  cutoff: string;  // "" = none, otherwise "M:SS" - triggers bo2-avg5 / bo1-mo3
  limit: string;   // "" = none, otherwise "M:SS"
  roundLabel?: string;
  // When set, one named card per competitor padded to a full page, instead of 4 blanks.
  competitors?: CustomCompetitor[];
}

export interface CompetitionSettings {
  competitionId: string;
  competitionName: string;
  language: LocaleCode;
  // When set, scorecard headers and cutoff lines print both languages and name-tag role
  // badges use this one. `null` = single-language output.
  secondaryLanguage: LocaleCode | null;
  paperFormat: PaperFormat;
  secondRoundMode: SecondRoundMode;
  logoDataUrl: string | null;
  // The bundled Speedcubing Canada logo when no custom logo is uploaded.
  useDefaultLogo: boolean;
  // Detected from `scoretaking_software` ('internal' => ilr), overridable on the settings page.
  liveResultsMode: LiveResultsMode;
  // 'wca-live' only; ILR needs neither.
  wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  hideWcaLiveId: boolean;
  nametagLogoMode: NametTagLogoMode;
  nametagQrMode: NametTagQrMode;
  nametagLayout: NametTagLayout;
  customEvents: CustomEvent[];
  scorecardCheckMode: ScorecardCheckMode;
  // Adds a second scrambler-signature column to scorecards whose round is in
  // `scrambleDoubleCheckRounds` or whose competitor+event is in the overrides.
  scrambleDoubleCheck: boolean;
  scrambleDoubleCheckRounds: DoubleCheckRound[];
  scrambleDoubleCheckOverrides: ScrambleDoubleCheckOverrides;
  // Ranking rules (regulation 11i), matched against the WCIF personal bests. `null` switches
  // a rule off. OR'd with the round and override rules across every round, so a top-ranked
  // competitor always gets the column.
  scrambleDoubleCheckWorldTop: number | null;
  scrambleDoubleCheckRegionTop: number | null;
  scrambleDoubleCheckRegionScope: DoubleCheckRegionScope;
  generationScope: GenerationScope;
  // No WCIF is fetched, only customEvents render, and every WCA Live field is forced off.
  isCustomCompetition: boolean;
}
