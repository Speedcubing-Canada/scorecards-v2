export type Language = 'en' | 'fr' | 'bilingual-fr' | 'bilingual-en';

export type PaperFormat = 'A4' | 'LETTER';

export type SecondRoundMode = 'prefilled' | 'blanks';

export interface CompetitionSettings {
  competitionId: string;
  competitionName: string;
  language: Language;
  paperFormat: PaperFormat;
  secondRoundMode: SecondRoundMode;
  logoDataUrl: string | null;
}
