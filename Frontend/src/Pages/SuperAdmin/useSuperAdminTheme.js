import { useState, useEffect, useCallback } from 'react';

const KEY = 'superadmin-theme';

function readStored() {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

/**
 * Persisted light/dark theme for the SuperAdmin panel only.
 * Returns [theme, toggleTheme, setTheme].
 * The caller is responsible for applying the `dark` class to its root container.
 */
export function useSuperAdminTheme() {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    try { localStorage.setItem(KEY, theme); } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggleTheme, setTheme];
}
