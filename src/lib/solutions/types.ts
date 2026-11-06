export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";
export type Street = "flop" | "turn" | "river";
export type ActionType = "fold" | "check" | "call" | "bet" | "raise";
export type SolutionSource = "study-model" | "texassolver";
export type Seat = "IP" | "OOP";

export interface ActionDef {
  id: string;
  type: ActionType;
  label: string;
  /** Chips the bet or raise adds, in big blinds. */
  sizeBb?: number;
  /** Bet size as a percent of the pot before the wager. */
  sizePotPct?: number;
  nextNodeId: string | null;
}

export interface ComboLine {
  /** Canonical "AhKd" — higher rank first. */
  cards: string;
  weight: number;
  equity: number;
  /** Frequency-weighted study EV, in bb. */
  ev: number;
  /** Aligned with `DecisionNode.actions`. Sums to 1. */
  freq: number[];
  evs: number[];
  tags: string[];
  primary: string;
}

export interface HandCell {
  /** "AKs", "AKo", or "AA". */
  hand: string;
  weight: number;
  equity: number;
  ev: number;
  freq: number[];
  evs: number[];
  primary: string;
  combos: ComboLine[];
}

export interface HistoryBeat {
  actor: Position;
  action: string;
}

export interface DecisionNode {
  id: string;
  parentId: string | null;
  viaActionId: string | null;
  street: Street;
  board: string[];
  potBb: number;
  toCallBb: number;
  actor: Position;
  actorSeat: Seat;
  history: HistoryBeat[];
  actions: ActionDef[];
  /** 169 cells, row-major, Ace in the top-left. */
  hands: HandCell[];
  summary: {
    freq: number[];
    ev: number;
    combos: number;
  };
  note: string;
}

export interface SpotSolution {
  id: string;
  title: string;
  subtitle: string;
  lesson: string;
  source: SolutionSource;
  sourceNote: string;
  game: "NLHE";
  format: "cash-6max";
  stackBb: number;
  hero: Position;
  villain: Position;
  oop: Position;
  ip: Position;
  preflopLine: string;
  potBb: number;
  effectiveStackBb: number;
  board: string[];
  texture: string[];
  treeLabel: string;
  heroRange: string;
  villainRange: string;
  rootNodeId: string;
  nodes: DecisionNode[];
}

export interface SpotSummary {
  id: string;
  title: string;
  subtitle: string;
  lesson: string;
  source: SolutionSource;
  stackBb: number;
  hero: Position;
  villain: Position;
  potBb: number;
  effectiveStackBb: number;
  board: string[];
  texture: string[];
  treeLabel: string;
  street: Street;
  preflopLine: string;
  nodeCount: number;
}
