import { describe, it, expect } from 'vitest';
import { getStrings, getScheduleStrings, getNametTagStrings, getNametTagTitleStrings, getShortNametTagNames, getEventName } from './i18n';

describe('getStrings', () => {
  it('returns Spanish strings for "es"', () => {
    const s = getStrings('es');
    expect(s.scrambler).toBe('Mezclador');
    expect(s.attempt).toBe('Intento');
    expect(s.judge).toBe('Juez');
    expect(s.competitor).toBe('Competidor');
    expect(s.resultPrefix).toBe('Resultado');
  });

  it('Spanish cover card strings', () => {
    const { cover } = getStrings('es');
    expect(cover.forDelegate).toBe('PARA EL DELEGADO');
    expect(cover.forDataEntry).toBe('PARA INGRESO DE DATOS');
    expect(cover.bundledScorecards(12)).toBe('1. Agrupadas todas las 12 hojas');
    expect(cover.checkedSignatures).toBe('2. Verificadas las firmas faltantes');
    expect(cover.delegateInitials).toBe('Iniciales del Delegado ______');
  });

  it('English cover card strings', () => {
    const { cover } = getStrings('en');
    expect(cover.forDelegate).toBe('FOR DELEGATE');
    expect(cover.forDataEntry).toBe('FOR DATA ENTRY');
    expect(cover.bundledScorecards(5)).toBe('1. Bundled all 5 scorecards');
    expect(cover.delegateInitials).toBe('Delegate Initials ______');
  });

  it('French cover card strings', () => {
    const { cover } = getStrings('fr');
    expect(cover.forDelegate).toBe('POUR LE DÉLÉGUÉ');
    expect(cover.forDataEntry).toBe('POUR LA SAISIE DES DONNÉES');
    expect(cover.bundledScorecards(3)).toBe('1. Regroupé toutes les 3 feuilles');
  });

  it('bilingual-fr still merges EN+FR (not ES)', () => {
    const s = getStrings('bilingual-fr');
    expect(s.scrambler).toContain('Mélangeur');
    expect(s.scrambler).toContain('Scrambler');
    expect(s.scrambler).not.toContain('Mezclador');
    // cover comes from primary (FR)
    expect(s.cover.forDelegate).toBe('POUR LE DÉLÉGUÉ');
  });

  it('bilingual-en still merges EN+FR (not ES)', () => {
    const s = getStrings('bilingual-en');
    expect(s.scrambler).toContain('Scrambler');
    expect(s.scrambler).toContain('Mélangeur');
    expect(s.scrambler).not.toContain('Mezclador');
    // cover comes from primary (EN)
    expect(s.cover.forDelegate).toBe('FOR DELEGATE');
  });

  it('Spanish roundName', () => {
    const s = getStrings('es');
    expect(s.roundName(1, 3)).toBe('Ronda 1 de 3');
    expect(s.finalRound).toBe('Ronda Final');
  });

  it('Spanish newCompetitor gender variants', () => {
    const s = getStrings('es');
    expect(s.newCompetitor).toBe('Nuevo Competidor');
    expect(s.newCompetitorF).toBe('Nueva Competidora');
  });

  it('Spanish dnfSuffix and cutoffLine', () => {
    const s = getStrings('es');
    expect(s.dnfSuffix('1:00')).toBe('(DNF si no es inferior a 1:00)');
    expect(s.cutoffLine('30.00', false)).toBe('─── Continuar si el Intento 1 o 2 es inferior a 30.00 ───');
    expect(s.cutoffLine('30.00', true)).toBe('─── Continuar si el Intento 1 es inferior a 30.00 ───');
  });
});

