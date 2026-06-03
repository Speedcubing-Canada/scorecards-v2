import type { LocaleCode } from '../types/settings';

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
  dutyGroup: (groupList: string) => string;
}

// ── Nametag title strings (role badge on each panel) ──────────────────────────
export interface NametTagTitleStrings {
  delegate: (isFemale: boolean) => string;
  organizer: (isFemale: boolean) => string;
  newCompetitor: (isFemale: boolean) => string;
  competitor: (isFemale: boolean) => string;
}

// ── Scorecard strings (used in PDF rendering) ─────────────────────────────────
export interface ScorecardStrings {
  scrambler: string;
  scramblerCheck: string;
  attempt: string;
  judge: string;
  competitor: string;
  resultPrefix: string;
  dnfSuffix: (limit: string) => string;
  cumulativeSuffix: (limit: string) => string;
  // Compact forms used in the 6-column (double-check) header where the result column is narrower.
  shortDnfSuffix: (limit: string) => string;
  shortCumulativeSuffix: (limit: string) => string;
  mbfSuffix: string;
  cutoffLine: (cutoff: string, mo3: boolean) => string;
  provisionalLine: string;
  newCompetitor: string;
  newCompetitorF: string;
  roundName: (n: number, total: number) => string;
  finalRound: string;
  groupLabel: (gNum: string | number, total: number) => string;
  colorGroupLabel: (color: string, gNum: string | number, total: number) => string;
  blankGroupLabel: (total: number) => string;
  stationLabel: (n: string) => string;
  seatLabel: (n: string) => string;
  cover: CoverCardStrings;
}

