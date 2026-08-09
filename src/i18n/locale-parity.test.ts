import { describe, it, expect } from 'vitest';
import en from './en.json';
import fr from './fr.json';
import es from './es.json';
import pt from './pt.json';

// `i18next.d.ts` types `t()` off en.json alone, so a key added to en.json and forgotten in
// the other three compiles cleanly and silently falls back to English at runtime - and a
// key *removed* from en.json leaves dead entries behind. Every feature touching the UI
// strings has to edit all four files together; this is the guard that they stayed in step.

type Json = { [k: string]: string | Json };

// Flatten to dotted paths so the diff names the exact key, not just the parent object.
function paths(obj: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.push(path);
    else out.push(...paths(v, path));
  }
  return out.sort();
}

const EN = paths(en as Json);
const TRANSLATIONS: [string, Json][] = [
  ['fr', fr as Json], ['es', es as Json], ['pt', pt as Json],
];

describe('locale key parity', () => {
  for (const [code, bundle] of TRANSLATIONS) {
    const keys = paths(bundle);

    it(`${code}.json has no key missing from en.json`, () => {
      expect(EN.filter(k => !keys.includes(k))).toEqual([]);
    });

    it(`${code}.json has no key that en.json dropped`, () => {
      expect(keys.filter(k => !EN.includes(k))).toEqual([]);
    });
  }

  it('every leaf is a non-empty string in every locale', () => {
    for (const [code, bundle] of [['en', en as Json], ...TRANSLATIONS] as [string, Json][]) {
      const empty = paths(bundle).filter((p) => {
        const v = p.split('.').reduce<string | Json>((o, k) => (o as Json)[k], bundle);
        return typeof v !== 'string' || v.trim() === '';
      });
      expect(empty, code).toEqual([]);
    }
  });

  // Em dashes read as machine-written and are awkward to type in three of the four
  // languages. Use a comma, a colon, or two sentences instead. Applies to on-screen
  // copy only - source comments and the README are free to use them.
  it('uses no em dash in any on-screen string', () => {
    for (const [code, bundle] of [['en', en as Json], ...TRANSLATIONS] as [string, Json][]) {
      const offenders = paths(bundle).filter((p) => {
        const v = p.split('.').reduce<string | Json>((o, k) => (o as Json)[k], bundle);
        return typeof v === 'string' && v.includes('—');
      });
      expect(offenders, code).toEqual([]);
    }
  });
});
