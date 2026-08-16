import { createContext, useContext } from 'react';
import type { WCAToken, WCAUser } from './wca';

// The context and its hook live outside AuthContext.tsx so that file exports only
// the AuthProvider component - react-refresh/only-export-components requires it.

export interface AuthState {
  token: WCAToken | null;
  user: WCAUser | null;
  isLoading: boolean;
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
