export type Language = 'en' | 'fr' | 'bilingual-fr' | 'bilingual-en';

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
  wcaLiveId: string | null;
  nametagLogoMode: NametTagLogoMode;
  nametagQrMode: NametTagQrMode;
  customEvents: CustomEvent[];
}