// ── English ───────────────────────────────────────────────────────────────────
const EN: ScorecardStrings = {
  scrambler: 'Scrambler',
  scramblerCheck: 'Check',
  attempt: 'Attempt',
  judge: 'Judge',
  competitor: 'Competitor',
  resultPrefix: 'Result',
  dnfSuffix: (limit) => `(DNF if not under ${limit})`,
  cumulativeSuffix: (limit) => `(Cumulative Time Limit: ${limit})`,
  shortDnfSuffix: (limit) => `(DNF if <${limit})`,
  shortCumulativeSuffix: (limit) => `(cumul. <${limit})`,
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
  groupLabel: (gNum, total) => `Group ${gNum} of ${total}`,
  colorGroupLabel: (color, gNum, total) => `${color} ${gNum} of ${total}`,
  blankGroupLabel: (total) => `Group _ of ${total}`,
  stationLabel: (n) => `Station ${n}`,
  seatLabel: (n) => `Seat ${n}`,
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
  scramblerCheck: 'Vérif.',
  attempt: 'Essai',
  judge: 'Juge',
  competitor: 'Compétiteur',
  resultPrefix: 'Résultat',
  dnfSuffix: (limit) => `(DNF si n'est pas inférieur à ${limit})`,
  cumulativeSuffix: (limit) => `(Limite de Temps Cumul.: ${limit})`,
  shortDnfSuffix: (limit) => `(DNF si <${limit})`,
  shortCumulativeSuffix: (limit) => `(cumul. <${limit})`,
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
  groupLabel: (gNum, total) => `Groupe ${gNum} de ${total}`,
  colorGroupLabel: (color, gNum, total) => `${color} ${gNum} de ${total}`,
  blankGroupLabel: (total) => `Groupe _ de ${total}`,
  stationLabel: (n) => `Siège ${n}`,
  seatLabel: (n) => `Siège ${n}`,
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
  scramblerCheck: 'Verif.',
  attempt: 'Intento',
  judge: 'Juez',
  competitor: 'Competidor',
  resultPrefix: 'Resultado',
  dnfSuffix: (limit) => `(DNF si no es inferior a ${limit})`,
  cumulativeSuffix: (limit) => `(Límite de tiempo acumulado: ${limit})`,
  shortDnfSuffix: (limit) => `(DNF si <${limit})`,
  shortCumulativeSuffix: (limit) => `(acum. <${limit})`,
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
  groupLabel: (gNum, total) => `Grupo ${gNum} de ${total}`,
  colorGroupLabel: (color, gNum, total) => `${color} ${gNum} de ${total}`,
  blankGroupLabel: (total) => `Grupo _ de ${total}`,
  stationLabel: (n) => `Estación ${n}`,
  seatLabel: (n) => `Asiento ${n}`,
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

// ── Portuguese (Brazil) ─────────────────────────────────────────────────────────
const PT: ScorecardStrings = {
  scrambler: 'Misturador',
  scramblerCheck: 'Verif.',
  attempt: 'Tentativa',
  judge: 'Juiz',
  competitor: 'Competidor',
  resultPrefix: 'Resultado',
  dnfSuffix: (limit) => `(DNF se não for inferior a ${limit})`,
  cumulativeSuffix: (limit) => `(Limite de Tempo Acumulado: ${limit})`,
  shortDnfSuffix: (limit) => `(DNF se <${limit})`,
  shortCumulativeSuffix: (limit) => `(acum. <${limit})`,
  mbfSuffix: '(Limite: Reg. H1b)',
  cutoffLine: (cutoff, mo3) =>
    mo3
      ? `─── Continue se a Tentativa 1 for inferior a ${cutoff} ───`
      : `─── Continue se a Tentativa 1 ou 2 for inferior a ${cutoff} ───`,
  provisionalLine: '─── Tentativa extra ou provisória (Iniciais do Delegado _______) ───',
  newCompetitor: 'Novo Competidor',
  newCompetitorF: 'Nova Competidora',
  roundName: (n, total) => `Rodada ${n} de ${total}`,
  finalRound: 'Rodada Final',
  groupLabel: (gNum, total) => `Grupo ${gNum} de ${total}`,
  colorGroupLabel: (color, gNum, total) => `${color} ${gNum} de ${total}`,
  blankGroupLabel: (total) => `Grupo _ de ${total}`,
  stationLabel: (n) => `Estação ${n}`,
  seatLabel: (n) => `Assento ${n}`,
  cover: {
    forDelegate: 'PARA O DELEGADO',
    bundledScorecards: (n) => `1. Agrupadas todas as ${n} folhas`,
    checkedSignatures: '2. Verificadas as assinaturas faltantes',
    incidentsCount: '3. Número de folhas com incidentes: _____',
    delegateInitials: 'Iniciais do Delegado ______',
    forDataEntry: 'PARA ENTRADA DE DADOS',
    resultsEntered: '4. Resultados inseridos pelo Anotador',
    scoretakerInitials: 'Iniciais do Anotador ______',
    incidentsLogged: '5. Incidentes registrados pelo Delegado',
    resultsChecked: '6. Resultados verificados pelo Delegado',
  },
};

/**
 * Merge two languages' scorecard strings for a dual-language scorecard.
 * Column headers and the cut-off/provisional lines stack both languages
 * (`primary\nsecondary`); everything else (round/group/seat labels, cover) uses
 * the primary language only. This is the single place that defines which fields
 * are bilingual — adding a language never touches it.
 */
function mergeScorecardStrings(primary: ScorecardStrings, secondary: ScorecardStrings): ScorecardStrings {
  return {
    scrambler: `${primary.scrambler}\n${secondary.scrambler}`,
    scramblerCheck: `${primary.scramblerCheck}\n${secondary.scramblerCheck}`,
    attempt: `${primary.attempt}\n${secondary.attempt}`,
    judge: `${primary.judge}\n${secondary.judge}`,
    competitor: `${primary.competitor}\n${secondary.competitor}`,
    resultPrefix: `${primary.resultPrefix}\n${secondary.resultPrefix}`,
    dnfSuffix: (limit) => `${primary.dnfSuffix(limit)}\n${secondary.dnfSuffix(limit)}`,
    cumulativeSuffix: (limit) => `${primary.cumulativeSuffix(limit)}\n${secondary.cumulativeSuffix(limit)}`,
    shortDnfSuffix: (limit) => `${primary.shortDnfSuffix(limit)}\n${secondary.shortDnfSuffix(limit)}`,
    shortCumulativeSuffix: (limit) => `${primary.shortCumulativeSuffix(limit)}\n${secondary.shortCumulativeSuffix(limit)}`,
    mbfSuffix: primary.mbfSuffix,
    cutoffLine: (cutoff, mo3) => `${primary.cutoffLine(cutoff, mo3)}\n${secondary.cutoffLine(cutoff, mo3)}`,
    provisionalLine: `${primary.provisionalLine}\n${secondary.provisionalLine}`,
    newCompetitor: primary.newCompetitor,
    newCompetitorF: primary.newCompetitorF,
    roundName: (n, total) => `${primary.roundName(n, total)}`,
    finalRound: primary.finalRound,
    groupLabel: (gNum, total) => primary.groupLabel(gNum, total),
    colorGroupLabel: (color, gNum, total) => primary.colorGroupLabel(color, gNum, total),
    blankGroupLabel: (total) => primary.blankGroupLabel(total),
    stationLabel: (n) => primary.stationLabel(n),
    seatLabel: (n) => primary.seatLabel(n),
    cover: primary.cover,
  };
}

/**
 * Scorecard strings for a primary language, optionally merged with a secondary.
 * `secondary` of `null`/`undefined` (or equal to primary) ⇒ single language.
 */
export function getStrings(language: LocaleCode, secondary?: LocaleCode | null): ScorecardStrings {
  const primary = LOCALES[language].scorecard;
  if (!secondary || secondary === language) return primary;
  return mergeScorecardStrings(primary, LOCALES[secondary].scorecard);
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

const SCHEDULE_PT: ScheduleStrings = {
  title: '— Acompanhamento de Horário',
  estimatedStart: 'Horário de\nInício Estimado',
  estimatedEnd: 'Horário de\nTérmino Estimado',
  event: 'Evento',
  actualStart: 'Horário de\nInício Real',
  actualEnd: 'Horário de\nTérmino Real',
  numberOfCompetitors: 'Número de\nCompetidores',
};

export function getScheduleStrings(language: LocaleCode): ScheduleStrings {
  return LOCALES[language].schedule;
}

// ── Nametag duty strings ───────────────────────────────────────────────────────
const NAMETAG_EN: NametTagStrings = {
  compete: 'Compete:',
  scramble: 'Scramble:',
  judge: 'Judge:',
  run: 'Run:',
  dutyGroup: (g) => `Group ${g}`,
};

const NAMETAG_FR: NametTagStrings = {
  compete: 'Concourir:',
  scramble: 'Mélanger:',
  judge: 'Juger:',
  run: 'Courir:',
  dutyGroup: (g) => `Groupe ${g}`,
};

const NAMETAG_ES: NametTagStrings = {
  compete: 'Competir:',
  scramble: 'Mezclar:',
  judge: 'Juzgar:',
  run: 'Correr:',
  dutyGroup: (g) => `Grupo ${g}`,
};

const NAMETAG_PT: NametTagStrings = {
  compete: 'Competir:',
  scramble: 'Misturar:',
  judge: 'Julgar:',
  run: 'Correr:',
  dutyGroup: (g) => `Grupo ${g}`,
};

export function getNametTagStrings(language: LocaleCode): NametTagStrings {
  return LOCALES[language].nametag;
}

// ── Nametag title strings ──────────────────────────────────────────────────────
const NAMETAG_TITLE_EN: NametTagTitleStrings = {
  delegate:     () => 'DELEGATE',
  organizer:    () => 'ORGANIZER',
  newCompetitor: () => 'NEW COMPETITOR',
  competitor:   () => 'COMPETITOR',
};

const NAMETAG_TITLE_FR: NametTagTitleStrings = {
  delegate:     (f) => f ? 'DÉLÉGUÉE' : 'DÉLÉGUÉ',
  organizer:    (f) => f ? 'ORGANISATRICE' : 'ORGANISATEUR',
  newCompetitor: (f) => f ? 'NOUVELLE COMPÉTITRICE' : 'NOUVEAU COMPÉTITEUR',
  competitor:   (f) => f ? 'COMPÉTITRICE' : 'COMPÉTITEUR',
};

const NAMETAG_TITLE_ES: NametTagTitleStrings = {
  delegate:     (f) => f ? 'DELEGADA' : 'DELEGADO',
  organizer:    (f) => f ? 'ORGANIZADORA' : 'ORGANIZADOR',
  newCompetitor: (f) => f ? 'NUEVA COMPETIDORA' : 'NUEVO COMPETIDOR',
  competitor:   (f) => f ? 'COMPETIDORA' : 'COMPETIDOR',
};

const NAMETAG_TITLE_PT: NametTagTitleStrings = {
  delegate:     (f) => f ? 'DELEGADA' : 'DELEGADO',
  organizer:    (f) => f ? 'ORGANIZADORA' : 'ORGANIZADOR',
  newCompetitor: (f) => f ? 'NOVA COMPETIDORA' : 'NOVO COMPETIDOR',
  competitor:   (f) => f ? 'COMPETIDORA' : 'COMPETIDOR',
};

/**
 * Role-badge titles for the two name-tag panels. The front panel uses the
 * primary language; the back panel uses the secondary language when set,
 * otherwise the primary (single-language ⇒ both panels match). This generalizes
 * the old bilingual front=FR/back=EN behavior to any language pair.
 */
export function getNametTagTitleStrings(
  language: LocaleCode,
  secondary?: LocaleCode | null,
): { front: NametTagTitleStrings; back: NametTagTitleStrings } {
  return {
    front: LOCALES[language].title,
    back: LOCALES[secondary ?? language].title,
  };
}

// ── Short event names for nametag duty labels ──────────────────────────────────
const SHORT_NAMETAG_NAMES_EN: Record<string, string> = {
  '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
  '666': '6x6x6', '777': '7x7x7', '333bf': '3x3x3 BLD', '333fm': 'FMC',
  '333oh': 'One-Hand', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 BLD', '555bf': '5x5x5 BLD',
  '333mbf': 'Multi-BLD',
};

const SHORT_NAMETAG_NAMES_FR: Record<string, string> = {
  '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
  '666': '6x6x6', '777': '7x7x7', '333bf': '3x3x3 BLD', '333fm': 'FMC',
  '333oh': 'À une main', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 BLD', '555bf': '5x5x5 BLD',
  '333mbf': 'Multi-BLD',
};

const SHORT_NAMETAG_NAMES_ES: Record<string, string> = {
  '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
  '666': '6x6x6', '777': '7x7x7', '333bf': '3x3x3 BLD', '333fm': 'FMC',
  '333oh': 'Una mano', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 BLD', '555bf': '5x5x5 BLD',
  '333mbf': 'Multi-BLD',
};

const SHORT_NAMETAG_NAMES_PT: Record<string, string> = {
  '333': '3x3x3', '222': '2x2x2', '444': '4x4x4', '555': '5x5x5',
  '666': '6x6x6', '777': '7x7x7', '333bf': '3x3x3 BLD', '333fm': 'FMC',
  '333oh': 'Uma Mão', 'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 BLD', '555bf': '5x5x5 BLD',
  '333mbf': 'Multi-BLD',
};

export function getShortNametTagNames(language: LocaleCode): Record<string, string> {
  return LOCALES[language].shortNames;
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

export const EVENT_NAMES_PT: Record<string, string> = {
  '333': 'Cubo 3x3x3', '222': 'Cubo 2x2x2', '444': 'Cubo 4x4x4',
  '555': 'Cubo 5x5x5', '666': 'Cubo 6x6x6', '777': 'Cubo 7x7x7',
  '333bf': '3x3x3 Às Cegas', '333fm': 'FMC', '333oh': '3x3x3 Uma Mão',
  'clock': 'Clock', 'minx': 'Megaminx', 'pyram': 'Pyraminx',
  'skewb': 'Skewb', 'sq1': 'Square-1', '444bf': '4x4x4 Às Cegas',
  '555bf': '5x5x5 Às Cegas', '333mbf': '3x3x3 Multi-BLD',
};

export function getEventName(eventId: string, language: LocaleCode): string {
  return LOCALES[language].eventNames[eventId] ?? eventId;
}

// ── Locale registry ────────────────────────────────────────────────────────────
// Single source of truth tying every per-language string set to its code. Adding
// a language = add its string objects above and one entry here (plus a UI JSON +
// registry entry in src/i18n/index.ts). No getter or merge logic needs touching.
interface LocaleBundle {
  scorecard: ScorecardStrings;
  schedule: ScheduleStrings;
  nametag: NametTagStrings;
  title: NametTagTitleStrings;
  shortNames: Record<string, string>;
  eventNames: Record<string, string>;
}

const LOCALES: Record<LocaleCode, LocaleBundle> = {
  en: { scorecard: EN, schedule: SCHEDULE_EN, nametag: NAMETAG_EN, title: NAMETAG_TITLE_EN, shortNames: SHORT_NAMETAG_NAMES_EN, eventNames: EVENT_NAMES_EN },
  fr: { scorecard: FR, schedule: SCHEDULE_FR, nametag: NAMETAG_FR, title: NAMETAG_TITLE_FR, shortNames: SHORT_NAMETAG_NAMES_FR, eventNames: EVENT_NAMES_FR },
  es: { scorecard: ES, schedule: SCHEDULE_ES, nametag: NAMETAG_ES, title: NAMETAG_TITLE_ES, shortNames: SHORT_NAMETAG_NAMES_ES, eventNames: EVENT_NAMES_ES },
  pt: { scorecard: PT, schedule: SCHEDULE_PT, nametag: NAMETAG_PT, title: NAMETAG_TITLE_PT, shortNames: SHORT_NAMETAG_NAMES_PT, eventNames: EVENT_NAMES_PT },
};
