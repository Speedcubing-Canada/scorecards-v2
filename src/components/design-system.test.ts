import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guards the UI design-system constraints introduced by the "professional UI"
 * rework so they can't silently regress:
 *  - the weight hierarchy is exactly 400 / 500 / 700 (no 600 or 800),
 *  - icons come from the lucide-react pack, not hand-rolled inline <svg> or emoji,
 *  - Montserrat is loaded with only those three weights.
 *
 * Scope is the on-screen UI (src/components + src/pages). PDF documents under
 * src/pdf are intentionally excluded — they use @react-pdf primitives (incl. Svg)
 * and their own StyleSheet, and must not be constrained by these UI rules.
 */

const UI_DIRS = ['../components', '../pages'] as const;

function uiSourceFiles(): { path: string; source: string }[] {
  const files: { path: string; source: string }[] = [];
  for (const dir of UI_DIRS) {
    const dirUrl = new URL(`${dir}/`, import.meta.url);
    for (const entry of readdirSync(dirUrl)) {
      if (!entry.endsWith('.tsx')) continue; // .ts test/helpers excluded
      const source = readFileSync(fileURLToPath(new URL(entry, dirUrl)), 'utf-8');
      files.push({ path: `${dir}/${entry}`, source });
    }
  }
  return files;
}

const FILES = uiSourceFiles();

// The emoji icons that were replaced with lucide-react components.
const FORBIDDEN_EMOJI = ['⏳', '⚙️', '❌', '✓', '↑', '▾', '▸'];

describe('UI design system', () => {
  it('finds the UI source files to scan', () => {
    expect(FILES.length).toBeGreaterThan(5);
  });

  it('uses only the 400/500/700 weight hierarchy (no 600 or 800)', () => {
    const offenders = FILES
      .filter(f => /fontWeight: ?(600|800)/.test(f.source))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('has no hand-rolled inline <svg> icons (use lucide-react instead)', () => {
    const offenders = FILES.filter(f => f.source.includes('<svg')).map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('has no emoji used as icons (use lucide-react instead)', () => {
    const offenders = FILES
      .filter(f => FORBIDDEN_EMOJI.some(e => f.source.includes(e)))
      .map(f => f.path);
    expect(offenders).toEqual([]);
  });

  it('loads Montserrat with exactly the 400;500;700 weights', () => {
    const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf-8');
    expect(html).toContain('Montserrat:wght@400;500;700');
    expect(html).not.toContain(';600');
  });
});
