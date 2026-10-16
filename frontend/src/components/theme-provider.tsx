import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ThemeContext, type ThemeMode } from '@/contexts/theme-context';

const STORAGE_KEY = 'student-management-theme';

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';

  const saved = window.localStorage.getItem(STORAGE_KEY);

  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }

  return 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = mode === 'dark' || (mode === 'system' && media.matches);

      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    };

    applyTheme();

    if (mode === 'system') {
      media.addEventListener('change', applyTheme);
    }

    return () => media.removeEventListener('change', applyTheme);
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    setModeState(nextMode);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
