'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import ar from './ar.json';
import en from './en.json';

type Lang = 'ar' | 'en';

type I18nContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRTL: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const dictionaries: Record<Lang, Record<string, string>> = {
  ar: ar as Record<string, string>,
  en: en as Record<string, string>,
};

const STORAGE_KEY = 'site-secretary-lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === 'ar' || saved === 'en') setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  const toggleLang = useCallback(() => setLang(lang === 'ar' ? 'en' : 'ar'), [lang, setLang]);

  const t = useCallback((key: string, params?: Record<string, string | number>) => {
    let str = dictionaries[lang][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      }
    }
    return str;
  }, [lang]);

  return <I18nContext.Provider value={{ lang, setLang, toggleLang, t, isRTL: lang === 'ar' }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) return { lang: 'ar', setLang: () => {}, toggleLang: () => {}, t: (k: string) => k, isRTL: true };
  return ctx;
}

export function useFmtDate() {
  const { lang } = useI18n();
  return (date: string | Date | null | undefined): string => {
    if (!date) return '—';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '—';
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return lang === 'ar' ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
    } catch { return '—'; }
  };
}
