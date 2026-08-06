import { describe, expect, it } from 'vitest';
import { DOWNLOAD_BUTTON_FONT_SIZE, downloadButtonFontSize } from './downloadButtonFontSize';

describe('downloadButtonFontSize', () => {
  it('keeps the default size for short labels', () => {
    expect(downloadButtonFontSize('⬇ Download Comp_pdfs.zip')).toBe(DOWNLOAD_BUTTON_FONT_SIZE);
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
    const label = '⬇ Download BigCubingCompetitionInParis2025_pdfs.zip';
    expect(downloadButtonFontSize(label)).toBeLessThan(DOWNLOAD_BUTTON_FONT_SIZE);
  });

  // The zip suffix shrank from _scorecards.zip to _pdfs.zip, which moves every label
  // seven characters left across the size thresholds. This pins the shortest ID that
  // still needs to shrink, so a future rename can't silently overflow the button.
  it('keeps the default size for a typical competition ID', () => {
    expect(downloadButtonFontSize('⬇ Download Gj2026_pdfs.zip')).toBe(DOWNLOAD_BUTTON_FONT_SIZE);
  });

  // A single-document scope downloads the PDF itself, so the button now shows a
  // per-document filename instead of the zip. Those suffixes run longer than
  // "_pdfs.zip" (up to "_first_timers.pdf"), which moves the labels right across
  // the thresholds - the opposite direction from the rename above.
  it('keeps the default size for a single-PDF label on a typical competition ID', () => {
    expect(downloadButtonFontSize('⬇ Download Gj2026_schedule.pdf')).toBe(DOWNLOAD_BUTTON_FONT_SIZE);
  });

  it('shrinks the longest single-PDF suffix even on a typical competition ID', () => {
    const size = downloadButtonFontSize('⬇ Download Gj2026_first_timers.pdf');
    expect(size).toBeLessThan(DOWNLOAD_BUTTON_FONT_SIZE);
    expect(size).toBeGreaterThan(12);
  });

  // Long ID + long suffix bottoms out at the floor, same as the zip label does;
  // the button's overflowWrap is the safety net past this point.
  it('falls to the floor for a long ID with a single-PDF filename', () => {
    expect(downloadButtonFontSize('⬇ Download BigCubingCompetitionInParis2025_first_timers.pdf')).toBe(12);
  });

  it('never returns smaller than the floor', () => {
    expect(downloadButtonFontSize('x'.repeat(500))).toBe(12);
  });
});
