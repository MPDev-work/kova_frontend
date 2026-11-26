import { useCallback, useEffect, useState } from 'react';

export type DashboardTheme = 'light' | 'dark';

const ROOT_DARK_CLASS = 'kova-dashboard-dark';
const ROOT_LIGHT_CLASS = 'kova-dashboard-light';

function readStoredTheme(scope: 'seller' | 'admin'): DashboardTheme {
  try {
    const saved = window.localStorage.getItem(`kova_dashboard_theme_${scope}`);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

/**
 * Scoped light/dark-mode controller exclusively for Seller and Root Admin dashboards.
 * Attaches `.kova-dashboard-light` or `.kova-dashboard-dark` to `<html>` while mounted
 * and always removes both on unmount so customer storefront and auth pages stay untouched.
 */
export function useDashboardTheme(scope: 'seller' | 'admin') {
  const [theme, setTheme] = useState<DashboardTheme>(() =>
    readStoredTheme(scope),
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add(ROOT_DARK_CLASS);
      root.classList.remove(ROOT_LIGHT_CLASS);
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove(ROOT_DARK_CLASS);
      root.classList.add(ROOT_LIGHT_CLASS);
      root.style.colorScheme = 'light';
    }
    try {
      window.localStorage.setItem(`kova_dashboard_theme_${scope}`, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [scope, theme]);

  useEffect(() => {
    return () => {
      const root = document.documentElement;
      root.classList.remove(ROOT_DARK_CLASS);
      root.classList.remove(ROOT_LIGHT_CLASS);
      root.style.colorScheme = '';
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggleTheme,
  };
}
