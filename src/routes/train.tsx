import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Board, CardBack, PlayingCard } from "@/components/playing-card";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { actionColor, bb, pct } from "@/lib/poker/format";
import { listSpots, loadAllSpots } from "@/lib/solutions/load";
import type { ActionDef, ComboLine, DecisionNode, SpotSolution } from "@/lib/solutions/types";
import { useProgress } from "@/lib/progress";
import { useI18n } from "@/lib/locale";
import { translateAction, translateSubtitle } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/train")({
  validateSearch: (search: Record<string, unknown>): { spot: string } => ({
    spot: typeof search.spot === "string" ? search.spot : "all",
  }),
  component: TrainPage,
});

interface Deal {
  spot: SpotSolution;
  node: DecisionNode;
  combo: ComboLine;
  hand: string;
}

function TrainPage() {
  const search = Route.useSearch();
  const summaries = listSpots();
  const [spots, setSpots] = useState<SpotSolution[] | null>(null);
  const [filter, setFilter] = useState(search.spot);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const record = useProgress((state) => state.record);
  const reset = useProgress((state) => state.reset);
  const hands = useProgress((state) => state.hands);
  const matches = useProgress((state) => state.matches);
  const streak = useProgress((state) => state.streak);
  const bestStreak = useProgress((state) => state.bestStreak);
  const { t } = useI18n();

  useEffect(() => {
    let alive = true;
    void loadAllSpots().then((loaded) => {
      if (!alive) return;
      setSpots(loaded);
      setDeal(draw(loaded, filter));
    });
    return () => {
      alive = false;
    };
    // The first draw waits on the library. Filter changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!deal || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === "n" || event.key === "N") {
        if (picked !== null && spots) {
          setPicked(null);
          setDeal(draw(spots, filter));
        }
        return;
      }
      const index = Number(event.key) - 1;
      if (picked === null && index >= 0 && index < deal.node.actions.length) choose(index);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function choose(index: number) {
    if (!deal || picked !== null) return;
    setPicked(index);
    const freq = deal.combo.freq[index] ?? 0;
    let best = 0;
    deal.combo.freq.forEach((value, action) => {
      if (value > deal.combo.freq[best]) best = action;
    });
    record(deal.spot.id, freq >= 0.2 || index === best);
  }

  function next() {
    if (!spots) return;
    setPicked(null);
    setDeal(draw(spots, filter));
  }

  const graded = deal && picked !== null ? grade(deal, picked) : null;

  return (
    <Shell>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-muted">
          <span>
            {t.inMix} {hands ? `${Math.round((matches / hands) * 100)}%` : "—"}
          </span>
          <span>
            {t.streak} {streak}
          </span>
          <span>
            {t.best} {bestStreak}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="field min-w-40"
            aria-label={t.spot}
            value={filter}
            onChange={(event) => {
              const value = event.target.value;
              setFilter(value);
              setPicked(null);
              if (spots) setDeal(draw(spots, value));
            }}
          >
            <option value="all">{t.allSpots}</option>
            {summaries.map((spot) => (
              <option key={spot.id} value={spot.id}>
                {translateSubtitle(spot.subtitle, t)}
              </option>
            ))}
          </select>
          <button type="button" onClick={reset} className="min-h-11 px-2 text-sm text-muted hover:text-fg">
            {t.reset}
          </button>
        </div>
      </div>

      {!deal ? (
        <p className="text-sm text-muted">{t.dealing}</p>
      ) : (
        <PracticeTable deal={deal} picked={picked} graded={graded} onChoose={choose} onNext={next} />
      )}
    </Shell>
  );
}

function PracticeTable({
  deal,
  picked,
  graded,
  onChoose,
  onNext,
}: {
  deal: Deal;
  picked: number | null;
  graded: { matched: boolean; evLoss: number; best: ActionDef } | null;
  onChoose: (index: number) => void;
  onNext: () => void;
}) {
  const hero = deal.node.actor;
  const villain = hero === deal.spot.ip ? deal.spot.oop : deal.spot.ip;
  const { t } = useI18n();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border border-border bg-surface px-3 py-4">
        <div>
          <p className="text-xs text-muted">{villain}</p>
          <div className="mt-2 flex gap-1">
            <CardBack size="sm" />
            <CardBack size="sm" />
          </div>
        </div>
        <div className="text-center">
          <Board cards={deal.node.board} size={deal.node.board.length > 3 ? "xs" : "sm"} />
          <p className="mt-2 font-mono text-xs text-muted tabular-nums">
            {bb(deal.node.potBb)}
            {deal.node.toCallBb ? ` · ${bb(deal.node.toCallBb)}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{hero}</p>
          <div className="mt-2 flex justify-end gap-1">
            <PlayingCard card={deal.combo.cards.slice(0, 2)} size="md" />
            <PlayingCard card={deal.combo.cards.slice(2, 4)} size="md" />
          </div>
          <p className="mt-1 font-mono text-xs text-muted">{deal.hand}</p>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-px",
          deal.node.actions.length <= 2 ? "grid-cols-2" : deal.node.actions.length === 3 ? "grid-cols-3" : "grid-cols-4",
        )}
      >
        {deal.node.actions.map((action, index) => {
          const active = picked === index;
          const freq = deal.combo.freq[index] ?? 0;
          return (
            <button
              key={action.id}
              type="button"
              disabled={picked !== null}
              onClick={() => onChoose(index)}
              style={{ background: actionColor(action) }}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center px-3 text-left text-on-action",
                picked !== null && !active && "opacity-40",
              )}
            >
              <span className="text-sm font-semibold">{translateAction(action.label, t)}</span>
              <span className="font-mono text-xs tabular-nums">{picked !== null ? pct(freq) : action.sizeBb ? bb(action.sizeBb) : "\u00a0"}</span>
            </button>
          );
        })}
      </div>

      {picked === null ? null : graded ? (
        <div className="flex items-center justify-between gap-3 bg-surface px-3 py-3">
          <div className="min-w-0">
            <p className={graded.matched ? "text-sm font-medium text-check" : "text-sm font-medium text-raise"}>
              {graded.matched ? t.inTheMix : t.offTheMix}
            </p>
            <p className="mt-1 font-mono text-xs text-faint tabular-nums">
              {pct(deal.combo.freq[picked] ?? 0)} · {graded.evLoss.toFixed(2)}bb · {translateAction(graded.best.label, t)}
            </p>
          </div>
          <Button variant="primary" onClick={onNext}>
            {t.next}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function grade(deal: Deal, picked: number) {
  let bestIndex = 0;
  deal.combo.evs.forEach((value, index) => {
    if (value > deal.combo.evs[bestIndex]) bestIndex = index;
  });
  let freqBest = 0;
  deal.combo.freq.forEach((value, index) => {
    if (value > deal.combo.freq[freqBest]) freqBest = index;
  });
  const freq = deal.combo.freq[picked] ?? 0;
  return {
    matched: freq >= 0.2 || picked === freqBest,
    evLoss: Math.max(0, Math.round(((deal.combo.evs[bestIndex] ?? 0) - (deal.combo.evs[picked] ?? 0)) * 100) / 100),
    best: deal.node.actions[bestIndex],
  };
}

function draw(spots: SpotSolution[], filter: string): Deal | null {
  const pool = spots.filter((spot) => filter === "all" || spot.id === filter);
  if (!pool.length) return null;
  const nodes = pool.flatMap((spot) => spot.nodes.map((node) => ({ spot, node })));
  const chosen = pick(nodes, ({ node }) => 0.35 + entropy(node.summary.freq));
  const combos = chosen.node.hands.flatMap((hand) => hand.combos.map((combo) => ({ combo, hand: hand.hand })));
  const live = combos.filter((item) => item.combo.weight > 0);
  if (!live.length) return null;
  const card = pick(live, (item) => item.combo.weight);
  return { spot: chosen.spot, node: chosen.node, combo: card.combo, hand: card.hand };
}

function entropy(freq: number[]): number {
  let value = 0;
  for (const share of freq) if (share > 0) value -= share * Math.log2(share);
  return value;
}

function pick<T>(items: T[], weight: (item: T) => number): T {
  let total = 0;
  for (const item of items) total += Math.max(0, weight(item));
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= Math.max(0, weight(item));
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}
