import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AuthContext } from '@/contexts/auth-context';
import type { AuthContextValue } from '@/contexts/auth-context';
import { loginRequest } from '@/lib/api';
import type { AuthUser } from '@/lib/api';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    const { roles } = response.user;

    if (!roles.includes('admin') && !roles.includes('student')) {
      throw new Error(
        'Your account does not have access to this application yet.',
      );
    }

    setUser(response.user);
    setToken(response.accessToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: user !== null && token !== null,
      login,
      logout,
    }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
