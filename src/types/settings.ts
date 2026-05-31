export type Language = 'en' | 'fr' | 'es' | 'bilingual-fr' | 'bilingual-en';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export type NametTagQrMode = 'back-only' | 'both-sides';

export type NametTagLogoMode = 'hidden' | 'with-name' | 'logo-only';

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
  language: Language;
  paperFormat: PaperFormat;
  secondRoundMode: SecondRoundMode;
  logoDataUrl: string | null;
  // Falls back to the bundled Speedcubing Canada logo when no custom logo is uploaded.
  // Disable for competitions outside Canada that don't want the SCC branding.
  useDefaultLogo: boolean;
  wcaLiveId: string | null;
  wcaLivePersonIds: Record<number, string> | null;
  nametagLogoMode: NametTagLogoMode;
  nametagQrMode: NametTagQrMode;
  customEvents: CustomEvent[];
}
