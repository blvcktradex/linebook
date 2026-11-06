import { strategyFill } from "@/lib/poker/format";
import type { DecisionNode, HandCell } from "@/lib/solutions/types";
import { cn } from "@/lib/utils";

export function RangeGrid({
  node,
  selected,
  onSelect,
  diverge,
  hide,
}: {
  node: DecisionNode;
  selected: string | null;
  onSelect: (hand: string) => void;
  /** Optional 0–1 distance per hand. Replaces the strategy colors. */
  diverge?: Map<string, number> | null;
  /** Hands painted as out-of-range (category filter). */
  hide?: Set<string> | null;
}) {
  return (
    <div className="range-grid">
      {node.hands.map((cell) => (
        <Cell
          key={cell.hand}
          cell={cell}
          actions={node.actions}
          selected={selected === cell.hand}
          distance={diverge?.get(cell.hand)}
          hidden={hide?.has(cell.hand) ?? false}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function Cell({
  cell,
  actions,
  selected,
  distance,
  hidden,
  onSelect,
}: {
  cell: HandCell;
  actions: DecisionNode["actions"];
  selected: boolean;
  distance?: number;
  hidden: boolean;
  onSelect: (hand: string) => void;
}) {
  const empty = hidden || cell.weight <= 0 || cell.combos.length === 0;
  const bright = distance !== undefined && distance > 0.4;
  return (
    <button
      type="button"
      onClick={() => onSelect(cell.hand)}
      aria-label={`${cell.hand}${empty ? ", not in range" : ""}`}
      className={cn(
        "cell-box relative flex aspect-square items-center justify-center overflow-hidden bg-cell",
        selected && "z-10 ring-2 ring-inset",
        selected && (bright ? "ring-bg" : "ring-fg"),
      )}
    >
      {!empty && distance === undefined ? (
        <span className="absolute inset-0" style={{ background: strategyFill(actions, cell.freq) }} />
      ) : null}
      {!empty && distance !== undefined ? (
        <span className="absolute inset-0 bg-fg" style={{ opacity: 0.08 + distance * 0.92 }} />
      ) : null}
      <span
        className={cn(
          "cell-face relative",
          bright ? "font-semibold text-bg" : empty ? "font-medium text-cell-label" : "hand-label",
        )}
      >
        {cell.hand}
      </span>
    </button>
  );
}
