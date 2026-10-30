import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, setUnauthorizedHandler } from '../api/client';
import type { AuthResponse, MeResponse } from '../api/types';
import { storage, TOKEN_KEY } from '../storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface User {
  name: string;
  email: string;
}

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const logout = useCallback(async () => {
    await storage.remove(TOKEN_KEY);
    setUser(null);
    setStatus('signedOut');
  }, []);

  const startSession = useCallback(async (response: AuthResponse) => {
    await storage.set(TOKEN_KEY, response.token);
    setUser({ name: response.name, email: response.email });
    setStatus('signedIn');
  }, []);

  // Si le serveur répond 401 n'importe où dans l'application : retour à l'écran de connexion
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Au démarrage : y a-t-il déjà un token valide ?
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const token = await storage.get(TOKEN_KEY);
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const me = await api<MeResponse>('/api/auth/me');
        if (!cancelled) {
          setUser({ name: me.name, email: me.email });
          setStatus('signedIn');
        }
      } catch (error) {
        // Serveur injoignable : on garde le token mais on affiche l'écran de connexion
        if (!(error instanceof ApiError && error.status === 0)) {
          await storage.remove(TOKEN_KEY);
        }
        if (!cancelled) setStatus('signedOut');
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        auth: false,
      });
      await startSession(response);
    },
    [startSession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await api<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: { name, email, password },
        auth: false,
      });
      await startSession(response);
    },
    [startSession],
  );

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}