import { useEffect, useRef, useState } from "react";
import { LOCALES, type LocaleId } from "@/lib/i18n";
import { useHydrateLocale, useI18n } from "@/lib/locale";
import { cn } from "@/lib/utils";

const FONT: Partial<Record<LocaleId, string>> = {
  zh: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&display=swap",
  ja: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500&display=swap",
  ko: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500&display=swap",
  hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600&display=swap",
  ar: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600&display=swap",
};

export function LanguageMenu() {
  useHydrateLocale();
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = LOCALES.find((item) => item.id === locale) ?? LOCALES[0];

  useEffect(() => {
    document.documentElement.lang = locale;
    const href = FONT[locale];
    if (!href) return;
    const id = `linebook-font-${locale}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [locale]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        aria-label={t.language}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center px-1.5 font-mono text-xs text-faint hover:text-fg"
      >
        {current.code}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-px max-h-[70vh] w-52 overflow-y-auto border border-border bg-surface py-1">
          {LOCALES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setLocale(item.id);
                setOpen(false);
              }}
              className={cn(
                "flex min-h-11 w-full items-center justify-between px-3 text-left text-sm",
                item.id === locale ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span>{item.label}</span>
              <span className="font-mono text-xs text-faint">{item.code}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
