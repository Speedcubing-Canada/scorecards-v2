import type { GenerationScope } from '../lib/generationScope';

// A single printable language. The set of supported codes is mirrored by the
// `LANGUAGES` registry in src/i18n/index.ts (UI dropdown) and the `LOCALES`
// table in src/lib/i18n.ts (PDF strings) - keep all three in sync.
export type LocaleCode = 'en' | 'fr' | 'es' | 'pt';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export type NametTagQrMode = 'back-only' | 'both-sides';

export type NametTagLogoMode = 'hidden' | 'with-name' | 'logo-only';

export type NametTagLayout = 'vertical' | 'horizontal';

// Where the delegate/scoretaker cover card goes. Purely about cover cards - the Round
// Checklist is a separate document, chosen in DocumentSelection, not a mode here.
//   per-group-card - one cover card per group, on the scorecard sheets (default, legacy)
//   per-round-card - one cover card per event+round (per stage when a round spans stages)
//   none           - no cover cards
export type ScorecardCheckMode =
  | 'per-group-card' | 'per-round-card' | 'none';

// Scramble double-checking: an optional second scrambler-signature column.
// Rounds map 1:1 onto the parser's buckets (Round 1 / Round 2 / Semis / Finals).
export type DoubleCheckRound = 'firstRound' | 'intermediate' | 'semis' | 'finals';
// WCA ID -> event IDs that must always be double-checked for that competitor.
export type ScrambleDoubleCheckOverrides = Record<string, string[]>;

// Card layouts a custom event can pick. bo3 renders with the mo3 layout (same 3
// attempt rows - mirrors how WCIF format '3' is handled); bo2/bo1 take no cutoff.
export type CustomEventFormat = 'avg5' | 'mo3' | 'bo3' | 'bo2' | 'bo1';

// One row of a custom event's competitor CSV. wcaId is '' for newcomers.
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
  // Free text printed in the card's round field ("" / undefined = blank, as before).
  roundLabel?: string;
  // When set, one named card per competitor (padded with blanks to a full page)
  // instead of the default page of 4 blank cards.
  competitors?: CustomCompetitor[];
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
  nametagLayout: NametTagLayout;
  customEvents: CustomEvent[];
  // Cover-card placement. Defaults to 'per-group-card' (the original behaviour).
  scorecardCheckMode: ScorecardCheckMode;
  // Scramble double-checking (optional). When enabled, a second scrambler-signature
  // column is added to scorecards whose round is in `scrambleDoubleCheckRounds`, or
  // whose competitor+event appears in `scrambleDoubleCheckOverrides`.
  scrambleDoubleCheck: boolean;
  scrambleDoubleCheckRounds: DoubleCheckRound[];
  scrambleDoubleCheckOverrides: ScrambleDoubleCheckOverrides;
  // What to generate. Defaults to `{ mode: 'everything' }` (the normal pre-competition case).
  // Set on the scope step when the WCIF already has groups for a later round.
  generationScope: GenerationScope;
  // True for custom (non-WCA) competitions: no WCIF is fetched, only customEvents
  // are rendered, and all WCA Live fields are forced off (unofficial competition).
  isCustomCompetition: boolean;
}
