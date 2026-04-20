'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { POS_DICT, type PosLocale, type PosTKey } from './pos-dict';

interface Ctx {
  locale: PosLocale;
  setLocale: (l: PosLocale) => void;
  t: (k: PosTKey) => string;
}

const PosLocaleCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = 'tibi-pos-lang';

export function PosLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PosLocale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'en') setLocaleState(saved);
    } catch {}
  }, []);

  function setLocale(l: PosLocale) {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }

  function t(k: PosTKey): string {
    return POS_DICT[locale][k] ?? POS_DICT.en[k] ?? k;
  }

  return (
    <PosLocaleCtx.Provider value={{ locale, setLocale, t }}>
      {children}
    </PosLocaleCtx.Provider>
  );
}

export function usePosLocale() {
  const ctx = useContext(PosLocaleCtx);
  if (!ctx) {
    // Fallback if used outside provider (shouldn't happen in practice)
    return {
      locale: 'en' as PosLocale,
      setLocale: () => {},
      t: (k: PosTKey) => POS_DICT.en[k] ?? k,
    };
  }
  return ctx;
}
