/** Card helpers. Rank 0 is deuce, rank 12 is ace. Suit 0–3 is c,d,h,s. */

export const RANKS = "23456789TJQKA";
export const SUITS = "cdhs";
export const SUIT_SYMBOL: Record<string, string> = {
  c: "♣",
  d: "♦",
  h: "♥",
  s: "♠",
};

export interface Card {
  r: number;
  s: number;
}

export function parseCard(text: string): Card {
  const t = text.trim();
  const r = RANKS.indexOf(t[0]?.toUpperCase() ?? "");
  const s = SUITS.indexOf(t[1]?.toLowerCase() ?? "");
  if (r < 0 || s < 0 || t.length < 2) throw new Error(`Bad card: ${text}`);
  return { r, s };
}

export function cardId(card: Card): number {
  return (card.r << 2) | card.s;
}

export function idRank(id: number): number {
  return id >> 2;
}

export function idSuit(id: number): number {
  return id & 3;
}

export function formatId(id: number): string {
  return RANKS[idRank(id)] + SUITS[idSuit(id)];
}

export function parseId(text: string): number {
  return cardId(parseCard(text));
}

/** Higher rank first. Pairs ordered by suit so the key is stable. */
export function comboKey(a: number, b: number): string {
  let x = a;
  let y = b;
  if (idRank(x) < idRank(y) || (idRank(x) === idRank(y) && idSuit(x) < idSuit(y))) {
    const t = x;
    x = y;
    y = t;
  }
  return formatId(x) + formatId(y);
}

export function parseCombo(text: string): [number, number] {
  const clean = text.replace(/[^2-9TJQKAcdhs]/gi, "");
  if (clean.length !== 4) throw new Error(`Bad combo: ${text}`);
  const a = parseId(clean.slice(0, 2));
  const b = parseId(clean.slice(2, 4));
  if (a === b) throw new Error(`Bad combo: ${text}`);
  const key = comboKey(a, b);
  return [parseId(key.slice(0, 2)), parseId(key.slice(2, 4))];
}

export function handClass(a: number, b: number): string {
  const ra = idRank(a);
  const rb = idRank(b);
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  if (hi === lo) return RANKS[hi] + RANKS[lo];
  const suited = idSuit(a) === idSuit(b);
  return RANKS[hi] + RANKS[lo] + (suited ? "s" : "o");
}

/** 13×13 matrix order: row-major, Ace at index 0, suited above the diagonal. */
export function canonicalHands(): string[] {
  const out: string[] = [];
  for (let row = 12; row >= 0; row--) {
    for (let col = 12; col >= 0; col--) {
      if (row === col) out.push(RANKS[row] + RANKS[col]);
      else if (row > col) out.push(RANKS[row] + RANKS[col] + "s");
      else out.push(RANKS[col] + RANKS[row] + "o");
    }
  }
  return out;
}

export function allComboIds(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 52; i++) {
    for (let j = i + 1; j < 52; j++) out.push([j, i]);
  }
  return out;
}

export function boardMask(ids: number[]): Set<number> {
  return new Set(ids);
}

export function overlaps(a: number, b: number, dead: Set<number>): boolean {
  return dead.has(a) || dead.has(b);
}

export function overlapsPair(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 === b1 || a1 === b2 || a2 === b1 || a2 === b2;
}

const SUIT_PERMS = permute(SUITS.split(""));

function permute(items: string[]): string[][] {
  if (items.length <= 1) return [items];
  const out: string[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const tail of permute(rest)) out.push([items[i], ...tail]);
  }
  return out;
}

/** Map suits on `from` cards so the multiset matches `to`. Null when ranks differ. */
export function findSuitMap(from: string[], to: string[]): Record<string, string> | null {
  const target = to.map((c) => c[0].toUpperCase() + c[1].toLowerCase()).sort().join("");
  for (const perm of SUIT_PERMS) {
    const map: Record<string, string> = { c: perm[0], d: perm[1], h: perm[2], s: perm[3] };
    const mapped = from
      .map((c) => c[0].toUpperCase() + map[c[1].toLowerCase()])
      .sort()
      .join("");
    if (mapped === target) return map;
  }
  return null;
}

export function applySuitMap(card: string, map: Record<string, string>): string {
  return card[0].toUpperCase() + map[card[1].toLowerCase()];
}

export function prettyCombo(cards: string): string {
  const a = cards.slice(0, 2);
  const b = cards.slice(2, 4);
  return `${a[0]}${SUIT_SYMBOL[a[1]]}${b[0]}${SUIT_SYMBOL[b[1]]}`;
}

export function pipClass(suit: string): string {
  if (suit === "h") return "text-pip-heart";
  if (suit === "d") return "text-pip-diamond";
  if (suit === "c") return "text-pip-club";
  return "text-pip-spade";
}
