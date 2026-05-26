export type Language = 'en' | 'fr' | 'bilingual-fr' | 'bilingual-en';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export type NametTagQrMode = 'back-only' | 'both-sides';

export type NametTagLogoMode = 'hidden' | 'with-name' | 'logo-only';

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
}
