import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Board } from "@/components/playing-card";
import { ActionTiles } from "@/components/mix-bar";
import { PlayingCard } from "@/components/playing-card";
import { RangeGrid } from "@/components/range-grid";
import { Shell } from "@/components/shell";
import { actionColor, bb, historyColor, pct, pct1, strategyFill } from "@/lib/poker/format";
import { listSpots, loadSpot } from "@/lib/solutions/load";
import type { ComboLine, DecisionNode, HandCell, SpotSolution } from "@/lib/solutions/types";
import { lessonText, translateAction, translateClass, translateSubtitle } from "@/lib/i18n";
import { useI18n } from "@/lib/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/spots/$spotId")({
  loader: async ({ params }) => {
    const spot = await loadSpot(params.spotId);
    if (!spot) throw notFound();
    return spot;
  },
  notFoundComponent: SpotMissing,
  component: SpotPage,
});

function busiest(nodes: DecisionNode[]): string {
  let best = nodes[0];
  let score = -1;
  for (const node of nodes) {
    let entropy = 0;
    for (const share of node.summary.freq) if (share > 0) entropy -= share * Math.log2(share);
    if (entropy > score) {
      score = entropy;
      best = node;
    }
  }
  return best?.id ?? nodes[0].id;
}

function firstLive(node: DecisionNode, prefer = "AKs"): string | null {
  const preferred = node.hands.find((hand) => hand.hand === prefer && hand.weight > 0 && hand.combos.length);
  if (preferred) return preferred.hand;
  return node.hands.find((hand) => hand.weight > 0 && hand.combos.length)?.hand ?? null;
}

function SpotMissing() {
  const { t } = useI18n();
  return (
    <Shell>
      <h1 className="text-lg font-semibold">{t.missing}</h1>
      <Link to="/" className="mt-3 inline-flex min-h-11 items-center text-sm text-muted hover:text-fg">
        {t.backToStudy}
      </Link>
    </Shell>
  );
}

