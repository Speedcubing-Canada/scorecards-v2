import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { generatePKCE, generateState } from './pkce';
import {
  WCA_OAUTH_URL,
  CLIENT_ID,
  REDIRECT_URI,
  type WCAToken,
  type WCAUser,
  exchangeCodeForToken,
  fetchMe,
} from './wca';

const STORAGE_TOKEN = 'wca_token';
const STORAGE_USER = 'wca_user';

interface AuthState {
  token: WCAToken | null;
  user: WCAUser | null;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  handleCallback: (code: string, state: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<WCAToken | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_TOKEN);
    return raw ? JSON.parse(raw) : null;
  });
  const [user, setUser] = useState<WCAUser | null>(() => {
    const raw = sessionStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (token) sessionStorage.setItem(STORAGE_TOKEN, JSON.stringify(token));
    else sessionStorage.removeItem(STORAGE_TOKEN);
  }, [token]);

  useEffect(() => {
    if (user) sessionStorage.setItem(STORAGE_USER, JSON.stringify(user));
    else sessionStorage.removeItem(STORAGE_USER);
  }, [user]);

  async function login() {
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'public manage_competitions',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
    });
    window.location.href = `${WCA_OAUTH_URL}?${params}`;
  }

  async function handleCallback(code: string, returnedState: string) {
    const savedState = sessionStorage.getItem('oauth_state');
    const verifier = sessionStorage.getItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_verifier');

    if (returnedState !== savedState) throw new Error('OAuth state mismatch — possible CSRF');
    if (!verifier) throw new Error('Missing PKCE verifier');

    setIsLoading(true);
    try {
      const newToken = await exchangeCodeForToken(code, verifier);
      setToken(newToken);
      const me = await fetchMe(newToken.access_token);
      setUser(me);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, handleCallback }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
