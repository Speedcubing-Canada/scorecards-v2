import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  // Parity keeps the four bundles equal to each other, but says nothing about whether the
  // code still uses a key. Keys outlive the feature that introduced them: three
  // `first_timer_slips_*` entries survived that setting moving to the scope step, and
  // `logo.use_default_label` survived its checkbox becoming a toggle - 16 dead strings
  // across four locales that translators kept dutifully translating. This catches the next
  // four.
  //
  // Deliberately a whole-source substring scan rather than an import graph: `t()` is called
  // with string literals, so a literal search is both sufficient and immune to how the key
  // is spelled at the call site.
  it('has no key that no source file references', () => {
    const srcDir = join(import.meta.dirname, '..');
    const sources: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(entry.name)) sources.push(readFileSync(p, 'utf8'));
      }
    };
    walk(srcDir);
    const haystack = sources.join('\n');

    // Keys built by interpolation - `t(\`settings.advanced.${fmt}\`)` and
    // `t(\`scope.${mode}.label\`)` - never appear literally. Match their prefixes instead.
    const DYNAMIC_PREFIXES = ['settings.advanced.', 'scope.'];

    const orphans = paths(en as Json).filter((key) => {
      if (haystack.includes(key)) return false;
      const leaf = key.split('.').pop()!;
      if (DYNAMIC_PREFIXES.some(p => key.startsWith(p)) && haystack.includes(leaf)) return false;
      return true;
    });
    expect(orphans).toEqual([]);
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
