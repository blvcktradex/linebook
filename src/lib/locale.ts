import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATALOGS, type Dict, type LocaleId, isLocaleId } from "@/lib/i18n";

interface LocaleState {
  locale: LocaleId;
  setLocale: (locale: LocaleId) => void;
}

export const useLocale = create<LocaleState>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: "linebook-locale",
      skipHydration: true,
      merge: (persisted, current) => {
        const saved = persisted as Partial<LocaleState> | undefined;
        const locale = saved?.locale && isLocaleId(saved.locale) ? saved.locale : current.locale;
        return { ...current, locale };
      },
    },
  ),
);

export function useHydrateLocale(): void {
  useEffect(() => {
    void useLocale.persist.rehydrate();
  }, []);
}

export function useI18n(): { locale: LocaleId; setLocale: (locale: LocaleId) => void; t: Dict } {
  const locale = useLocale((state) => state.locale);
  const setLocale = useLocale((state) => state.setLocale);
  return { locale, setLocale, t: CATALOGS[locale] };
}
