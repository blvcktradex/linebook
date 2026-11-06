import { applySuitMap, findSuitMap, parseCombo, comboKey } from "./cards.ts";
import type { ActionDef, DecisionNode, Position, SpotSolution } from "../solutions/types.ts";

export interface ParsedAction {
  actor: Position;
  text: string;
}

export interface ParsedHistory {
  board: string[];
  hero: Position | null;
  heroCards: string | null;
  actions: ParsedAction[];
}

export interface DecisionGrade {
  nodeId: string;
  actor: Position;
  actionLabel: string;
  matched: ActionDef | null;
  /** Who this grade is about. */
  scope: "hero-combo" | "range" | "unmatched";
  hand: string | null;
  cards: string | null;
  frequency: number | null;
  bestLabel: string | null;
  bestFrequency: number | null;
  evLoss: number | null;
  severity: "match" | "thin" | "deviation" | "unknown";
  detail: string;
}

export function parseHistory(raw: string): ParsedHistory {
  const text = raw.replace(/\r/g, "");
  const board = findBoard(text);
  const hero = findHeroPosition(text);
  const heroCards = findHeroCards(text);
  const actions: ParsedAction[] = [];
  let postflop = false;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/board\s*[:=]|\bflop\b|\*\*\*\s*flop/i.test(trimmed)) postflop = true;
    if (!postflop || /^board\b/i.test(trimmed) || /^\*\*\*/.test(trimmed)) continue;
    const actor = lineActor(trimmed);
    if (!actor) continue;
    const rest = trimmed.slice(actor.length).replace(/^[\s:–-]+/, "");
    if (!rest) continue;
    actions.push({ actor, text: rest });
  }
  return { board, hero, heroCards, actions };
}

export function findBoard(text: string): string[] {
  const bracket = text.match(
    /\[\s*([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])(?:\s+([2-9TJQKA][cdhs]))?(?:\s+([2-9TJQKA][cdhs]))?\s*\]/i,
  );
  const loose = text.match(
    /board\s*[:=]?\s*([2-9TJQKA][cdhs])[\s,]*([2-9TJQKA][cdhs])[\s,]*([2-9TJQKA][cdhs])(?:[\s,]*([2-9TJQKA][cdhs]))?(?:[\s,]*([2-9TJQKA][cdhs]))?/i,
  );
  const m = bracket ?? loose;
  if (!m) return [];
  return [m[1], m[2], m[3], m[4], m[5]].filter(Boolean).map((c) => c[0].toUpperCase() + c[1].toLowerCase());
}

function findHeroPosition(text: string): Position | null {
  const m = text.match(/hero\s*[:=]?\s*(UTG|HJ|CO|BTN|SB|BB)/i);
  if (m) return m[1].toUpperCase() as Position;
  return null;
}

