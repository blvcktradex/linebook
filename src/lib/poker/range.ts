import { RANKS, handClass, allComboIds, comboKey, overlaps, boardMask } from "./cards.ts";

/**
 * Linebook range syntax (fixed high card, not the connector ladder):
 *   AA, AKs, AKo, AK (both), 22+, A2s+, KTo+, QQ-77, AJs-A2s, AQs:0.4
 * `+` keeps the top rank and improves the kicker, except pairs where the pair rank rises.
 */
export function parseRange(spec: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!spec.trim()) return map;
  for (const raw of spec.split(/[,\n]/)) {
    const token = raw.trim();
    if (!token || token.startsWith("#")) continue;
    const colon = token.lastIndexOf(":");
    const body = colon >= 0 ? token.slice(0, colon) : token;
    const weight = colon >= 0 ? Number(token.slice(colon + 1)) : 1;
    if (!Number.isFinite(weight)) throw new Error(`Bad weight in ${token}`);
    for (const hand of expandToken(body.trim())) {
      map.set(hand, weight);
    }
  }
  return map;
}

function expandToken(body: string): string[] {
  if (body.includes("-")) {
    const [a, b] = body.split("-");
    return expandDash(a, b);
  }
  const plus = body.endsWith("+");
  const core = plus ? body.slice(0, -1) : body;
  if (/^[2-9TJQKA]{2}$/.test(core) && core[0] === core[1]) {
    const start = RANKS.indexOf(core[0]);
    const out: string[] = [];
    const end = plus ? 12 : start;
    for (let r = start; r <= end; r++) out.push(RANKS[r] + RANKS[r]);
    return out;
  }
  const both = /^([2-9TJQKA])([2-9TJQKA])$/.exec(core);
  if (both) {
    return expandSuitedness(both[1], both[2], "both", plus);
  }
  const spec = /^([2-9TJQKA])([2-9TJQKA])([so])$/.exec(core);
  if (!spec) throw new Error(`Bad range token: ${body}`);
  return expandSuitedness(spec[1], spec[2], spec[3] as "s" | "o", plus);
}

function expandSuitedness(hiChar: string, loChar: string, kind: "s" | "o" | "both", plus: boolean): string[] {
  let hi = RANKS.indexOf(hiChar);
  let lo = RANKS.indexOf(loChar);
  if (hi < lo) {
    const t = hi;
    hi = lo;
    lo = t;
  }
  if (hi === lo) throw new Error(`Use pair syntax for ${hiChar}${loChar}`);
  const kinds: ("s" | "o")[] = kind === "both" ? ["s", "o"] : [kind];
  const out: string[] = [];
  const loEnd = plus ? hi - 1 : lo;
  for (const k of kinds) {
    for (let kick = lo; kick <= loEnd; kick++) out.push(RANKS[hi] + RANKS[kick] + k);
  }
  return out;
}

function expandDash(a: string, b: string): string[] {
  const left = parseEnd(a);
  const right = parseEnd(b);
  if (left.kind !== right.kind) throw new Error(`Mismatched dash range ${a}-${b}`);
  if (left.kind === "pair") {
    const hi = Math.max(left.hi, right.hi);
    const lo = Math.min(left.hi, right.hi);
    const out: string[] = [];
    for (let r = lo; r <= hi; r++) out.push(RANKS[r] + RANKS[r]);
    return out;
  }
  if (left.hi !== right.hi) throw new Error(`Dash range must share a high card: ${a}-${b}`);
  const kickHi = Math.max(left.lo, right.lo);
  const kickLo = Math.min(left.lo, right.lo);
  const out: string[] = [];
  const kinds: ("s" | "o")[] = left.kind === "both" ? ["s", "o"] : [left.kind];
  for (const k of kinds) {
    for (let kick = kickLo; kick <= kickHi; kick++) out.push(RANKS[left.hi] + RANKS[kick] + k);
  }
  return out;
}

function parseEnd(token: string): { hi: number; lo: number; kind: "pair" | "s" | "o" | "both" } {
  if (/^[2-9TJQKA]{2}$/.test(token) && token[0] === token[1]) {
    return { hi: RANKS.indexOf(token[0]), lo: RANKS.indexOf(token[0]), kind: "pair" };
  }
  const spec = /^([2-9TJQKA])([2-9TJQKA])([so])$/.exec(token);
  if (!spec) throw new Error(`Bad range end: ${token}`);
  let hi = RANKS.indexOf(spec[1]);
  let lo = RANKS.indexOf(spec[2]);
  if (hi < lo) {
    const t = hi;
    hi = lo;
    lo = t;
  }
  return { hi, lo, kind: spec[3] as "s" | "o" };
}

export interface WeightedCombo {
  a: number;
  b: number;
  key: string;
  hand: string;
  weight: number;
}

export function expandRange(spec: string, board: number[]): WeightedCombo[] {
  const weights = parseRange(spec);
  const dead = boardMask(board);
  const out: WeightedCombo[] = [];
  for (const [a, b] of allComboIds()) {
    if (overlaps(a, b, dead)) continue;
    const hand = handClass(a, b);
    const weight = weights.get(hand) ?? 0;
    if (weight <= 0) continue;
    out.push({ a, b, key: comboKey(a, b), hand, weight });
  }
  return out;
}
