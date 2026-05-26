import type { Language } from '../types/settings';

// ── Cover card strings ────────────────────────────────────────────────────────
export interface CoverCardStrings {
  forDelegate: string;
  bundledScorecards: (n: number | string) => string;
  checkedSignatures: string;
  incidentsCount: string;
  delegateInitials: string;
  forDataEntry: string;
  resultsEntered: string;
  scoretakerInitials: string;
  incidentsLogged: string;
  resultsChecked: string;
}

// ── Schedule tracker strings ──────────────────────────────────────────────────
export interface ScheduleStrings {
  title: string;
  estimatedStart: string;
  estimatedEnd: string;
  event: string;
  actualStart: string;
  actualEnd: string;
  numberOfCompetitors: string;
}

// ── Nametag duty strings ──────────────────────────────────────────────────────
export interface NametTagStrings {
  compete: string;
  scramble: string;
  judge: string;
  run: string;
}

// ── Scorecard strings (used in PDF rendering) ─────────────────────────────────
export interface ScorecardStrings {
  scrambler: string;
  attempt: string;
  judge: string;
  competitor: string;
  resultPrefix: string;
  dnfSuffix: (limit: string) => string;
  cumulativeSuffix: (limit: string) => string;
  mbfSuffix: string;
  cutoffLine: (cutoff: string, mo3: boolean) => string;
  provisionalLine: string;
  newCompetitor: string;
  newCompetitorF: string;
  roundName: (n: number, total: number) => string;
  finalRound: string;
  cover: CoverCardStrings;
}

// ── English ───────────────────────────────────────────────────────────────────
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
  cover: {
    forDelegate: 'FOR DELEGATE',
    bundledScorecards: (n) => `1. Bundled all ${n} scorecards`,
    checkedSignatures: '2. Checked for missing signatures',
    incidentsCount: '3. Number of scorecards with incidents: _____',
    delegateInitials: 'Delegate Initials ______',
    forDataEntry: 'FOR DATA ENTRY',
    resultsEntered: '4. Results entered by Scoretaker',
    scoretakerInitials: 'Scoretaker Initials ______',
    incidentsLogged: '5. Incidents logged by Delegate',
    resultsChecked: '6. Results checked by Delegate',
  },
};

// ── French ────────────────────────────────────────────────────────────────────
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
  cover: {
    forDelegate: 'POUR LE DÉLÉGUÉ',
    bundledScorecards: (n) => `1. Regroupé toutes les ${n} feuilles`,
    checkedSignatures: '2. Vérifié les signatures manquantes',
    incidentsCount: '3. Nombre de feuilles avec incidents : _____',
    delegateInitials: 'Initiales du Délégué ______',
    forDataEntry: 'POUR LA SAISIE DES DONNÉES',
    resultsEntered: '4. Résultats saisis par le Marqueur',
    scoretakerInitials: 'Initiales du Marqueur ______',
    incidentsLogged: '5. Incidents enregistrés par le Délégué',
    resultsChecked: '6. Résultats vérifiés par le Délégué',
  },
};

// ── Spanish ───────────────────────────────────────────────────────────────────
const ES: ScorecardStrings = {
  scrambler: 'Mezclador',
  attempt: 'Intento',
  judge: 'Juez',
  competitor: 'Competidor',
  resultPrefix: 'Resultado',
  dnfSuffix: (limit) => `(DNF si no es inferior a ${limit})`,
  cumulativeSuffix: (limit) => `(Límite de tiempo acumulado: ${limit})`,
  mbfSuffix: '(Límite: Reg. H1b)',
  cutoffLine: (cutoff, mo3) =>
    mo3
      ? `─── Continuar si el Intento 1 es inferior a ${cutoff} ───`
      : `─── Continuar si el Intento 1 o 2 es inferior a ${cutoff} ───`,
  provisionalLine: '─── Intento extra o provisional (Iniciales del Delegado _______) ───',
  newCompetitor: 'Nuevo Competidor',
  newCompetitorF: 'Nueva Competidora',
  roundName: (n, total) => `Ronda ${n} de ${total}`,
  finalRound: 'Ronda Final',
  cover: {
    forDelegate: 'PARA EL DELEGADO',
    bundledScorecards: (n) => `1. Agrupadas todas las ${n} hojas`,
    checkedSignatures: '2. Verificadas las firmas faltantes',
    incidentsCount: '3. Número de hojas con incidentes: _____',
    delegateInitials: 'Iniciales del Delegado ______',
    forDataEntry: 'PARA INGRESO DE DATOS',
    resultsEntered: '4. Resultados ingresados por el Anotador',
    scoretakerInitials: 'Iniciales del Anotador ______',
    incidentsLogged: '5. Incidentes registrados por el Delegado',
    resultsChecked: '6. Resultados verificados por el Delegado',
  },
};

