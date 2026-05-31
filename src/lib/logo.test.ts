import { describe, it, expect } from 'vitest';
import { logoState, resolveLogo } from './logo';
import { SCC_DEFAULT_LOGO } from '../assets/scc-logo';

const CUSTOM = 'data:image/png;base64,custom-logo-bytes';

describe('logoState', () => {
  it("returns 'custom' when a user logo is uploaded (regardless of useDefaultLogo)", () => {
    expect(logoState({ logoDataUrl: CUSTOM, useDefaultLogo: true  })).toBe('custom');
    expect(logoState({ logoDataUrl: CUSTOM, useDefaultLogo: false })).toBe('custom');
  });

  it("returns 'default' when no custom logo but SCC fallback is enabled", () => {
    expect(logoState({ logoDataUrl: null, useDefaultLogo: true })).toBe('default');
  });

  it("returns 'none' when no custom logo and SCC fallback is disabled", () => {
    expect(logoState({ logoDataUrl: null, useDefaultLogo: false })).toBe('none');
  });
});

describe('resolveLogo', () => {
  it('prefers the uploaded logo over the SCC default', () => {
    expect(resolveLogo({ logoDataUrl: CUSTOM, useDefaultLogo: true })).toBe(CUSTOM);
  });

  it('falls back to the SCC logo when no custom logo is uploaded', () => {
    expect(resolveLogo({ logoDataUrl: null, useDefaultLogo: true })).toBe(SCC_DEFAULT_LOGO);
  });

  it('returns null when both sources are disabled', () => {
    expect(resolveLogo({ logoDataUrl: null, useDefaultLogo: false })).toBeNull();
  });
});
