// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, waitFor } from '@testing-library/react';
import type { AuthState } from '../auth/useAuth';
import { anonymousAuth, renderWithProviders, useEnglish } from '../test/render';
import AuthCallbackPage from './AuthCallbackPage';

// The OAuth landing page reads window.location, not the router, and every path out of
// it is a redirect. Getting the guard wrong strands the organizer on a blank screen
// with their token in the URL, which no other test would catch.

const handleCallback = vi.fn();
const auth = { ...anonymousAuth, handleCallback } as unknown as AuthState;

const land = (search: string) => {
  window.history.replaceState({}, '', `/auth/callback${search}`);
  return renderWithProviders(<AuthCallbackPage />, { auth, route: '/auth/callback' });
};

beforeEach(async () => {
  await useEnglish();
  vi.clearAllMocks();
  handleCallback.mockResolvedValue(undefined);
});
afterEach(cleanup);

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