export function getStrings(language: Language): ScorecardStrings {
  if (language === 'en') return EN;
  if (language === 'fr') return FR;
  if (language === 'es') return ES;
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
    cover: primary.cover,
  };
}

// ── Schedule tracker strings ───────────────────────────────────────────────────
const SCHEDULE_EN: ScheduleStrings = {
  title: '— Schedule Tracker',
  estimatedStart: 'Estimated\nStart Time',
  estimatedEnd: 'Estimated\nEnd Time',
  event: 'Event',
  actualStart: 'Actual\nStart Time',
  actualEnd: 'Actual\nEnd Time',
  numberOfCompetitors: 'Number of\nCompetitors',
};

const SCHEDULE_FR: ScheduleStrings = {
  title: '— Suivi du calendrier',
  estimatedStart: 'Heure de\ndébut estimée',
  estimatedEnd: 'Heure de\nfin estimée',
  event: 'Épreuve',
  actualStart: 'Heure de\ndébut réelle',
  actualEnd: 'Heure de\nfin réelle',
  numberOfCompetitors: 'Nombre de\ncompétiteurs',
};

const SCHEDULE_ES: ScheduleStrings = {
  title: '— Seguimiento del Horario',
  estimatedStart: 'Hora de\ninicio estimada',
  estimatedEnd: 'Hora de\nfin estimada',
  event: 'Evento',
  actualStart: 'Hora de\ninicio real',
  actualEnd: 'Hora de\nfin real',
  numberOfCompetitors: 'Número de\ncompetidores',
};

export function getScheduleStrings(language: Language): ScheduleStrings {
  if (language === 'fr' || language === 'bilingual-fr') return SCHEDULE_FR;
  if (language === 'es') return SCHEDULE_ES;
  return SCHEDULE_EN;
}

// ── Nametag duty strings ───────────────────────────────────────────────────────
const NAMETAG_EN: NametTagStrings = {
  compete: 'Compete:',
  scramble: 'Scramble:',
  judge: 'Judge:',
  run: 'Run:',
};

const NAMETAG_FR: NametTagStrings = {
  compete: 'Concourir:',
  scramble: 'Mélanger:',
  judge: 'Juger:',
  run: 'Courir:',
};

const NAMETAG_ES: NametTagStrings = {
  compete: 'Competir:',
  scramble: 'Mezclar:',
  judge: 'Juzgar:',
  run: 'Correr:',
};

export function getNametTagStrings(language: Language): NametTagStrings {
  if (language === 'fr' || language === 'bilingual-fr') return NAMETAG_FR;
  if (language === 'es') return NAMETAG_ES;
  return NAMETAG_EN;
}

// ── Event names ────────────────────────────────────────────────────────────────
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

export const EVENT_NAMES_ES: Record<string, string> = {
  '333': 'Cubo 3x3x3', '222': 'Cubo 2x2x2', '444': 'Cubo 4x4x4',
  '555': 'Cubo 5x5x5', '666': 'Cubo 6x6x6', '777': 'Cubo 7x7x7',
  '333bf': '3x3x3 A Ciegas', '333fm': 'FMC', '333oh': '3x3x3 Una Mano',
  'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 A Ciegas',
  '555bf': '5x5x5 A Ciegas', '333mbf': '3x3x3 Multi-BLD',
};

export function getEventName(eventId: string, language: Language): string {
  if (language === 'en') return EVENT_NAMES_EN[eventId] ?? eventId;
  if (language === 'fr') return EVENT_NAMES_FR[eventId] ?? eventId;
  if (language === 'es') return EVENT_NAMES_ES[eventId] ?? eventId;
  const fr = EVENT_NAMES_FR[eventId] ?? eventId;
  const en = EVENT_NAMES_EN[eventId] ?? eventId;
  return language === 'bilingual-fr' ? fr : en;
}
