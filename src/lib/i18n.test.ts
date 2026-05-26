import { describe, it, expect } from 'vitest';
import { getStrings, getScheduleStrings, getNametTagStrings, getEventName } from './i18n';

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
