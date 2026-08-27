"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type Locale, type MessageKey } from "@/lib/i18n/messages";

type Ctx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey) => string;
  tx: (ja: string, en: string) => string;
};

const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = window.localStorage.getItem("moni-language");
    if (saved === "ja" || saved === "en") {
      setLocaleState(saved);
      document.documentElement.lang = saved;
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    window.localStorage.setItem("moni-language", l);
    document.documentElement.lang = l;
    window.dispatchEvent(new CustomEvent("moni-language-changed", { detail: l }));
  }, []);

  const t = useCallback((key: MessageKey) => messages[locale][key] ?? key, [locale]);
  const tx = useCallback((ja: string, en: string) => (locale === "en" ? en : ja), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t, tx }), [locale, setLocale, t, tx]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) {
    return {
      locale: "ja" as Locale,
      setLocale: () => undefined,
      t: (key: MessageKey) => messages.ja[key] ?? key,
      tx: (ja: string, _en?: string) => ja,
    };
  }
  return ctx;
}
