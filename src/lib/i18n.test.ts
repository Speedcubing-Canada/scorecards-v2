import { describe, it, expect } from 'vitest';
import { getStrings, getScheduleStrings, getCheckingSheetStrings, getNametTagStrings, getNametTagTitleStrings, getShortNametTagNames, getEventName, splitLabelTotal } from './i18n';

describe('ofConnector', () => {
  it('is "of" in English and "de" in FR/ES/PT', () => {
    expect(getStrings('en').ofConnector).toBe('of');
    expect(getStrings('fr').ofConnector).toBe('de');
    expect(getStrings('es').ofConnector).toBe('de');
    expect(getStrings('pt').ofConnector).toBe('de');
  });

  it('uses the primary language connector when merged (labels are primary-only)', () => {
    expect(getStrings('fr', 'en').ofConnector).toBe('de');
    expect(getStrings('en', 'fr').ofConnector).toBe('of');
  });
});

describe('splitLabelTotal', () => {
  it('splits the trailing "of Y" off a group/round label', () => {
    expect(splitLabelTotal('Group 1 of 2', 'of')).toEqual({ head: 'Group 1', tail: ' of 2' });
    expect(splitLabelTotal('Round 1 of 3', 'of')).toEqual({ head: 'Round 1', tail: ' of 3' });
  });

  it('splits "de Y" for French/Spanish/Portuguese labels', () => {
    expect(splitLabelTotal('Groupe 1 de 2', 'de')).toEqual({ head: 'Groupe 1', tail: ' de 2' });
    expect(splitLabelTotal('Grupo 1 de 3', 'de')).toEqual({ head: 'Grupo 1', tail: ' de 3' });
  });

  it('splits on the LAST connector so colour/stage names are untouched', () => {
    // "Bleu 1 de 2" - the colour stays in head, only " de 2" is the tail.
    expect(splitLabelTotal('Bleu 1 de 2', 'de')).toEqual({ head: 'Bleu 1', tail: ' de 2' });
  });

  it('returns tail null when there is no connector (e.g. final rounds)', () => {
    expect(splitLabelTotal('Final Round', 'of')).toEqual({ head: 'Final Round', tail: null });
    expect(splitLabelTotal('Tour Final', 'de')).toEqual({ head: 'Tour Final', tail: null });
  });
});

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

  it('merges primary FR + secondary EN (FR first, cover from primary)', () => {
    const s = getStrings('fr', 'en');
    expect(s.scrambler).toBe('Mélangeur\nScrambler');
    expect(s.scrambler).not.toContain('Mezclador');
    // primary-only fields come from FR
    expect(s.cover.forDelegate).toBe('POUR LE DÉLÉGUÉ');
    expect(s.roundName(1, 3)).toBe('Tour 1 de 3');
  });

  it('merges primary EN + secondary FR (EN first, cover from primary)', () => {
    const s = getStrings('en', 'fr');
    expect(s.scrambler).toBe('Scrambler\nMélangeur');
    expect(s.cover.forDelegate).toBe('FOR DELEGATE');
  });

  it('merges an arbitrary pair (ES primary + PT secondary)', () => {
    const s = getStrings('es', 'pt');
    expect(s.scrambler).toBe('Mezclador\nMisturador');
    expect(s.attempt).toBe('Intento\nTentativa');
    // primary-only fields come from ES
    expect(s.cover.forDelegate).toBe('PARA EL DELEGADO');
    expect(s.cutoffLine('30.00', true)).toBe(
      '─── Continuar si el Intento 1 es inferior a 30.00 ───\n─── Continue se a Tentativa 1 for inferior a 30.00 ───',
    );
  });

  it('no secondary (or secondary === primary) returns a single language', () => {
    expect(getStrings('fr').scrambler).toBe('Mélangeur');
    expect(getStrings('fr', null).scrambler).toBe('Mélangeur');
    expect(getStrings('fr', 'fr').scrambler).toBe('Mélangeur');
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

  it('returns Portuguese strings for "pt"', () => {
    const s = getStrings('pt');
    expect(s.scrambler).toBe('Misturador');
    expect(s.attempt).toBe('Tentativa');
    expect(s.judge).toBe('Juiz');
    expect(s.competitor).toBe('Competidor');
    expect(s.resultPrefix).toBe('Resultado');
  });

  it('Portuguese cover card strings', () => {
    const { cover } = getStrings('pt');
    expect(cover.forDelegate).toBe('PARA O DELEGADO');
    expect(cover.forDataEntry).toBe('PARA ENTRADA DE DADOS');
    expect(cover.bundledScorecards(12)).toBe('1. Agrupadas todas as 12 folhas');
    expect(cover.checkedSignatures).toBe('2. Verificadas as assinaturas faltantes');
    expect(cover.delegateInitials).toBe('Iniciais do Delegado ______');
  });

  it('Portuguese roundName and gender variants', () => {
    const s = getStrings('pt');
    expect(s.roundName(1, 3)).toBe('Rodada 1 de 3');
    expect(s.finalRound).toBe('Rodada Final');
    expect(s.newCompetitor).toBe('Novo Competidor');
    expect(s.newCompetitorF).toBe('Nova Competidora');
  });

  it('Portuguese dnfSuffix and cutoffLine', () => {
    const s = getStrings('pt');
    expect(s.dnfSuffix('1:00')).toBe('(DNF se não for inferior a 1:00)');
    expect(s.cutoffLine('30.00', false)).toBe('─── Continue se a Tentativa 1 ou 2 for inferior a 30.00 ───');
    expect(s.cutoffLine('30.00', true)).toBe('─── Continue se a Tentativa 1 for inferior a 30.00 ───');
  });

});

