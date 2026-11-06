import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RangeGrid } from "@/components/range-grid";
import { Shell } from "@/components/shell";
import { MixBar } from "@/components/mix-bar";
import { listSpots, loadAllSpots } from "@/lib/solutions/load";
import type { DecisionNode, SpotSolution } from "@/lib/solutions/types";
import { translateAction, translateClass, translateSubtitle } from "@/lib/i18n";
import { useI18n } from "@/lib/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ranges")({ component: RangesPage });

function RangesPage() {
  const summaries = listSpots();
  const [spots, setSpots] = useState<SpotSolution[] | null>(null);
  const [leftSpot, setLeftSpot] = useState(summaries[0]?.id ?? "");
  const [rightSpot, setRightSpot] = useState(summaries[0]?.id ?? "");
  const [leftNode, setLeftNode] = useState("");
  const [rightNode, setRightNode] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    void loadAllSpots().then((loaded) => {
      setSpots(loaded);
      const first = loaded[0];
      if (!first) return;
      setLeftNode(first.rootNodeId);
      setRightNode(first.nodes[1]?.id ?? first.rootNodeId);
    });
  }, []);

  const left = spots?.find((spot) => spot.id === leftSpot) ?? null;
  const right = spots?.find((spot) => spot.id === rightSpot) ?? null;
  const nodeA = left?.nodes.find((node) => node.id === leftNode) ?? left?.nodes[0] ?? null;
  const nodeB = right?.nodes.find((node) => node.id === rightNode) ?? right?.nodes[0] ?? null;

  const diverge = useMemo(() => {
    if (!showDiff || !nodeA || !nodeB) return null;
    const map = new Map<string, number>();
    for (const hand of nodeA.hands) {
      const other = nodeB.hands.find((cell) => cell.hand === hand.hand);
      map.set(hand.hand, distance(hand.freq, other?.freq ?? []));
    }
    return map;
  }, [showDiff, nodeA, nodeB]);

  return (
    <Shell>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-sm font-medium">{t.ranges}</h1>
        <button
          type="button"
          onClick={() => setShowDiff((value) => !value)}
          className={cn(
            "min-h-11 px-3 text-sm",
            showDiff ? "bg-fg text-bg" : "bg-surface text-muted hover:text-fg",
          )}
        >
          {showDiff ? t.diffOn : t.showDiff}
        </button>
      </div>
      {!nodeA || !nodeB || !left || !right ? (
        <p className="text-sm text-muted">{t.loadingRanges}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Pane
            spots={spots ?? []}
            spotId={left.id}
            nodeId={nodeA.id}
            onSpot={(id) => {
              setLeftSpot(id);
              const spot = spots?.find((item) => item.id === id);
              setLeftNode(spot?.rootNodeId ?? "");
            }}
            onNode={setLeftNode}
            node={nodeA}
            focus={focus}
            onFocus={setFocus}
            diverge={showDiff ? diverge : null}
          />
          <Pane
            spots={spots ?? []}
            spotId={right.id}
            nodeId={nodeB.id}
            onSpot={(id) => {
              setRightSpot(id);
              const spot = spots?.find((item) => item.id === id);
              setRightNode(spot?.nodes[1]?.id ?? spot?.rootNodeId ?? "");
            }}
            onNode={setRightNode}
            node={nodeB}
            focus={focus}
            onFocus={setFocus}
            diverge={showDiff ? diverge : null}
          />
        </div>
      )}
    </Shell>
  );
}

function Pane({
  spots,
  spotId,
  nodeId,
  onSpot,
  onNode,
  node,
  focus,
  onFocus,
  diverge,
}: {
  spots: SpotSolution[];
  spotId: string;
  nodeId: string;
  onSpot: (id: string) => void;
  onNode: (id: string) => void;
  node: DecisionNode;
  focus: string | null;
  onFocus: (hand: string) => void;
  diverge: Map<string, number> | null;
}) {
  const spot = spots.find((item) => item.id === spotId);
  const { t } = useI18n();
  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap gap-2">
        <select className="field" value={spotId} onChange={(event) => onSpot(event.target.value)}>
          {spots.map((item) => (
            <option key={item.id} value={item.id}>
              {translateSubtitle(item.subtitle, t)}
            </option>
          ))}
        </select>
        <select className="field" value={nodeId} onChange={(event) => onNode(event.target.value)}>
          {spot?.nodes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.actor} · {item.history.map((beat) => translateAction(beat.action, t)).join(" / ") || t.open}
            </option>
          ))}
        </select>
      </div>
      <RangeGrid node={node} selected={focus} onSelect={onFocus} diverge={diverge} />
      <div className="mt-3 max-w-sm">
        <MixBar actions={node.actions} freq={node.summary.freq} />
      </div>
      {focus ? <HandLine node={node} hand={focus} /> : null}
    </section>
  );
}

function HandLine({ node, hand }: { node: DecisionNode; hand: string }) {
  const cell = node.hands.find((item) => item.hand === hand);
  const { t } = useI18n();
  if (!cell || cell.weight <= 0) return <p className="mt-3 text-sm text-faint">{fillMissing(t.notInRange, hand)}</p>;
  return (
    <p className="mt-3 text-sm text-muted">
      <span className="font-mono text-fg">{hand}</span> · {translateClass(cell.primary, t) || t.mixWord} · {t.equityWord}{" "}
      {Math.round(cell.equity * 100)}%
    </p>
  );
}

function fillMissing(template: string, hand: string): string {
  return template.replace("{hand}", hand);
}

function distance(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
  return Math.min(1, total / 2);
}
