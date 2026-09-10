// Every page reads the router, the theme and the auth context, so rendering one bare throws.
// This wires all three the way main.tsx does.
//
// jsdom only: give the test file a `// @vitest-environment jsdom` docblock.

import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthContext, type AuthState } from '../auth/useAuth';
import { ThemeProvider } from '../theme/ThemeContext';
import i18n from '../i18n/index';

/** jsdom ships no matchMedia; ThemeContext and useIsMobile both read one. */
export function stubMatchMedia(matches = false) {
  vi.stubGlobal('matchMedia', (media: string) => ({
    media, matches, onchange: null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
  }));
}

/** Signed out. Spread over it for a page that needs a token. */
export const anonymousAuth = {
  token: null, user: null, isLoading: false,
} as unknown as AuthState;

export const signedInAuth = {
  ...anonymousAuth,
  token: { access_token: 'test-token' },
  user: { id: 1, name: 'Test Organizer' },
} as unknown as AuthState;

export interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  auth?: AuthState;
  /** Initial router entries, for a page that reads the location. */
  route?: string;
}

export function renderWithProviders(ui: ReactElement, opts: ProviderOptions = {}) {
  const { auth = anonymousAuth, route = '/', ...rest } = opts;
  stubMatchMedia();
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
    rest,
  );
}

/** Pins the UI to English: tests never assert copy, but they do find controls by name. */
export const useEnglish = () => i18n.changeLanguage('en');