describe('getScheduleStrings', () => {
  it('returns English strings by default', () => {
    const s = getScheduleStrings('en');
    expect(s.event).toBe('Event');
    expect(s.title).toBe('- Schedule Tracker');
    expect(s.estimatedStart).toBe('Estimated\nStart Time');
    expect(s.numberOfCompetitors).toBe('Number of\nCompetitors');
  });

  it('returns French strings for fr', () => {
    const s = getScheduleStrings('fr');
    expect(s.event).toBe('Épreuve');
    expect(s.title).toBe('- Suivi du calendrier');
  });

  it('returns Spanish strings for es', () => {
    const s = getScheduleStrings('es');
    expect(s.event).toBe('Evento');
    expect(s.title).toBe('- Seguimiento del Horario');
    expect(s.estimatedStart).toBe('Hora de\ninicio estimada');
    expect(s.numberOfCompetitors).toBe('Número de\ncompetidores');
  });

  it('returns Portuguese strings for pt', () => {
    const s = getScheduleStrings('pt');
    expect(s.event).toBe('Evento');
    expect(s.title).toBe('- Acompanhamento de Horário');
    expect(s.estimatedStart).toBe('Horário de\nInício Estimado');
    expect(s.numberOfCompetitors).toBe('Número de\nCompetidores');
  });

});

