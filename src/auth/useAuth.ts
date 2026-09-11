import { createContext, useContext } from 'react';
import type { WCAToken, WCAUser } from './wca';

// The context and its hook live outside AuthContext.tsx so that file exports only
// the AuthProvider component - react-refresh/only-export-components requires it.

/** Where to land after a renewal redirect, so the wizard resumes where it left off. */
export const STORAGE_RETURN = 'post_login_return';

export interface AuthState {
  token: WCAToken | null;
  user: WCAUser | null;
  isLoading: boolean;
  /** A dead token is being renewed. Pages should hold their fetch rather than 401 into an error. */
  isRenewing: boolean;
  /** Why the session ended, for the login page to explain. */
  authError: string | null;
  login: () => Promise<void>;
  logout: () => void;
  handleCallback: (code: string, state: string) => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
