import { overlapsPair } from "./cards.ts";
import { evalCards } from "./eval.ts";
import type { WeightedCombo } from "./range.ts";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EquityOptions {
  villains: number;
  runouts: number;
  seed: number;
}

/**
 * Equity of every hero combo against a weighted villain range.
 * River is exact. Flop and turn are seeded Monte Carlo.
 */
export function equityTable(
  heroes: WeightedCombo[],
  villains: WeightedCombo[],
  board: number[],
  options: EquityOptions,
): Map<string, number> {
  const out = new Map<string, number>();
  if (heroes.length === 0) return out;
  if (villains.length === 0) {
    for (const h of heroes) out.set(h.key, 0.5);
    return out;
  }

  const rng = mulberry32(options.seed);
  const deck = deckWithout(board);
  const need = 5 - board.length;

  if (need <= 0) {
    for (const h of heroes) {
      let win = 0;
      let tot = 0;
      const hCards = [...board, h.a, h.b];
      for (const v of villains) {
        if (overlapsPair(h.a, h.b, v.a, v.b)) continue;
        const hs = evalCards(hCards);
        const vs = evalCards([...board, v.a, v.b]);
        const w = v.weight;
        if (hs > vs) win += w;
        else if (hs === vs) win += w * 0.5;
        tot += w;
      }
      out.set(h.key, tot > 0 ? win / tot : 0.5);
    }
    return out;
  }

  const vCum: number[] = [];
  let vTotal = 0;
  for (const v of villains) {
    vTotal += v.weight;
    vCum.push(vTotal);
  }

  for (const h of heroes) {
    let win = 0;
    let tot = 0;
    const availBase = deck.filter((id) => id !== h.a && id !== h.b);
    for (let s = 0; s < options.villains; s++) {
      const v = villains[pick(vCum, vTotal, rng)];
      if (overlapsPair(h.a, h.b, v.a, v.b)) continue;
      const avail = availBase.filter((id) => id !== v.a && id !== v.b);
      for (let r = 0; r < options.runouts; r++) {
        const run = sampleRunout(avail, need, rng);
        const hs = evalCards([...board, ...run, h.a, h.b]);
        const vs = evalCards([...board, ...run, v.a, v.b]);
        if (hs > vs) win += 1;
        else if (hs === vs) win += 0.5;
        tot += 1;
      }
    }
    out.set(h.key, tot > 0 ? win / tot : 0.5);
  }
  return out;
}

function deckWithout(board: number[]): number[] {
  const dead = new Set(board);
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) if (!dead.has(i)) deck.push(i);
  return deck;
}

function pick(cum: number[], total: number, rng: () => number): number {
  const x = rng() * total;
  let lo = 0;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function sampleRunout(avail: number[], need: number, rng: () => number): number[] {
  const copy = avail.slice();
  for (let i = 0; i < need; i++) {
    const j = i + Math.floor(rng() * (copy.length - i));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, need);
}
