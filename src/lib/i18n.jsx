// Lightweight i18n system for MyStore OS.
// No heavy libraries — just a locale-aware translation lookup.
import { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import en from './translations/en';

// Lazy-load Hindi and Telugu to keep initial bundle small
const translationLoaders = {
  en: () => Promise.resolve(en),
  hi: () => import('./translations/hi').then(m => m.default),
  te: () => import('./translations/te').then(m => m.default),
};

const STORAGE_KEY = 'mystore_locale';
const SUPPORTED_LOCALES = ['en', 'hi', 'te'];

function getInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored)) return stored;
  } catch { /* ignore */ }
  return 'en';
}

// i18n Context
const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);
  const [translations, setTranslations] = useState(locale === 'en' ? en : en);
  const [loadingLang, setLoadingLang] = useState(false);

  // Load initial non-English locale — runs once on mount only
  useEffect(() => {
    if (locale !== 'en') {
      translationLoaders[locale]?.().then(t => setTranslations(t)).catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback(async (code) => {
    if (!SUPPORTED_LOCALES.includes(code)) return;
    setLoadingLang(true);
    try {
      const t = await translationLoaders[code]();
      setTranslations(t);
      setLocaleState(code);
      localStorage.setItem(STORAGE_KEY, code);
    } catch (err) {
      console.error('[i18n] Failed to load locale', code, err);
    } finally {
      setLoadingLang(false);
    }
  }, []);

  // t() function — returns translated string, falls back to English, then to the key itself
  const t = useCallback((key) => {
    return translations[key] || en[key] || key;
  }, [translations]);

  const value = useMemo(() => ({
    t,
    locale,
    setLocale,
    loadingLang,
    locales: SUPPORTED_LOCALES,
  }), [t, locale, setLocale, loadingLang]);

  return (
    <I18nContext value={value}>
      {children}
    </I18nContext>
  );
}

// Hook for components to access translations
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback if used outside provider — returns English
    return {
      t: (key) => en[key] || key,
      locale: 'en',
      setLocale: () => {},
      loadingLang: false,
      locales: SUPPORTED_LOCALES,
    };
  }
  return ctx;
}