function findHeroCards(text: string): string | null {
  const labeled = text.match(
    /hero(?:\s*[:=]?\s*(?:UTG|HJ|CO|BTN|SB|BB))?\s*[:=]?\s*([2-9TJQKA][cdhs])\s*([2-9TJQKA][cdhs])/i,
  );
  if (labeled) return labeled[1][0].toUpperCase() + labeled[1][1].toLowerCase() + labeled[2][0].toUpperCase() + labeled[2][1].toLowerCase();
  const dealt = text.match(/dealt to [^[]+\[([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\]/i);
  if (dealt) return dealt[1][0].toUpperCase() + dealt[1][1].toLowerCase() + dealt[2][0].toUpperCase() + dealt[2][1].toLowerCase();
  return null;
}

function lineActor(line: string): Position | null {
  const m = line.match(/^(UTG|HJ|CO|BTN|SB|BB)\b/i);
  if (!m) return null;
  return m[1].toUpperCase() as Position;
}

export function matchSpot(board: string[], spots: SpotSolution[]): { spot: SpotSolution; suitMap: Record<string, string> } | null {
  let fallback: { spot: SpotSolution; suitMap: Record<string, string> } | null = null;
  for (const spot of spots) {
    if (spot.board.length !== board.length) continue;
    const suitMap = findSuitMap(board, spot.board);
    if (!suitMap) continue;
    const exact = board.every((card, i) => applySuitMap(card, suitMap) === spot.board[i] || spot.board.includes(applySuitMap(card, suitMap)));
    if (exact && board.map((c) => applySuitMap(c, suitMap)).join("") === spot.board.join("")) return { spot, suitMap };
    fallback = { spot, suitMap };
  }
  return fallback;
}

export function matchAction(text: string, actions: ActionDef[]): ActionDef | null {
  const t = text.toLowerCase();
  if (/\bcheck/.test(t)) return actions.find((a) => a.type === "check") ?? null;
  if (/\bfold/.test(t)) return actions.find((a) => a.type === "fold") ?? null;
  if (/\bcall/.test(t)) return actions.find((a) => a.type === "call") ?? null;
  const bets = actions.filter((a) => a.type === "bet" || a.type === "raise");
  const pct = t.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct && bets.length) {
    const target = Number(pct[1]);
    return closest(bets, (a) => Math.abs((a.sizePotPct ?? 0) - target));
  }
  if (/\braise|\bcheck-?raise|\bxr\b/.test(t)) return actions.find((a) => a.type === "raise") ?? bets[bets.length - 1] ?? null;
  if (/\ball-?in|\bjam|\bshove|\boverbet/.test(t)) {
    return closest(bets, (a) => -(a.sizePotPct ?? 0));
  }
  if (/\bbet|\bbarrel|\bc-?bet|\bstab/.test(t)) {
    if (/\bsmall|\bthird|\b1\/3|\b33\b/.test(t)) return bets.find((a) => (a.sizePotPct ?? 100) <= 40) ?? bets[0] ?? null;
    if (/\bbig|\blarge|\b3\/4|\b75\b|\bpot\b|\b2\/3|\b66\b/.test(t)) {
      return closest(bets, (a) => Math.abs((a.sizePotPct ?? 0) - 70));
    }
    return bets[0] ?? null;
  }
  return null;
}

function closest(actions: ActionDef[], score: (a: ActionDef) => number): ActionDef | null {
  if (!actions.length) return null;
  return actions.reduce((best, action) => (score(action) < score(best) ? action : best));
}

export function gradeHistory(spot: SpotSolution, parsed: ParsedHistory, suitMap: Record<string, string>): DecisionGrade[] {
  const grades: DecisionGrade[] = [];
  let node: DecisionNode | undefined = spot.nodes.find((n) => n.id === spot.rootNodeId);
  const heroCards = parsed.heroCards
    ? comboKey(
        ...parseCombo(applySuitMap(parsed.heroCards.slice(0, 2), suitMap) + applySuitMap(parsed.heroCards.slice(2, 4), suitMap)),
      )
    : null;

  for (const beat of parsed.actions) {
    if (!node) {
      grades.push(unknown(beat, "Line left the precomputed tree."));
      continue;
    }
    if (beat.actor !== node.actor) {
      const later = findUpcoming(spot, node, beat.actor);
      if (!later) {
        grades.push(unknown(beat, `${beat.actor} is not the player to act in this line.`));
        continue;
      }
      node = later;
    }
    const action = matchAction(beat.text, node.actions);
    if (!action) {
      grades.push(unknown(beat, `Couldn't match “${beat.text.trim()}” to ${node.actions.map((a) => a.label).join(" / ")}.`));
      continue;
    }
    const idx = node.actions.findIndex((a) => a.id === action.id);
    const heroHere = parsed.hero ? beat.actor === parsed.hero : beat.actor === spot.hero;
    if (heroHere && heroCards) {
      const combo = findCombo(node, heroCards);
      if (!combo) {
        grades.push({
          nodeId: node.id,
          actor: beat.actor,
          actionLabel: action.label,
          matched: action,
          scope: "hero-combo",
          hand: null,
          cards: heroCards,
          frequency: 0,
          bestLabel: null,
          bestFrequency: null,
          evLoss: null,
          severity: "deviation",
          detail: `${heroCards} is not in the continuing range at this node.`,
        });
      } else {
        grades.push(gradeFreq(node, beat.actor, action, idx, combo.freq, combo.evs, "hero-combo", combo.cards, comboHand(combo.cards)));
      }
    } else {
      grades.push(gradeFreq(node, beat.actor, action, idx, node.summary.freq, null, "range", null, null));
    }
    const nextId: string | null = action.nextNodeId;
    node = nextId ? spot.nodes.find((n) => n.id === nextId) : undefined;
  }
  return grades;
}

function gradeFreq(
  node: DecisionNode,
  actor: Position,
  action: ActionDef,
  idx: number,
  freq: number[],
  evs: number[] | null,
  scope: "hero-combo" | "range",
  cards: string | null,
  hand: string | null,
): DecisionGrade {
  const frequency = freq[idx] ?? 0;
  let best = 0;
  for (let i = 1; i < freq.length; i++) if (freq[i] > freq[best]) best = i;
  const bestAction = node.actions[best];
  const evLoss = evs ? Math.max(0, round2(evs[best] - evs[idx])) : null;
  const severity = frequency >= 0.2 || idx === best ? "match" : frequency >= 0.08 ? "thin" : "deviation";
  const who = scope === "hero-combo" ? (cards ?? "Hand") : `${actor} range`;
  const detail =
    severity === "match"
      ? `${who} takes ${action.label} ${pct(frequency)} of the time.`
      : `${who} takes ${action.label} only ${pct(frequency)}. ${bestAction.label} is ${pct(freq[best])}.`;
  return {
    nodeId: node.id,
    actor,
    actionLabel: action.label,
    matched: action,
    scope,
    hand,
    cards,
    frequency,
    bestLabel: bestAction.label,
    bestFrequency: freq[best],
    evLoss,
    severity,
    detail,
  };
}

function unknown(beat: ParsedAction, detail: string): DecisionGrade {
  return {
    nodeId: "",
    actor: beat.actor,
    actionLabel: beat.text.trim(),
    matched: null,
    scope: "unmatched",
    hand: null,
    cards: null,
    frequency: null,
    bestLabel: null,
    bestFrequency: null,
    evLoss: null,
    severity: "unknown",
    detail,
  };
}

function findUpcoming(spot: SpotSolution, from: DecisionNode, actor: Position): DecisionNode | undefined {
  const seen = new Set<string>();
  const queue = [from];
  while (queue.length) {
    const node = queue.shift()!;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    if (node.actor === actor) return node;
    for (const action of node.actions) {
      if (!action.nextNodeId) continue;
      const next = spot.nodes.find((n) => n.id === action.nextNodeId);
      if (next) queue.push(next);
    }
  }
  return undefined;
}

function findCombo(node: DecisionNode, cards: string) {
  for (const hand of node.hands) {
    for (const combo of hand.combos) if (combo.cards === cards) return combo;
  }
  return null;
}

function comboHand(cards: string): string {
  const r1 = cards[0];
  const r2 = cards[2];
  const suited = cards[1] === cards[3];
  if (r1 === r2) return r1 + r2;
  return r1 + r2 + (suited ? "s" : "o");
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const SAMPLE_HISTORIES: { title: string; text: string }[] = [
  {
    title: "Check back a nut draw",
    text: `Hero: BTN AhKh
Board: Qs Jh 2h
BB checks
BTN checks`,
  },
  {
    title: "Small c-bet, K72r",
    text: `Hero: BTN KhQh
Board: Kd 7c 2s
BB checks
BTN bets 33%
BB calls`,
  },
  {
    title: "River bluffcatch",
    text: `Hero: BB AcJd
Board: As Kd 9c 4h 2s
BTN bets 66%
BB calls`,
  },
];

