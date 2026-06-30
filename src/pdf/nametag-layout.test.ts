import { describe, it, expect } from 'vitest';
import { eventIconsVisible } from './layoutConstants';

// Sarah's feedback: on horizontal name tags, event icons should appear only on the
// side WITHOUT the QR codes. The vertical layout is unchanged (icons on both sides).
describe('eventIconsVisible', () => {
  it('hides icons on the QR side of a horizontal (compact) tag', () => {
    expect(eventIconsVisible({ isQrSide: true, compact: true })).toBe(false);
  });

  it('keeps icons on the non-QR side of a horizontal tag', () => {
    expect(eventIconsVisible({ isQrSide: false, compact: true })).toBe(true);
  });

  it('keeps icons on both sides of the vertical (non-compact) layout', () => {
    expect(eventIconsVisible({ isQrSide: true, compact: false })).toBe(true);
    expect(eventIconsVisible({ isQrSide: false, compact: false })).toBe(true);
  });
});