describe('getScheduleStrings', () => {
  it('returns English strings by default', () => {
    const s = getScheduleStrings('en');
    expect(s.event).toBe('Event');
    expect(s.title).toBe('— Schedule Tracker');
    expect(s.estimatedStart).toBe('Estimated\nStart Time');
    expect(s.numberOfCompetitors).toBe('Number of\nCompetitors');
  });

  it('returns French strings for fr', () => {
    const s = getScheduleStrings('fr');
    expect(s.event).toBe('Épreuve');
    expect(s.title).toBe('— Suivi du calendrier');
  });

  it('returns French strings for bilingual-fr', () => {
    const s = getScheduleStrings('bilingual-fr');
    expect(s.event).toBe('Épreuve');
  });

  it('returns Spanish strings for es', () => {
    const s = getScheduleStrings('es');
    expect(s.event).toBe('Evento');
    expect(s.title).toBe('— Seguimiento del Horario');
    expect(s.estimatedStart).toBe('Hora de\ninicio estimada');
    expect(s.numberOfCompetitors).toBe('Número de\ncompetidores');
  });

  it('bilingual-en falls back to English', () => {
    const s = getScheduleStrings('bilingual-en');
    expect(s.event).toBe('Event');
  });
});

describe('getNametTagStrings', () => {
  it('returns English strings', () => {
    const s = getNametTagStrings('en');
    expect(s.compete).toBe('Compete:');
    expect(s.scramble).toBe('Scramble:');
    expect(s.judge).toBe('Judge:');
    expect(s.run).toBe('Run:');
  });

  it('returns French strings for fr', () => {
    const s = getNametTagStrings('fr');
    expect(s.compete).toBe('Concourir:');
    expect(s.scramble).toBe('Mélanger:');
    expect(s.judge).toBe('Juger:');
    expect(s.run).toBe('Courir:');
  });

  it('returns French strings for bilingual-fr', () => {
    const s = getNametTagStrings('bilingual-fr');
    expect(s.compete).toBe('Concourir:');
  });

  it('returns Spanish strings for es', () => {
    const s = getNametTagStrings('es');
    expect(s.compete).toBe('Competir:');
    expect(s.scramble).toBe('Mezclar:');
    expect(s.judge).toBe('Juzgar:');
    expect(s.run).toBe('Correr:');
  });

  it('bilingual-en falls back to English', () => {
    const s = getNametTagStrings('bilingual-en');
    expect(s.compete).toBe('Compete:');
  });
});

describe('getEventName', () => {
  it('English event names', () => {
    expect(getEventName('333', 'en')).toBe('3x3x3 Cube');
    expect(getEventName('333mbf', 'en')).toBe('3x3x3 Multi-Blind');
  });

  it('French event names', () => {
    expect(getEventName('333', 'fr')).toBe('Cube 3x3x3');
    expect(getEventName('333mbf', 'fr')).toBe('Multi-BLD');
  });

  it('Spanish event names', () => {
    expect(getEventName('333', 'es')).toBe('Cubo 3x3x3');
    expect(getEventName('333bf', 'es')).toBe('3x3x3 A Ciegas');
    expect(getEventName('333oh', 'es')).toBe('3x3x3 Una Mano');
    expect(getEventName('333mbf', 'es')).toBe('3x3x3 Multi-BLD');
  });

  it('bilingual-fr returns French name', () => {
    expect(getEventName('333', 'bilingual-fr')).toBe('Cube 3x3x3');
  });

  it('bilingual-en returns English name', () => {
    expect(getEventName('333', 'bilingual-en')).toBe('3x3x3 Cube');
  });

  it('unknown event falls back to eventId', () => {
    expect(getEventName('unknown', 'es')).toBe('unknown');
  });
});

