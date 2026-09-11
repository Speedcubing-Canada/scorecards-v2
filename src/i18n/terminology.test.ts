import { describe, it, expect } from 'vitest';
import fr from './fr.json';
import es from './es.json';
import pt from './pt.json';
import { CHANGELOG } from '../changelog';

// The same word for the same thing, everywhere an organizer reads it. Four rounds of
// translation work drifted apart (feuille de score / feuille de pointage, súmula / folha de
// pontuação) because nothing checked, and the changelog drifted furthest of all.
//
// Bans only unambiguous variants. Bare `feuille`/`hoja`/`folha` are legitimately "sheet of
// paper", `porte-badge`/`portacredencial` are the physical holder, `étape` is "step".

type Json = { [k: string]: string | Json };
type Locale = 'fr' | 'es' | 'pt';

const BANNED: Record<Locale, [RegExp, string][]> = {
  fr: [
    [/feuilles? de pointage/i, 'feuille de score'],
    [/feuilles? de compétition/i, 'feuille de score'],
    [/fiches? de vérification/i, 'feuille de couverture'],
    [/\brondes?\b/i, 'tour'],
    [/porte-noms?\b/i, 'badge'],
    [/\bévénements?\b/i, 'épreuve'],
  ],
  es: [
    [/hojas? de puntaje/i, 'hoja de puntuación'],
    [/\bscorecards?\b/i, 'hoja de puntuación'],
    [/tarjetas? de verificación/i, 'hoja de portada'],
    [/\bcredenciales?\b/i, 'etiqueta de nombre'],
    [/\bpruebas?\b/i, 'evento'],
  ],
  pt: [
    [/folhas? de pontuação/i, 'súmula'],
    [/fichas? de pontuação/i, 'súmula'],
    [/\brondas?\b/i, 'rodada'],
    [/\bprovas?\b/i, 'evento'],
    // European Portuguese: the bundle is Brazilian since PR 1.
    [/\btransfer(ência|ir|em|e)\b/i, 'download / baixar'],
    [/\bdetetad[oa]s?\b/i, 'detectado'],
    [/em todo o lado\b/i, 'em todos os lugares'],
  ],
};

function paths(obj: Json, prefix = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push([path, v]);
    else out.push(...paths(v, path));
  }
  return out;
}

const BUNDLES: [Locale, Json][] = [['fr', fr as Json], ['es', es as Json], ['pt', pt as Json]];

function offenders(locale: Locale, strings: [string, string][]): string[] {
  return strings.flatMap(([where, text]) =>
    BANNED[locale]
      .filter(([banned]) => banned.test(text))
      .map(([banned, use]) => `${locale} ${where}: ${banned.source} -> use "${use}"`));
}

describe('terminology', () => {
  for (const [locale, bundle] of BUNDLES) {
    it(`${locale}.json uses the canonical word for every concept`, () => {
      expect(offenders(locale, paths(bundle))).toEqual([]);
    });
  }

  // Changelog bullets are on-screen copy too, same as the em-dash rule in changelog.test.ts.
  it('the changelog uses the same words as the bundles', () => {
    const found = BUNDLES.flatMap(([locale]) =>
      offenders(locale, CHANGELOG.flatMap((entry) =>
        (entry.items[locale] ?? []).map((item, i): [string, string] => [`${entry.id}[${i}]`, item]))));
    expect(found).toEqual([]);
  });
});
