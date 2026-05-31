import { describe, expect, it } from 'vitest';
import { MOBILE_BREAKPOINT, isMobileWidth } from './useIsMobile';

describe('isMobileWidth', () => {
  it('treats typical phone widths as mobile', () => {
    expect(isMobileWidth(320)).toBe(true);
    expect(isMobileWidth(375)).toBe(true);
    expect(isMobileWidth(390)).toBe(true);
  });

  it('treats the breakpoint itself as mobile (max-width is inclusive)', () => {
    expect(isMobileWidth(MOBILE_BREAKPOINT)).toBe(true);
  });

  it('treats widths just above the breakpoint as desktop', () => {
    expect(isMobileWidth(MOBILE_BREAKPOINT + 1)).toBe(false);
  });

  it('treats typical tablet/desktop widths as desktop', () => {
    expect(isMobileWidth(768)).toBe(false);
    expect(isMobileWidth(1024)).toBe(false);
    expect(isMobileWidth(1440)).toBe(false);
  });
});
