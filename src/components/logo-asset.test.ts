import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lightSvg = readFileSync(
  fileURLToPath(new URL('../../public/scc-logo.svg', import.meta.url)),
  'utf-8',
);
const darkSvg = readFileSync(
  fileURLToPath(new URL('../../public/scc-logo-dark.svg', import.meta.url)),
  'utf-8',
);

describe('SCC logo assets', () => {
  it('keeps black wordmark/lines in the light original', () => {
    expect(lightSvg).toContain('#000000');
  });

  it('has no black anywhere in the dark variant', () => {
    expect(darkSvg).not.toContain('#000000');
  });

  it('uses white for the recolored elements in the dark variant', () => {
    expect(darkSvg).toContain('#ffffff');
  });

  it('keeps the two variants in sync (only black->white differs)', () => {
    // Both files should be identical once the dark variant's white is mapped
    // back to black. If the source logo changes without regenerating the dark
    // variant, this fails and flags the drift.
    expect(darkSvg.replaceAll('#ffffff', '#000000')).toBe(lightSvg);
  });
});
