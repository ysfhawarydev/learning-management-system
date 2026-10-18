import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from '@/contexts/auth-context';
import type { AuthContextValue } from '@/contexts/auth-context';
import { getCurrentUser, loginRequest } from '@/lib/api';
import type { AuthUser } from '@/lib/api';

interface AuthProviderProps {
  children: ReactNode;
}

const TOKEN_KEY = 'student-management.access-token';

function hasApplicationAccess(user: AuthUser): boolean {
  return (
    user.roles.includes('admin') ||
    user.roles.includes('student') ||
    user.roles.includes('instructor')
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const savedToken = localStorage.getItem(TOKEN_KEY);

        if (!savedToken) {
          return;
        }

        const currentUser = await getCurrentUser(savedToken);

        if (!hasApplicationAccess(currentUser)) {
          throw new Error(
            'Your account does not have access to this application yet.',
          );
        }

        if (!cancelled) {
          setToken(savedToken);
          setUser(currentUser);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);

        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsInitializing(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);

    if (!hasApplicationAccess(response.user)) {
      throw new Error(
        'Your account does not have access to this application yet.',
      );
    }

    localStorage.setItem(TOKEN_KEY, response.accessToken);
    setToken(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: user !== null && token !== null,
      isInitializing,
      login,
      logout,
    }),
    [user, token, isInitializing, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
