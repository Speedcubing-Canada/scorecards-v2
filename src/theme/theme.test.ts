import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from './theme';

describe('resolveInitialTheme', () => {
  it('honors an explicit stored "dark" choice over OS preference', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark');
  });

  it('honors an explicit stored "light" choice over OS preference', () => {
    expect(resolveInitialTheme('light', true)).toBe('light');
  });

  it('falls back to OS dark preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark');
  });

  it('falls back to OS light preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, false)).toBe('light');
  });

  it('falls back to OS preference for an invalid stored value', () => {
    expect(resolveInitialTheme('blue', true)).toBe('dark');
    expect(resolveInitialTheme('blue', false)).toBe('light');
  });
});
