/**
 * Convert a TexasSolver dump_result JSON into a Linebook spot.
 *
 *   node --experimental-strip-types solver/convert_texassolver.ts \
 *     --input output_result.json \
 *     --output src/data/spots/my-spot.ts \
 *     --id my-spot \
 *     --title "BTN vs BB" \
 *     --board Qs,Jh,2h \
 *     --oop BB --ip BTN \
 *     --pot 5.5 --stack 100
 *
 * Player 0 in TexasSolver is OOP. Chance nodes (later streets) are not expanded;
 * solve the turn or river as its own spot if you need that street.
 * Add the new id to src/lib/solutions/load.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { canonicalHands, comboKey, handClass, overlaps, parseId } from "../src/lib/poker/cards.ts";
import type { ActionType, DecisionNode, HandCell, Position, SpotSolution } from "../src/lib/solutions/types.ts";

interface Args {
  input: string;
  output: string;
  id: string;
  title: string;
  board: string[];
  oop: Position;
  ip: Position;
  pot: number;
  stack: number;
  hero: Position;
}

interface NormalNode {
  kind: "action" | "chance" | "terminal";
  player: number;
  actions: string[];
  combos: { cards: string; reach: number; probs: number[] }[];
  children: unknown[];
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) map.set(argv[i], argv[i + 1]);
  const board = (map.get("--board") ?? "").split(",").map((card) => card.trim()).filter(Boolean);
  const oop = (map.get("--oop") ?? "BB") as Position;
  const ip = (map.get("--ip") ?? "BTN") as Position;
  return {
    input: map.get("--input") ?? "",
    output: map.get("--output") ?? "",
    id: map.get("--id") ?? "imported-spot",
    title: map.get("--title") ?? "Imported solve",
    board,
    oop,
    ip,
    pot: Number(map.get("--pot") ?? 5.5),
    stack: Number(map.get("--stack") ?? 100),
    hero: (map.get("--hero") ?? ip) as Position,
  };
}

export function normalizeNode(raw: unknown): NormalNode | null {
  if (!raw || typeof raw !== "object") return null;
  const node = raw as Record<string, unknown>;
  if (node.dealcards && typeof node.dealcards === "object") {
    return { kind: "chance", player: 0, actions: [], combos: [], children: [] };
  }
  const type = String(node.type ?? "");
  if (type === "chance") return { kind: "chance", player: 0, actions: [], combos: [], children: [] };
  if (type === "terminal" || type === "showdown") return { kind: "terminal", player: 0, actions: [], combos: [], children: [] };

  const strategy = (node.strategy ?? {}) as Record<string, unknown>;
  const actions = asStrings(node.valid_actions ?? node.actions ?? strategy.actions);
  const combos: NormalNode["combos"] = [];
  if (strategy.strategy && typeof strategy.strategy === "object" && !Array.isArray(strategy.strategy)) {
    for (const [cards, probs] of Object.entries(strategy.strategy as Record<string, number[]>)) {
      combos.push({ cards, reach: 1, probs });
    }
  } else if (Array.isArray(strategy.card_strings) && Array.isArray(strategy.strategy_probs)) {
    const reaches = Array.isArray(strategy.reach_probs) ? (strategy.reach_probs as number[]) : [];
    (strategy.card_strings as string[]).forEach((cards, index) => {
      combos.push({
        cards,
        reach: reaches[index] ?? 1,
        probs: (strategy.strategy_probs as number[][])[index] ?? [],
      });
    });
  }
  if (!actions.length && !combos.length) return { kind: "terminal", player: 0, actions: [], combos: [], children: [] };
  const children = Array.isArray(node.childrens) ? node.childrens : [];
  return { kind: "action", player: Number(node.player ?? 0), actions, combos, children };
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function convertDump(raw: unknown, meta: Omit<Args, "input" | "output">): SpotSolution {
  const root = normalizeNode(raw);
  if (!root || root.kind !== "action") throw new Error("Dump root is not an action node.");
  const boardIds = new Set(meta.board.map(parseId));
  const nodes: DecisionNode[] = [];

  function walk(node: NormalNode, id: string, parentId: string | null, via: string | null, pot: number, history: { actor: Position; action: string }[]): void {
    const actor = node.player === 0 ? meta.oop : meta.ip;
    const actions = node.actions.map((label, index) => {
      const parsed = parseSolverAction(label, pot);
      const child = node.children[index] ? normalizeNode(node.children[index]) : null;
      const next = child && child.kind === "action" ? `${id}-${index}` : null;
      return { id: parsed.id, type: parsed.type, label: parsed.label, sizeBb: parsed.sizeBb, sizePotPct: parsed.sizePotPct, nextNodeId: next, child };
    });

    const grouped = new Map<string, { cards: string; weight: number; freq: number[] }[]>();
    for (const combo of node.combos) {
      const ids = safeCombo(combo.cards);
      if (!ids) continue;
      if (overlaps(ids[0], ids[1], boardIds)) continue;
      const key = comboKey(ids[0], ids[1]);
      const hand = handClass(ids[0], ids[1]);
      const freq = normalize(combo.probs);
      const list = grouped.get(hand) ?? [];
      list.push({ cards: key, weight: combo.reach, freq });
      grouped.set(hand, list);
    }

    const hands: HandCell[] = canonicalHands().map((hand) => {
      const group = grouped.get(hand) ?? [];
      if (!group.length) {
        return { hand, weight: 0, equity: 0, ev: 0, freq: actions.map(() => 0), evs: actions.map(() => 0), primary: "", combos: [] };
      }
      const freq = actions.map(() => 0);
      let weight = 0;
      for (const line of group) {
        weight += line.weight;
        line.freq.forEach((value, index) => {
          freq[index] += value * line.weight;
        });
      }
      const denom = weight || 1;
      const avg = normalize(freq.map((value) => value / denom));
      return {
        hand,
        weight: round3(weight / group.length),
        equity: 0,
        ev: 0,
        freq: avg,
        evs: actions.map(() => 0),
        primary: "",
        combos: group.map((line) => ({
          cards: line.cards,
          weight: round3(line.weight),
          equity: 0,
          ev: 0,
          freq: line.freq,
          evs: actions.map(() => 0),
          tags: [],
          primary: "",
        })),
      };
    });

    let total = 0;
    const summary = actions.map(() => 0);
    for (const hand of hands) {
      for (const combo of hand.combos) {
        total += combo.weight;
        combo.freq.forEach((value, index) => {
          summary[index] += value * combo.weight;
        });
      }
    }

    nodes.push({
      id,
      parentId,
      viaActionId: via,
      street: meta.board.length >= 5 ? "river" : meta.board.length === 4 ? "turn" : "flop",
      board: meta.board,
      potBb: pot,
      toCallBb: 0,
      actor,
      actorSeat: node.player === 0 ? "OOP" : "IP",
      history,
      actions: actions.map(({ child: _child, ...action }) => action),
      hands,
      summary: { freq: total ? normalize(summary.map((value) => value / total)) : actions.map(() => 0), ev: 0, combos: hands.reduce((n, hand) => n + hand.combos.length, 0) },
      note: "Imported from TexasSolver. EV is not in the dump, so study EV is left at zero. Frequencies are reach-weighted.",
    });

    actions.forEach((action, index) => {
      if (!action.nextNodeId || !action.child || action.child.kind !== "action") return;
      const added = action.sizeBb ?? 0;
      walk(action.child, action.nextNodeId, id, action.id, round1(pot + added), history.concat([{ actor, action: action.label }]));
    });
  }

  walk(root, "root", null, null, meta.pot, []);
  const villain = meta.hero === meta.oop ? meta.ip : meta.oop;
  return {
    id: meta.id,
    title: meta.title,
    subtitle: "TexasSolver import",
    lesson: "Frequencies come from a TexasSolver dump. Equity and EV were not in the file.",
    source: "texassolver",
    sourceNote: "Imported from TexasSolver dump_result. Impossible combos that collide with the board are dropped.",
    game: "NLHE",
    format: "cash-6max",
    stackBb: meta.stack,
    hero: meta.hero,
    villain,
    oop: meta.oop,
    ip: meta.ip,
    preflopLine: "See the solver input that produced this dump.",
    potBb: meta.pot,
    effectiveStackBb: meta.stack - meta.pot / 2,
    board: meta.board,
    texture: ["Imported"],
    treeLabel: root.actions.join(" / "),
    heroRange: "",
    villainRange: "",
    rootNodeId: "root",
    nodes,
  };
}

function parseSolverAction(label: string, pot: number): { id: string; type: ActionType; label: string; sizeBb?: number; sizePotPct?: number } {
  const text = label.trim();
  const upper = text.toUpperCase();
  if (upper.startsWith("FOLD")) return { id: "fold", type: "fold", label: "Fold" };
  if (upper.startsWith("CHECK")) return { id: "check", type: "check", label: "Check" };
  if (upper.startsWith("CALL")) return { id: "call", type: "call", label: "Call" };
  const amount = Number(upper.split(/\s+/)[1]);
  const sizeBb = Number.isFinite(amount) ? round1(amount) : undefined;
  const sizePotPct = sizeBb && pot > 0 ? Math.round((sizeBb / pot) * 100) : undefined;
  if (upper.startsWith("RAISE")) return { id: slug(text), type: "raise", label: sizePotPct ? `Raise ${sizePotPct}%` : "Raise", sizeBb, sizePotPct };
  return { id: slug(text), type: "bet", label: sizePotPct ? `Bet ${sizePotPct}%` : "Bet", sizeBb, sizePotPct };
}

function safeCombo(text: string): [number, number] | null {
  const clean = text.replace(/[^2-9TJQKAcdhs]/gi, "");
  if (clean.length !== 4) return null;
  try {
    return [parseId(clean.slice(0, 2)), parseId(clean.slice(2, 4))];
  } catch {
    return null;
  }
}

function normalize(freq: number[]): number[] {
  const sum = freq.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  if (sum <= 0) return freq.map(() => 0);
  return freq.map((value) => round3((Number.isFinite(value) ? value : 0) / sum));
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "action";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function selfCheck(): void {
  const dump = {
    player: 0,
    type: "action",
    valid_actions: ["CHECK", "BET 1.800000"],
    strategy: {
      card_strings: ["AhKd", "AsKs", "QsJh"],
      reach_probs: [1, 1, 0.5],
      strategy_probs: [
        [0.25, 0.75],
        [1, 0],
        [0.5, 0.5],
      ],
    },
    childrens: [{ type: "terminal" }, { type: "chance", dealcards: { "2c": { type: "terminal" } } }],
  };
  const spot = convertDump(dump, {
    id: "mini",
    title: "Mini",
    board: ["Qs", "Jh", "2h"],
    oop: "BB",
    ip: "BTN",
    pot: 5.5,
    stack: 100,
    hero: "BTN",
  });
  const ako = spot.nodes[0].hands.find((hand) => hand.hand === "AKo");
  const aks = spot.nodes[0].hands.find((hand) => hand.hand === "AKs");
  const qj = spot.nodes[0].hands.find((hand) => hand.hand === "QJo");
  if (!ako || ako.combos.length !== 1 || Math.abs(ako.combos[0].freq[1] - 0.75) > 0.001) {
    throw new Error(`AKo conversion failed ${JSON.stringify(ako?.combos)}`);
  }
  if (!aks || aks.combos[0]?.freq[0] !== 1) throw new Error("AKs conversion failed");
  if (qj && qj.combos.length) throw new Error("Board collision was not dropped");
  if (spot.nodes.length !== 1) throw new Error("Chance node should not expand");
  const legacy = convertDump(
    { player: 1, actions: ["FOLD", "CALL"], strategy: { strategy: { AhKd: [0.2, 0.8] } } },
    { id: "legacy", title: "Legacy", board: ["Qs", "Jh", "2h"], oop: "BB", ip: "BTN", pot: 5.5, stack: 100, hero: "BTN" },
  );
  if (legacy.nodes[0].actor !== "BTN") throw new Error("Player 1 should be IP");
  console.log("converter self-check ok");
}

const argv = process.argv.slice(2);
if (argv.includes("--check") || argv.length === 0) {
  selfCheck();
} else {
  const args = parseArgs(argv);
  if (!args.input || !args.output || args.board.length < 3) {
    throw new Error("Need --input, --output, and --board.");
  }
  const dump = JSON.parse(readFileSync(args.input, "utf8")) as unknown;
  const spot = convertDump(dump, args);
  writeFileSync(
    args.output,
    `import type { SpotSolution } from "@/lib/solutions/types";\n\nconst spot: SpotSolution = ${JSON.stringify(spot)};\nexport default spot;\n`,
  );
  console.log(`wrote ${args.output} (${spot.nodes.length} nodes)`);
}
