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
 * Applies the `dark` class to `<html>` while mounted, so it cascades
 * to portals (modals, lightboxes) and auth screens outside the panel root.
 * Cleans up on unmount so other pages aren't affected.
 */
export function useSuperAdminTheme() {
  const [theme, setTheme] = useState(readStored);

  useEffect(() => {
    try { localStorage.setItem(KEY, theme); } catch {}
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    return () => {
      // On unmount of the superadmin panel, drop the class so other pages aren't tinted.
      root.classList.remove('dark');
    };
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return [theme, toggleTheme, setTheme];
}
