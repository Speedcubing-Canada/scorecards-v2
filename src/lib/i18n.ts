import type { Language } from '../types/settings';

export interface ScorecardStrings {
  scrambler: string;
  attempt: string;
  judge: string;
  competitor: string;
  resultPrefix: string;       // "Result" or "Résultat" or both
  dnfSuffix: (limit: string) => string;
  cumulativeSuffix: (limit: string) => string;
  mbfSuffix: string;
  cutoffLine: (cutoff: string, mo3: boolean) => string;
  provisionalLine: string;
  newCompetitor: string;
  newCompetitorF: string;
  roundName: (n: number, total: number) => string;
  finalRound: string;
}

const EN: ScorecardStrings = {
  scrambler: 'Scrambler',
  attempt: 'Attempt',
  judge: 'Judge',
  competitor: 'Competitor',
  resultPrefix: 'Result',
  dnfSuffix: (limit) => `(DNF if not under ${limit})`,
  cumulativeSuffix: (limit) => `(Cumulative Time Limit: ${limit})`,
  mbfSuffix: '(Limit: Reg. H1b)',
  cutoffLine: (cutoff, mo3) =>
    mo3
      ? `─── Continue if Attempt 1 is below ${cutoff} ───`
      : `─── Continue if Attempt 1 or 2 is below ${cutoff} ───`,
  provisionalLine: '─── Extra or Provisional Solve (Delegate Initials _______) ───',
  newCompetitor: 'New Competitor',
  newCompetitorF: 'New Competitor',
  roundName: (n, total) => `Round ${n} of ${total}`,
  finalRound: 'Final Round',
};

const FR: ScorecardStrings = {
  scrambler: 'Mélangeur',
  attempt: 'Essai',
  judge: 'Juge',
  competitor: 'Compétiteur',
  resultPrefix: 'Résultat',
  dnfSuffix: (limit) => `(DNF si n'est pas inférieur à ${limit})`,
  cumulativeSuffix: (limit) => `(Limite de Temps Cumul.: ${limit})`,
  mbfSuffix: '(Limite: Rég. H1b)',
  cutoffLine: (cutoff, mo3) =>
    mo3
      ? `─── Continuez si Essai 1 est inférieur à ${cutoff} ───`
      : `─── Continuez si Essai 1 ou 2 sont inférieurs à ${cutoff} ───`,
  provisionalLine: '─── Essai extra ou provisoire (Initiales du Délégué _______) ───',
  newCompetitor: 'Nouveau Compétiteur',
  newCompetitorF: 'Nouvelle Compétitrice',
  roundName: (n, total) => `Tour ${n} de ${total}`,
  finalRound: 'Tour Final',
};

export function getStrings(language: Language): ScorecardStrings {
  if (language === 'en') return EN;
  if (language === 'fr') return FR;
  // Bilingual: merge EN + FR with separator
  const primary = language === 'bilingual-fr' ? FR : EN;
  const secondary = language === 'bilingual-fr' ? EN : FR;
  return {
    scrambler: `${primary.scrambler}\n${secondary.scrambler}`,
    attempt: `${primary.attempt}\n${secondary.attempt}`,
    judge: `${primary.judge}\n${secondary.judge}`,
    competitor: `${primary.competitor}\n${secondary.competitor}`,
    resultPrefix: `${primary.resultPrefix}\n${secondary.resultPrefix}`,
    dnfSuffix: (limit) => `${primary.dnfSuffix(limit)}\n${secondary.dnfSuffix(limit)}`,
    cumulativeSuffix: (limit) => `${primary.cumulativeSuffix(limit)}\n${secondary.cumulativeSuffix(limit)}`,
    mbfSuffix: primary.mbfSuffix,
    cutoffLine: (cutoff, mo3) => `${primary.cutoffLine(cutoff, mo3)}\n${secondary.cutoffLine(cutoff, mo3)}`,
    provisionalLine: `${primary.provisionalLine}\n${secondary.provisionalLine}`,
    newCompetitor: primary.newCompetitor,
    newCompetitorF: primary.newCompetitorF,
    roundName: (n, total) => `${primary.roundName(n, total)}`,
    finalRound: primary.finalRound,
  };
}

export const EVENT_NAMES_EN: Record<string, string> = {
  '333': '3x3x3 Cube', '222': '2x2x2 Cube', '444': '4x4x4 Cube',
  '555': '5x5x5 Cube', '666': '6x6x6 Cube', '777': '7x7x7 Cube',
  '333bf': '3x3x3 Blindfolded', '333fm': 'FMC', '333oh': '3x3x3 One-Handed',
  'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 Blindfolded',
  '555bf': '5x5x5 Blindfolded', '333mbf': '3x3x3 Multi-Blind',
};

export const EVENT_NAMES_FR: Record<string, string> = {
  '333': 'Cube 3x3x3', '222': 'Cube 2x2x2', '444': 'Cube 4x4x4',
  '555': 'Cube 5x5x5', '666': 'Cube 6x6x6', '777': 'Cube 7x7x7',
  '333bf': "3x3x3 à L'aveugle", '333fm': 'FMC', '333oh': '3x3x3 à Une Main',
  'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': "4x4x4 à L'aveugle",
  '555bf': "5x5x5 à L'aveugle", '333mbf': 'Multi-BLD',
};

export function getEventName(eventId: string, language: Language): string {
  if (language === 'en') return EVENT_NAMES_EN[eventId] ?? eventId;
  if (language === 'fr') return EVENT_NAMES_FR[eventId] ?? eventId;
  const fr = EVENT_NAMES_FR[eventId] ?? eventId;
  const en = EVENT_NAMES_EN[eventId] ?? eventId;
  return language === 'bilingual-fr' ? fr : en;
}