describe('getNametTagTitleStrings', () => {
  it('English — no gender distinction', () => {
    const { front, back } = getNametTagTitleStrings('en');
    expect(front.delegate(false)).toBe('DELEGATE');
    expect(front.delegate(true)).toBe('DELEGATE');
    expect(front.organizer(false)).toBe('ORGANIZER');
    expect(front.competitor(false)).toBe('COMPETITOR');
    expect(front.newCompetitor(false)).toBe('NEW COMPETITOR');
    expect(back.delegate(false)).toBe('DELEGATE');
  });

  it('French — gender-aware titles', () => {
    const { front, back } = getNametTagTitleStrings('fr');
    expect(front.delegate(false)).toBe('DÉLÉGUÉ');
    expect(front.delegate(true)).toBe('DÉLÉGUÉE');
    expect(front.organizer(false)).toBe('ORGANISATEUR');
    expect(front.organizer(true)).toBe('ORGANISATRICE');
    expect(front.competitor(false)).toBe('COMPÉTITEUR');
    expect(front.competitor(true)).toBe('COMPÉTITRICE');
    expect(front.newCompetitor(false)).toBe('NOUVEAU COMPÉTITEUR');
    expect(front.newCompetitor(true)).toBe('NOUVELLE COMPÉTITRICE');
    expect(back.delegate(false)).toBe('DÉLÉGUÉ');
  });

  it('Spanish — gender-aware titles', () => {
    const { front, back } = getNametTagTitleStrings('es');
    expect(front.delegate(false)).toBe('DELEGADO');
    expect(front.delegate(true)).toBe('DELEGADA');
    expect(front.organizer(false)).toBe('ORGANIZADOR');
    expect(front.organizer(true)).toBe('ORGANIZADORA');
    expect(front.competitor(false)).toBe('COMPETIDOR');
    expect(front.competitor(true)).toBe('COMPETIDORA');
    expect(front.newCompetitor(false)).toBe('NUEVO COMPETIDOR');
    expect(front.newCompetitor(true)).toBe('NUEVA COMPETIDORA');
    expect(back.delegate(false)).toBe('DELEGADO');
  });

  it('bilingual-fr: front=FR, back=EN', () => {
    const { front, back } = getNametTagTitleStrings('bilingual-fr');
    expect(front.delegate(false)).toBe('DÉLÉGUÉ');
    expect(back.delegate(false)).toBe('DELEGATE');
  });

  it('bilingual-en: front=EN, back=FR', () => {
    const { front, back } = getNametTagTitleStrings('bilingual-en');
    expect(front.delegate(false)).toBe('DELEGATE');
    expect(back.delegate(false)).toBe('DÉLÉGUÉ');
  });
});

describe('getNametTagStrings dutyGroup', () => {
  it('French duty group', () => expect(getNametTagStrings('fr').dutyGroup('1 & 2')).toBe('Groupe 1 & 2'));
  it('Spanish duty group', () => expect(getNametTagStrings('es').dutyGroup('1 & 2')).toBe('Grupo 1 & 2'));
  it('English duty group', () => expect(getNametTagStrings('en').dutyGroup('1 & 2')).toBe('Group 1 & 2'));
  it('bilingual-fr duty group uses French', () => expect(getNametTagStrings('bilingual-fr').dutyGroup('1')).toBe('Groupe 1'));
});

describe('getShortNametTagNames', () => {
  it('French: 333oh is "À une main"', () => expect(getShortNametTagNames('fr')['333oh']).toBe('À une main'));
  it('Spanish: 333oh is "Una mano"', () => expect(getShortNametTagNames('es')['333oh']).toBe('Una mano'));
  it('English: 333oh is "One-Hand"', () => expect(getShortNametTagNames('en')['333oh']).toBe('One-Hand'));
  it('bilingual-fr uses French names', () => expect(getShortNametTagNames('bilingual-fr')['333oh']).toBe('À une main'));
  it('common names are the same across languages', () => {
    const fr = getShortNametTagNames('fr');
    const es = getShortNametTagNames('es');
    expect(fr['333']).toBe('3x3x3');
    expect(es['333']).toBe('3x3x3');
    expect(fr['333fm']).toBe('FMC');
    expect(es['333fm']).toBe('FMC');
  });
});

describe('getStrings seat/station labels', () => {
  it('English: Station and Seat', () => {
    const s = getStrings('en');
    expect(s.stationLabel('03')).toBe('Station 03');
    expect(s.seatLabel('03')).toBe('Seat 03');
  });
  it('French: both are Siège', () => {
    const s = getStrings('fr');
    expect(s.stationLabel('03')).toBe('Siège 03');
    expect(s.seatLabel('03')).toBe('Siège 03');
  });
  it('Spanish: Estación and Asiento', () => {
    const s = getStrings('es');
    expect(s.stationLabel('03')).toBe('Estación 03');
    expect(s.seatLabel('03')).toBe('Asiento 03');
  });
  it('bilingual-fr uses French labels', () => {
    const s = getStrings('bilingual-fr');
    expect(s.stationLabel('01')).toBe('Siège 01');
    expect(s.seatLabel('01')).toBe('Siège 01');
  });
});
