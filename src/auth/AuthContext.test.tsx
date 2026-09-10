// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { webcrypto } from 'node:crypto';

vi.mock('../lib/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/analytics')>()),
  send: vi.fn(),
}));

import { send } from '../lib/analytics';
import { AuthProvider } from './AuthContext';
import { useAuth, type AuthState } from './useAuth';

// The OAuth round trip. Two of its branches are the app's only CSRF and PKCE defences and
// nothing else touches them: a returned `state` that does not match what was stored must be
// refused, and a callback with no stored verifier must not be exchanged. Both are one `if`
// deep, so a refactor can drop either without any other test noticing.
//
// jsdom's crypto has getRandomValues but no subtle, which generatePKCE needs for the S256
// challenge - hence the webcrypto stub rather than a mocked pkce module. The real PKCE code
// runs here.

// Updated after every render rather than during one: reassigning an outer variable
// mid-render is the side effect react-hooks/globals rejects.
let auth: AuthState;
function Probe() {
  const ctx = useAuth();
  useEffect(() => { auth = ctx; });
  return null;
}

const mockSend = vi.mocked(send);
let hrefs: string[] = [];

function mount() {
  return render(<AuthProvider><Probe /></AuthProvider>);
}

const token = { access_token: 'tok', token_type: 'Bearer', expires_in: 7200, scope: 'public', created_at: 0 };
const user = { id: 7, name: 'Test Organizer', wca_id: '2018TEST01' };

/** Responses for the two calls handleCallback makes, in order. */
function stubExchange(...over: Partial<Response>[]) {
  const fn = vi.fn()
    .mockResolvedValueOnce(over[0] ?? { ok: true, status: 200, json: async () => token })
    .mockResolvedValueOnce(over[1] ?? { ok: true, status: 200, json: async () => ({ me: user }) });
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  hrefs = [];
  if (!globalThis.crypto?.subtle) vi.stubGlobal('crypto', webcrypto);
  // jsdom refuses to navigate; capture the assignment instead of letting it warn.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:3000', set href(v: string) { hrefs.push(v); } },
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('login', () => {
  it('sends the organizer to the WCA with an S256 challenge and a stored state', async () => {
    mount();
    await act(() => auth.login());

    expect(hrefs).toHaveLength(1);
    const params = new URL(hrefs[0]).searchParams;
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.get('scope')).toBe('public manage_competitions');
    // The state in the URL is what comes back; it has to be the one we can check against.
    expect(params.get('state')).toBe(sessionStorage.getItem('oauth_state'));

    const verifier = sessionStorage.getItem('pkce_verifier');
    const challenge = params.get('code_challenge')!;
    expect(verifier).toBeTruthy();
    // A challenge equal to the verifier means the hash step was skipped.
    expect(challenge).not.toBe(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('generates a fresh verifier and state on every attempt', async () => {
    mount();
    await act(() => auth.login());
    const first = sessionStorage.getItem('pkce_verifier');
    await act(() => auth.login());
    expect(sessionStorage.getItem('pkce_verifier')).not.toBe(first);
  });
});

describe('handleCallback', () => {
  const arrive = () => {
    sessionStorage.setItem('oauth_state', 'the-state');
    sessionStorage.setItem('pkce_verifier', 'the-verifier');
  };

  it('refuses a state that does not match the one it stored', async () => {
    arrive();
    const fn = stubExchange();
    mount();

    await expect(act(() => auth.handleCallback('code', 'attacker-state')))
      .rejects.toThrow('OAuth state mismatch - possible CSRF');
    expect(fn).not.toHaveBeenCalled();
    expect(auth.token).toBeNull();
  });

  it('refuses a callback with no stored verifier', async () => {
    sessionStorage.setItem('oauth_state', 'the-state');
    const fn = stubExchange();
    mount();

    await expect(act(() => auth.handleCallback('code', 'the-state')))
      .rejects.toThrow('Missing PKCE verifier');
    expect(fn).not.toHaveBeenCalled();
  });

  it('consumes the state and the verifier before checking them, so neither can be replayed', async () => {
    arrive();
    stubExchange();
    mount();

    await expect(act(() => auth.handleCallback('code', 'wrong'))).rejects.toThrow();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    expect(sessionStorage.getItem('pkce_verifier')).toBeNull();
  });

  it('exchanges the code, loads the user, and persists both', async () => {
    arrive();
    const fn = stubExchange();
    mount();
    await act(() => auth.handleCallback('the-code', 'the-state'));

    expect(auth.token).toEqual(token);
    expect(auth.user).toEqual(user);
    expect(JSON.parse(sessionStorage.getItem('wca_token')!)).toEqual(token);
    expect(JSON.parse(sessionStorage.getItem('wca_user')!)).toEqual(user);

    // The verifier reaches the token endpoint, and the fresh token reaches /me.
    expect(new URLSearchParams(fn.mock.calls[0][1].body).get('code_verifier')).toBe('the-verifier');
    expect(fn.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
  });

  it('reports one session event per sign-in', async () => {
    arrive();
    stubExchange();
    mount();
    await act(() => auth.handleCallback('the-code', 'the-state'));
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('clears isLoading when the exchange fails', async () => {
    arrive();
    stubExchange({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => '' });
    mount();

    await expect(act(() => auth.handleCallback('code', 'the-state'))).rejects.toThrow();
    expect(auth.isLoading).toBe(false);
    expect(auth.token).toBeNull();
  });
});

describe('session restore and logout', () => {
  it('restores a token and user left by a previous mount', () => {
    sessionStorage.setItem('wca_token', JSON.stringify(token));
    sessionStorage.setItem('wca_user', JSON.stringify(user));
    mount();

    expect(auth.token).toEqual(token);
    expect(auth.user).toEqual(user);
  });

  it('logout drops both from state and from storage', async () => {
    sessionStorage.setItem('wca_token', JSON.stringify(token));
    sessionStorage.setItem('wca_user', JSON.stringify(user));
    mount();
    await act(async () => auth.logout());

    expect(auth.token).toBeNull();
    expect(sessionStorage.getItem('wca_token')).toBeNull();
    expect(sessionStorage.getItem('wca_user')).toBeNull();
  });
});
