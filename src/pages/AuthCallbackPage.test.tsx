// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, waitFor } from '@testing-library/react';
import type { AuthState } from '../auth/useAuth';
import { anonymousAuth, renderWithProviders, useEnglish } from '../test/render';
import AuthCallbackPage from './AuthCallbackPage';

// The OAuth landing page reads window.location, not the router, and every path out of
// it is a redirect. Getting the guard wrong strands the organizer on a blank screen
// with their token in the URL, which no other test would catch.

const navigate = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => navigate,
}));

const handleCallback = vi.fn();
const auth = { ...anonymousAuth, handleCallback } as unknown as AuthState;

const land = (search: string) => {
  window.history.replaceState({}, '', `/auth/callback${search}`);
  return renderWithProviders(<AuthCallbackPage />, { auth, route: '/auth/callback' });
};

beforeEach(async () => {
  await useEnglish();
  sessionStorage.clear();
  vi.clearAllMocks();
  handleCallback.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('the return path', () => {
  it('resumes where the renewal interrupted, not at the start of the wizard', async () => {
    sessionStorage.setItem('post_login_return', '/settings?x=1');
    land('?code=abc&state=xyz');

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings?x=1', { replace: true }));
    // Consumed, so an ordinary sign-in later is not dragged back here.
    expect(sessionStorage.getItem('post_login_return')).toBeNull();
  });

  it('falls back to the picker for an ordinary sign-in', async () => {
    land('?code=abc&state=xyz');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/competitions', { replace: true }));
  });
});

describe('AuthCallbackPage', () => {
  it('exchanges the code when the WCA sends one back', async () => {
    land('?code=abc&state=xyz');
    await waitFor(() => expect(handleCallback).toHaveBeenCalledWith('abc', 'xyz'));
  });

  it('does not exchange anything when the callback is missing its params', async () => {
    land('');
    await waitFor(() => expect(handleCallback).not.toHaveBeenCalled());
  });

  it('does not exchange anything when the WCA denies the request', async () => {
    land('?error=access_denied');
    await waitFor(() => expect(handleCallback).not.toHaveBeenCalled());
  });
});