describe('getCheckingSheetStrings', () => {
  const LOCALES = ['en', 'fr', 'es', 'pt'] as const;

  it('returns English strings by default', () => {
    const s = getCheckingSheetStrings('en');
    expect(s.title).toBe('- Round Checklist');
    expect(s.event).toBe('Event');
    expect(s.groupsMade).toBe('Groups\ncreated');
    expect(s.takenBy).toBe('Scorecards\ntaken by');
  });

  // The two tick-only columns record work done ahead of the round, not scorecards
  // handed in afterwards - the wording must not read as "collected"/"checked".
  it('labels the tick-only columns as creating groups and producing scorecards', () => {
    expect(getCheckingSheetStrings('en').groupsMade).toBe('Groups\ncreated');
    expect(getCheckingSheetStrings('en').scorecards).toBe('Scorecards\nready');
    expect(getCheckingSheetStrings('fr').groupsMade).toBe('Groupes\ncréés');
    expect(getCheckingSheetStrings('fr').scorecards).toBe('Feuilles\nprêtes');
    expect(getCheckingSheetStrings('es').groupsMade).toBe('Grupos\ncreados');
    expect(getCheckingSheetStrings('es').scorecards).toBe('Hojas\nlistas');
    expect(getCheckingSheetStrings('pt').groupsMade).toBe('Grupos\ncriados');
    expect(getCheckingSheetStrings('pt').scorecards).toBe('Folhas\nprontas');
  });

  it('is translated in every locale (no English leaking through)', () => {
    for (const lc of LOCALES) {
      const s = getCheckingSheetStrings(lc);
      for (const v of Object.values(s)) expect(v.length).toBeGreaterThan(0);
      if (lc !== 'en') expect(s.title).not.toBe(getCheckingSheetStrings('en').title);
    }
  });

  it('starts the title with an em dash, like the schedule tracker', () => {
    for (const lc of LOCALES) {
      expect(getCheckingSheetStrings(lc).title.startsWith('-')).toBe(true);
    }
  });

  it('wraps the multi-word headers onto two lines so they fit their columns', () => {
    for (const lc of LOCALES) {
      const s = getCheckingSheetStrings(lc);
      for (const key of ['start', 'groupsMade', 'scorecards', 'dataEntry', 'doubleCheck', 'takenBy'] as const) {
        expect(s[key]).toContain('\n');
      }
    }
  });
});

