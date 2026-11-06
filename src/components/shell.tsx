import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LanguageMenu } from "@/components/language-menu";
import { useI18n } from "@/lib/locale";
import { cn } from "@/lib/utils";

import { useHydrateProgress, useProgress } from "@/lib/progress";

export function Shell({ children }: { children: ReactNode }) {
  useHydrateProgress();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const hands = useProgress((state) => state.hands);
  const matches = useProgress((state) => state.matches);
  const rate = hands > 0 ? Math.round((matches / hands) * 100) : null;
  const study = path.startsWith("/spots");
  const { t } = useI18n();
  const links = [
    { to: "/", label: t.study },
    { to: "/train", label: t.practice },
    { to: "/ranges", label: t.ranges },
    { to: "/review", label: t.analyze },
  ] as const;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="flex h-12 items-center gap-1 px-2 sm:gap-3 sm:px-3">
          <Link to="/" className="shrink-0 px-1 text-sm font-semibold tracking-tight">
            Linebook
          </Link>
          <nav className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {links.map((link) => {
              const active = link.to === "/" ? path === "/" || path.startsWith("/spots") : path.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center border-b-2 px-2.5 text-sm",
                    active ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          {rate === null ? null : <p className="shrink-0 font-mono text-xs tabular-nums text-muted">{rate}%</p>}
          <a
            href="https://swcpoker.club"
            target="_blank"
            rel="noreferrer noopener"
            title={t.affiliated}
            className="inline-flex min-h-11 shrink-0 items-center px-1 text-xs text-faint hover:text-fg"
          >
            <span className="sm:hidden">SwC</span>
            <span className="hidden sm:inline">SwC Poker</span>
          </a>
          <LanguageMenu />
        </div>
      </header>
      <main className={cn("mx-auto w-full", study ? "max-w-[100rem] px-1.5 py-2 sm:px-2" : "max-w-[90rem] px-3 py-3")}>{children}</main>
    </div>
  );
}
