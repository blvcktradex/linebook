import { RANKS, idRank, idSuit } from "./cards.ts";
import { categoryOf, evalCards } from "./eval.ts";

export interface Classified {
  tags: string[];
  primary: string;
}

const PRIMARY_ORDER = [
  "straight-flush",
  "quads",
  "full-house",
  "flush",
  "straight",
  "set",
  "trips",
  "two-pair",
  "overpair",
  "combo",
  "nfd",
  "top-pair-good",
  "fd",
  "oesd",
  "top-pair-weak",
  "middle-pair",
  "bottom-pair",
  "underpair",
  "gutshot",
  "overcards",
  "one-over",
  "bdfd",
  "air",
];

/**
 * Structural class of one combo on a board.
 * Draws are tagged only when the made hand is not already a flush or straight.
 */
export function classify(hero: [number, number], board: number[]): Classified {
  const tags: string[] = [];
  const hr = [idRank(hero[0]), idRank(hero[1])];
  const hs = [idSuit(hero[0]), idSuit(hero[1])];
  const br = board.map(idRank);
  const bs = board.map(idSuit);
  const maxBoard = Math.max(...br);
  const uniqueBoard = [...new Set(br)].sort((a, b) => b - a);
  const second = uniqueBoard[1] ?? -1;
  const third = uniqueBoard[2] ?? -1;
  const pocket = hr[0] === hr[1];

  const cat = categoryOf(evalCards([...hero, ...board]));
  if (cat === 8) tags.push("straight-flush");
  else if (cat === 7) tags.push("quads");
  else if (cat === 6) tags.push("full-house");
  else if (cat === 5) tags.push("flush");
  else if (cat === 4) tags.push("straight");
  else if (cat === 3) tags.push(pocket && br.includes(hr[0]) ? "set" : "trips");
  else if (cat === 2) tags.push("two-pair");
  else if (cat === 1) {
    if (pocket && hr[0] > maxBoard) tags.push("overpair");
    else if (pocket) tags.push("underpair");
    else {
      const paired = br.includes(hr[0]) ? hr[0] : hr[1];
      const kicker = paired === hr[0] ? hr[1] : hr[0];
      if (paired === maxBoard) {
        const good = kicker >= 12 || (kicker >= 10 && kicker > second);
        tags.push(good ? "top-pair-good" : "top-pair-weak");
      } else if (paired === second) tags.push("middle-pair");
      else if (paired === third) tags.push("bottom-pair");
      else tags.push("bottom-pair");
    }
  } else if (hr[0] > maxBoard && hr[1] > maxBoard) tags.push("overcards");
  else if (hr[0] > maxBoard || hr[1] > maxBoard) tags.push("one-over");
  else tags.push("air");

  if (board.length < 5 && cat < 5) {
    const suitBoard = [0, 0, 0, 0];
    for (const s of bs) suitBoard[s]++;
    for (let s = 0; s < 4; s++) {
      const held = (hs[0] === s ? 1 : 0) + (hs[1] === s ? 1 : 0);
      const total = held + suitBoard[s];
      if (held === 0) continue;
      if (total >= 4) {
        const nut = nutRank(s, board);
        const hasNut = (hs[0] === s && hr[0] === nut) || (hs[1] === s && hr[1] === nut);
        tags.push(hasNut ? "nfd" : "fd");
      } else if (board.length === 3 && held === 2 && total === 3) {
        tags.push("bdfd");
      }
    }

    const outs = straightOutCount(hr, br);
    if (outs >= 2) tags.push("oesd");
    else if (outs === 1) tags.push("gutshot");
  }

  const drawy =
    tags.includes("nfd") || tags.includes("fd") || tags.includes("oesd") || tags.includes("gutshot");
  const paired =
    tags.includes("top-pair-good") ||
    tags.includes("top-pair-weak") ||
    tags.includes("middle-pair") ||
    tags.includes("overpair") ||
    tags.includes("two-pair") ||
    tags.includes("set");
  if (drawy && (tags.includes("nfd") || tags.includes("fd")) && (tags.includes("oesd") || tags.includes("gutshot"))) {
    tags.push("combo");
  } else if (drawy && paired && (tags.includes("oesd") || tags.includes("nfd") || tags.includes("fd"))) {
    tags.push("combo");
  }

  if (!pocket) {
    for (const r of hr) {
      if (!br.includes(r) && r >= 9 && !tags.includes("blocker")) tags.push("blocker");
    }
  }

  let primary = "air";
  for (const name of PRIMARY_ORDER) {
    if (tags.includes(name)) {
      primary = name;
      break;
    }
  }
  return { tags: [...new Set(tags)], primary };
}

function nutRank(suit: number, board: number[]): number {
  const used = new Set(board.filter((id) => idSuit(id) === suit).map(idRank));
  for (let r = 12; r >= 0; r--) if (!used.has(r)) return r;
  return 12;
}

function straightOutCount(heroRanks: number[], boardRanks: number[]): number {
  let outs = 0;
  const present = new Set([...heroRanks, ...boardRanks]);
  for (let r = 0; r <= 12; r++) {
    if (present.has(r)) continue;
    if (completesStraight(heroRanks, boardRanks, r)) outs++;
  }
  return outs;
}

function completesStraight(heroRanks: number[], boardRanks: number[], extra: number): boolean {
  const ranks = [...boardRanks, ...heroRanks, extra];
  const windows = straightWindows(ranks);
  return windows.some((w) => w.includes(extra) && w.some((rank) => heroRanks.includes(rank)));
}

function straightWindows(ranks: number[]): number[][] {
  const set = new Set(ranks);
  const found: number[][] = [];
  for (let high = 12; high >= 4; high--) {
    const w = [high, high - 1, high - 2, high - 3, high - 4];
    if (w.every((r) => set.has(r))) found.push(w);
  }
  const wheel = [12, 0, 1, 2, 3];
  if (wheel.every((r) => set.has(r))) found.push(wheel);
  return found;
}

export function primaryLabel(primary: string): string {
  return primary.replace(/-/g, " ");
}

export function rankName(index: number): string {
  return RANKS[index] ?? "?";
}