describe('cover.allGroups', () => {
  it('is defined for every locale and reflects the count', () => {
    for (const lc of ['en', 'fr', 'es', 'pt'] as const) {
      const f = getStrings(lc).cover.allGroups;
      expect(f(3)).toContain('3');
      expect(f(1).length).toBeGreaterThan(0);
      // Singular and plural must differ - the card reads as a sentence.
      expect(f(1)).not.toBe(f(3));
    }
  });

  it('stays primary-language only when a secondary language is set', () => {
    expect(getStrings('fr', 'en').cover.allGroups(2)).toBe(getStrings('fr').cover.allGroups(2));
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

  it('returns Spanish strings for es', () => {
    const s = getNametTagStrings('es');
    expect(s.compete).toBe('Competir:');
    expect(s.scramble).toBe('Mezclar:');
    expect(s.judge).toBe('Juzgar:');
    expect(s.run).toBe('Correr:');
  });

  it('returns Portuguese strings for pt', () => {
    const s = getNametTagStrings('pt');
    expect(s.compete).toBe('Competir:');
    expect(s.scramble).toBe('Misturar:');
    expect(s.judge).toBe('Julgar:');
    expect(s.run).toBe('Correr:');
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

  it('Portuguese event names', () => {
    expect(getEventName('333', 'pt')).toBe('Cubo 3x3x3');
    expect(getEventName('333bf', 'pt')).toBe('3x3x3 Às Cegas');
    expect(getEventName('333oh', 'pt')).toBe('3x3x3 Uma Mão');
    expect(getEventName('333mbf', 'pt')).toBe('3x3x3 Multi-BLD');
  });

  it('unknown event falls back to eventId', () => {
    expect(getEventName('unknown', 'es')).toBe('unknown');
  });
});

describe('getNametTagTitleStrings', () => {
  it('English - no gender distinction', () => {
    const { front, back } = getNametTagTitleStrings('en');
    expect(front.delegate(false)).toBe('DELEGATE');
    expect(front.delegate(true)).toBe('DELEGATE');
    expect(front.organizer(false)).toBe('ORGANIZER');
    expect(front.competitor(false)).toBe('COMPETITOR');
    expect(front.newCompetitor(false)).toBe('NEW COMPETITOR');
    expect(back.delegate(false)).toBe('DELEGATE');
  });

  it('French - gender-aware titles', () => {
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

  it('Spanish - gender-aware titles', () => {
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

  it('Portuguese - gender-aware titles', () => {
    const { front, back } = getNametTagTitleStrings('pt');
    expect(front.delegate(false)).toBe('DELEGADO');
    expect(front.delegate(true)).toBe('DELEGADA');
    expect(front.organizer(false)).toBe('ORGANIZADOR');
    expect(front.organizer(true)).toBe('ORGANIZADORA');
    expect(front.competitor(false)).toBe('COMPETIDOR');
    expect(front.competitor(true)).toBe('COMPETIDORA');
    expect(front.newCompetitor(false)).toBe('NOVO COMPETIDOR');
    expect(front.newCompetitor(true)).toBe('NOVA COMPETIDORA');
    expect(back.delegate(false)).toBe('DELEGADO');
  });

  it('single language: front and back match', () => {
    const { front, back } = getNametTagTitleStrings('fr');
    expect(front.delegate(false)).toBe('DÉLÉGUÉ');
    expect(back.delegate(false)).toBe('DÉLÉGUÉ');
  });

  it('primary FR + secondary EN: front=FR, back=EN', () => {
    const { front, back } = getNametTagTitleStrings('fr', 'en');
    expect(front.delegate(false)).toBe('DÉLÉGUÉ');
    expect(back.delegate(false)).toBe('DELEGATE');
  });

  it('primary EN + secondary FR: front=EN, back=FR', () => {
    const { front, back } = getNametTagTitleStrings('en', 'fr');
    expect(front.delegate(false)).toBe('DELEGATE');
    expect(back.delegate(false)).toBe('DÉLÉGUÉ');
  });

  it('arbitrary pair ES + PT: front=ES, back=PT', () => {
    const { front, back } = getNametTagTitleStrings('es', 'pt');
    expect(front.competitor(true)).toBe('COMPETIDORA');
    expect(back.newCompetitor(false)).toBe('NOVO COMPETIDOR');
  });

  it('null secondary falls back to primary on the back', () => {
    const { front, back } = getNametTagTitleStrings('es', null);
    expect(front.delegate(false)).toBe('DELEGADO');
    expect(back.delegate(false)).toBe('DELEGADO');
  });
});

describe('getNametTagStrings dutyGroup', () => {
  it('French duty group', () => expect(getNametTagStrings('fr').dutyGroup('1 & 2')).toBe('Groupe 1 & 2'));
  it('Spanish duty group', () => expect(getNametTagStrings('es').dutyGroup('1 & 2')).toBe('Grupo 1 & 2'));
  it('Portuguese duty group', () => expect(getNametTagStrings('pt').dutyGroup('1 & 2')).toBe('Grupo 1 & 2'));
  it('English duty group', () => expect(getNametTagStrings('en').dutyGroup('1 & 2')).toBe('Group 1 & 2'));
});

describe('getShortNametTagNames', () => {
  it('French: 333oh is "À une main"', () => expect(getShortNametTagNames('fr')['333oh']).toBe('À une main'));
  it('Spanish: 333oh is "Una mano"', () => expect(getShortNametTagNames('es')['333oh']).toBe('Una mano'));
  it('Portuguese: 333oh is "Uma Mão"', () => expect(getShortNametTagNames('pt')['333oh']).toBe('Uma Mão'));
  it('English: 333oh is "One-Hand"', () => expect(getShortNametTagNames('en')['333oh']).toBe('One-Hand'));
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
  it('Portuguese: Estação and Assento', () => {
    const s = getStrings('pt');
    expect(s.stationLabel('03')).toBe('Estação 03');
    expect(s.seatLabel('03')).toBe('Assento 03');
  });
  it('seat/station labels are primary-only when a secondary is set', () => {
    const s = getStrings('fr', 'en');
    expect(s.stationLabel('01')).toBe('Siège 01');
    expect(s.seatLabel('01')).toBe('Siège 01');
  });
});