function SpotPage() {
  const spot = Route.useLoaderData();
  const [nodeId, setNodeId] = useState(() => busiest(spot.nodes));
  const [handName, setHandName] = useState<string | null>(() => {
    const node = spot.nodes.find((item) => item.id === busiest(spot.nodes)) ?? spot.nodes[0];
    return firstLive(node);
  });
  const [comboId, setComboId] = useState<string | null>(null);
  const [tab, setTab] = useState<"hands" | "summary" | "filters">("hands");
  const [filter, setFilter] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const node = spot.nodes.find((item) => item.id === nodeId) ?? spot.nodes[0];
  const cell = node.hands.find((item) => item.hand === handName) ?? null;
  const combo = cell?.combos.find((item) => item.cards === comboId) ?? cell?.combos[0] ?? null;

  const classes = useMemo(() => groupClasses(node), [node]);
  const hidden = useMemo(() => {
    if (!filter) return null;
    const group = classes.find((item) => item.id === filter);
    if (!group) return null;
    const set = new Set<string>();
    for (const hand of node.hands) if (!group.hands.has(hand.hand)) set.add(hand.hand);
    return set;
  }, [classes, filter, node.hands]);
  const { t } = useI18n();

  useEffect(() => {
    const next = spot.nodes.find((item) => item.id === busiest(spot.nodes)) ?? spot.nodes[0];
    setNodeId(next.id);
    setHandName(firstLive(next));
    setComboId(null);
    setFilter(null);
    setTab("hands");
    setPicker(false);
  }, [spot.id, spot.nodes]);

  function selectHand(hand: string) {
    setHandName(hand);
    const next = node.hands.find((item) => item.hand === hand);
    setComboId(next?.combos[0]?.cards ?? null);
    setTab("hands");
  }

  function selectNode(id: string) {
    const next = spot.nodes.find((item) => item.id === id) ?? spot.nodes[0];
    setNodeId(next.id);
    setHandName(firstLive(next));
    setComboId(null);
    setFilter(null);
  }

  return (
    <Shell>
      <div className="flex flex-col gap-1.5">
        <div className="min-w-0">
          <button
            type="button"
            aria-expanded={picker}
            aria-label={t.changeSpot}
            onClick={() => setPicker((open) => !open)}
            className="flex min-h-11 w-full min-w-0 items-center gap-2 text-left"
          >
            <span className="shrink-0 font-mono text-xs text-faint tabular-nums">{spot.stackBb}bb</span>
            <span className="shrink-0 text-sm font-medium">{spot.title}</span>
            <span className="min-w-0 truncate text-sm text-muted sm:hidden">{translateSubtitle(spot.subtitle, t).split(" · ").pop()}</span>
            <span className="hidden min-w-0 truncate text-sm text-muted sm:inline">{translateSubtitle(spot.subtitle, t)}</span>
            <Caret open={picker} />
          </button>
        </div>
        {picker ? (
          <div className="border border-border bg-surface">
            {listSpots().map((item) => (
              <Link
                key={item.id}
                to="/spots/$spotId"
                params={{ spotId: item.id }}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-3 px-3 text-sm hover:bg-surface-2",
                  item.id === spot.id && "bg-surface-2",
                )}
              >
                <span>{translateSubtitle(item.subtitle, t)}</span>
                <span className="font-mono text-xs text-faint">
                  {item.hero} {t.vs} {item.villain}
                </span>
              </Link>
            ))}
          </div>
        ) : null}

        <div className="flex gap-1 overflow-x-auto">
          {spot.nodes.map((item) => {
            const active = item.id === node.id;
            const last = item.history[item.history.length - 1];
            const pip = last ? historyColor(last.action) : "var(--color-faint)";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectNode(item.id)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-2 text-sm",
                  active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                <span className="h-3 w-1 shrink-0" style={{ background: pip }} />
                <span>
                  {last?.actor ?? item.actor} {last ? translateAction(last.action, t) : t.toAct}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid items-start gap-1.5 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
          <section className="min-w-0">
            <RangeGrid node={node} selected={handName} onSelect={selectHand} hide={hidden} />
          </section>
          <aside className="flex min-w-0 flex-col gap-px">
            <TableBox spot={spot} node={node} />
            <ActionTiles
              actions={node.actions}
              freq={node.summary.freq}
              onSelect={(id) => {
                const action = node.actions.find((item) => item.id === id);
                if (action?.nextNodeId) selectNode(action.nextNodeId);
              }}
            />
            <div className="flex border-b border-border bg-bg">
              {(
                [
                  ["hands", t.hands],
                  ["summary", t.summary],
                  ["filters", t.filters],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "min-h-11 px-3 text-sm",
                    tab === id ? "border-b-2 border-fg text-fg" : "border-b-2 border-transparent text-muted hover:text-fg",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "hands" ? (
              <Hands node={node} cell={cell} combo={combo} onCombo={setComboId} />
            ) : null}
            {tab === "summary" ? <Summary spot={spot} node={node} cell={cell} combo={combo} /> : null}
            {tab === "filters" ? (
              <Filters
                actions={node.actions}
                classes={classes}
                active={filter}
                onPick={(id) => {
                  setFilter(id);
                  if (!id) return;
                  const group = classes.find((item) => item.id === id);
                  if (group && (!handName || !group.hands.has(handName))) {
                    const next = group.hands.values().next().value as string | undefined;
                    if (next) selectHand(next);
                  }
                }}
              />
            ) : null}
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function TableBox({ spot, node }: { spot: SpotSolution; node: DecisionNode }) {
  const odds = node.toCallBb > 0 ? node.toCallBb / (node.potBb + node.toCallBb) : null;
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 bg-surface px-3 py-2">
      <Player name={spot.oop} stack={spot.effectiveStackBb} active={node.actor === spot.oop} acting={t.toAct} />
      <div className="flex flex-col items-center gap-1">
        <Board cards={node.board} size="xs" />
        <p className="font-mono text-xs text-muted tabular-nums">
          {bb(node.potBb)}
          {odds !== null ? ` · ${pct(odds)}` : ""}
        </p>
      </div>
      <Player name={spot.ip} stack={spot.effectiveStackBb} active={node.actor === spot.ip} dealer align="end" acting={t.toAct} />
    </div>
  );
}

function Player({
  name,
  stack,
  active,
  dealer = false,
  align = "start",
  acting,
}: {
  name: string;
  stack: number;
  active: boolean;
  dealer?: boolean;
  align?: "start" | "end";
  acting: string;
}) {
  return (
    <div className={cn("min-w-0 leading-tight", align === "end" && "text-right", active ? "text-fg" : "text-muted")}>
      <p className="text-sm font-medium">
        {name}
        {dealer ? " · D" : ""}
      </p>
      <p className="font-mono text-xs tabular-nums">{bb(stack)}</p>
      <p className={cn("text-xs", active ? "text-faint" : "invisible")}>{acting}</p>
    </div>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={cn("shrink-0 text-faint", open && "rotate-180")}>
      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Hands({
  node,
  cell,
  combo,
  onCombo,
}: {
  node: DecisionNode;
  cell: HandCell | null;
  combo: ComboLine | null;
  onCombo: (cards: string) => void;
}) {
  const { t } = useI18n();
  if (!cell || !combo || cell.weight <= 0) {
    return <p className="px-2 py-4 text-sm text-muted">{t.selectHand}</p>;
  }
  return (
    <div>
      <div className="flex items-baseline justify-between px-2 py-1.5">
        <p className="font-mono text-sm font-semibold">{cell.hand}</p>
        <p className="text-xs text-muted capitalize">{translateClass(combo.primary, t)}</p>
      </div>
      <div className="flex max-h-[28rem] flex-col gap-px overflow-y-auto bg-bg">
        {cell.combos.map((item) => (
          <button
            key={item.cards}
            type="button"
            onClick={() => onCombo(item.cards)}
            className={cn("flex min-h-11 items-center gap-2 px-1.5 py-1 text-left text-on-action", item.cards === combo.cards && "ring-1 ring-fg ring-inset")}
            style={{ background: strategyFill(node.actions, item.freq) }}
          >
            <span className="flex shrink-0 gap-0.5">
              <PlayingCard card={item.cards.slice(0, 2)} size="xs" />
              <PlayingCard card={item.cards.slice(2, 4)} size="xs" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center bg-bg/60 px-2 py-0.5">
              {node.actions.map((action, index) => {
                const share = item.freq[index] ?? 0;
                return (
                  <span
                    key={action.id}
                    className={cn("flex items-baseline justify-between gap-3 text-xs leading-4", share < 0.005 && "opacity-40")}
                  >
                    <span className="truncate">{translateAction(action.label, t)}</span>
                    <span className="font-mono tabular-nums">{pct1(share)}</span>
                  </span>
                );
              })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Summary({
  spot,
  node,
  cell,
  combo,
}: {
  spot: SpotSolution;
  node: DecisionNode;
  cell: HandCell | null;
  combo: ComboLine | null;
}) {
  const { locale, t } = useI18n();
  return (
    <div className="px-2 py-2">
      <dl className="grid grid-cols-3 border border-border">
        <div className="border-r border-border px-2 py-2">
          <dt className="text-xs text-faint">{t.equity}</dt>
          <dd className="font-mono text-sm tabular-nums">{combo ? pct(combo.equity) : "—"}</dd>
        </div>
        <div className="border-r border-border px-2 py-2">
          <dt className="text-xs text-faint">{t.ev}</dt>
          <dd className="font-mono text-sm tabular-nums">{combo ? `${combo.ev.toFixed(2)}` : node.summary.ev.toFixed(2)}</dd>
        </div>
        <div className="px-2 py-2">
          <dt className="text-xs text-faint">{t.combos}</dt>
          <dd className="font-mono text-sm tabular-nums">{node.summary.combos}</dd>
        </div>
      </dl>
      {combo ? (
        <ul className="mt-2">
          {node.actions.map((action, index) => (
            <li key={action.id} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm last:border-b-0">
              <span className="flex items-center gap-2">
                <span className="size-2 shrink-0" style={{ background: historyColor(action.label) }} />
                {translateAction(action.label, t)}
              </span>
              <span className="font-mono text-xs text-muted tabular-nums">
                {pct1(combo.freq[index] ?? 0)} · {(combo.evs[index] ?? 0).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {locale === "en" ? (combo ? spot.lesson : (node.note ?? spot.lesson)) : lessonText(spot.id, t, spot.lesson)}
      </p>
    </div>
  );
}

interface HandClass {
  id: string;
  label: string;
  hands: Set<string>;
  weight: number;
  freq: number[];
}

function Filters({
  actions,
  classes,
  active,
  onPick,
}: {
  actions: DecisionNode["actions"];
  classes: HandClass[];
  active: string | null;
  onPick: (id: string | null) => void;
}) {
  const { t } = useI18n();
  return (
    <div>
      {active ? (
        <button type="button" onClick={() => onPick(null)} className="min-h-11 px-2 text-xs text-muted hover:text-fg">
          {t.clearFilter}
        </button>
      ) : null}
      {classes.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onPick(item.id === active ? null : item.id)}
          className={cn(
            "flex min-h-11 w-full items-center gap-2 border-b border-border px-2 text-left text-sm",
            item.id === active ? "bg-surface-2" : "hover:bg-surface",
          )}
        >
          <span className="w-24 shrink-0 capitalize">{translateClass(item.id, t)}</span>
          <span className="flex h-2 min-w-0 flex-1 overflow-hidden bg-surface-2">
            {actions.map((action, index) => {
              const share = item.freq[index] ?? 0;
              if (share <= 0) return null;
              return <span key={action.id} className="h-full" style={{ width: `${share * 100}%`, background: actionColor(action) }} />;
            })}
          </span>
          <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">{item.weight.toFixed(1)}</span>
        </button>
      ))}
    </div>
  );
}

function groupClasses(node: DecisionNode): HandClass[] {
  const map = new Map<string, HandClass>();
  for (const cell of node.hands) {
    if (cell.weight <= 0) continue;
    const id = cell.primary || "other";
    let row = map.get(id);
    if (!row) {
      row = { id, label: id.replace(/-/g, " "), hands: new Set(), weight: 0, freq: node.actions.map(() => 0) };
      map.set(id, row);
    }
    row.hands.add(cell.hand);
    row.weight += cell.weight;
    cell.freq.forEach((share, index) => {
      row.freq[index] += share * cell.weight;
    });
  }
  return [...map.values()]
    .map((row) => ({ ...row, freq: row.freq.map((value) => value / (row.weight || 1)) }))
    .sort((a, b) => b.weight - a.weight);
}
