import { describe, expect, it } from 'vitest';
import { DOWNLOAD_BUTTON_FONT_SIZE, downloadButtonFontSize } from './downloadButtonFontSize';

describe('downloadButtonFontSize', () => {
  it('keeps the default size for short labels', () => {
    expect(downloadButtonFontSize('⬇ Download Comp_scorecards.zip')).toBe(DOWNLOAD_BUTTON_FONT_SIZE);
    expect(downloadButtonFontSize('Building ZIP…')).toBe(DOWNLOAD_BUTTON_FONT_SIZE);
  });

  it('shrinks the font as the label grows longer', () => {
    const short = downloadButtonFontSize('x'.repeat(20));
    const medium = downloadButtonFontSize('x'.repeat(35));
    const long = downloadButtonFontSize('x'.repeat(42));
    const huge = downloadButtonFontSize('x'.repeat(60));
    expect(short).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(long);
    expect(long).toBeGreaterThan(huge);
  });

  it('shrinks a long competition filename below the default', () => {
    const label = '⬇ Download BigCubingCompetitionInParis2025_scorecards.zip';
    expect(downloadButtonFontSize(label)).toBeLessThan(DOWNLOAD_BUTTON_FONT_SIZE);
  });

  it('never returns smaller than the floor', () => {
    expect(downloadButtonFontSize('x'.repeat(500))).toBe(12);
  });
});
