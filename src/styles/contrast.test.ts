import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Guards the colour tokens against silent contrast regressions.
 *
 * The palette shipped with seven failing pairs that nobody noticed, because a colour
 * choice looks fine next to the colour it was chosen against and only fails against the
 * surface it actually lands on. Every pair below is a real pairing in the UI.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for LARGE text (>=18.66px bold,
 * or >=24px) and for the visual boundary of a control (1.4.11). Decorative colours
 * (--border, the disabled fill) are deliberately absent.
 *
 * The large-text allowance is why the brand red works for the stat values and the progress
 * percentage but not for a 14px link: --primary is the fill and big display numbers,
 * --primary-soft-text is small brand-coloured text.
 */

const CSS = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf-8');

/** Reads a theme's token block: `:root` for light, `[data-theme='dark']` for dark. */
function tokens(theme: 'light' | 'dark'): Record<string, string> {
  const blocks = theme === 'light'
    ? CSS.split("[data-theme='dark']")[0]
    : CSS.slice(CSS.indexOf("[data-theme='dark']"));
  const out: Record<string, string> = {};
  for (const [, name, value] of blocks.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[name] = value;
  }
  return out;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground token, background token, minimum ratio, what the pairing is]. */
const PAIRS: [string, string, number, string][] = [
  ['--text', '--surface', 4.5, 'body text on a card'],
  ['--text', '--bg', 4.5, 'body text on the page'],
  ['--text', '--surface-2', 4.5, 'text on a toggle'],
  ['--text-muted', '--surface', 4.5, 'descriptions on a card'],
  ['--text-muted', '--surface-2', 4.5, 'descriptions on a toggle'],
  ['--text-subtle', '--surface', 4.5, '"(optional)" markers on a card'],
  ['--text-subtle', '--bg', 4.5, 'group labels on the page'],
  ['--text-subtle', '--surface-2', 4.5, 'subtle text on a toggle'],
  ['--primary-contrast', '--primary', 4.5, 'the label on a primary button'],
  ['--primary-soft-text', '--surface', 4.5, 'small brand text (links, diagram numbers)'],
  ['--primary', '--surface', 3, 'the brand as large display text (stat values, progress %)'],
  ['--primary-soft-text', '--primary-soft-bg', 4.5, 'the progress bar fill on its track'],
  ['--warning-text', '--warning-bg', 4.5, 'a warning banner'],
  ['--success', '--surface', 4.5, 'the "auto-detected" confirmation'],
  ['--danger', '--surface', 4.5, 'an error message'],
  // 1.4.11: --border-strong is the only boundary on the Back, Sign out and theme buttons,
  // on every option card and on every toggle, so it has to hold up on all three surfaces.
  ['--border-strong', '--surface', 3, 'a control outline on a card'],
  ['--border-strong', '--bg', 3, 'a control outline on the page'],
  ['--border-strong', '--surface-2', 3, 'a control outline on a toggle'],
  ['--primary', '--surface', 3, 'the primary fill against a card'],
];

describe.each(['light', 'dark'] as const)('%s theme contrast', (theme) => {
  const t = tokens(theme);

  it('defines every token the pairs reference', () => {
    const missing = [...new Set(PAIRS.flatMap(([fg, bg]) => [fg, bg]))].filter(n => !t[n]);
    expect(missing).toEqual([]);
  });

  it.each(PAIRS)('%s on %s clears %s:1 (%s)', (fg, bg, min) => {
    expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
  });
});
