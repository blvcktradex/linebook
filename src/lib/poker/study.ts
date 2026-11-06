/**
 * Study-model frequencies for the bundled library.
 * This is not a CFR solver. Action EVs are a realization model; frequencies are a
 * softmax of those EVs so the recommended action and the EV ranking agree.
 * Replace both with TexasSolver output via solver/convert_texassolver.ts.
 */

export type Texture = "dry" | "dynamic" | "wet" | "paired" | "river";

export type NodeKind =
  | "oop-srp"
  | "oop-3bp"
  | "ip-vs-check"
  | "vs-small"
  | "vs-large"
  | "river-ip"
  | "river-call";

export interface StudyAction {
  id: string;
  type: "fold" | "check" | "call" | "bet" | "raise";
  sizePotPct?: number;
}

const STRONG = new Set([
  "straight-flush",
  "quads",
  "full-house",
  "flush",
  "straight",
  "set",
  "trips",
  "two-pair",
  "overpair",
]);

const SHOWDOWN = new Set(["top-pair-weak", "middle-pair", "bottom-pair", "underpair"]);
const AIR = new Set(["air", "overcards", "one-over", "bdfd"]);

export function realization(primary: string, tags: string[]): number {
  if (STRONG.has(primary)) return 0.96;
  if (primary === "top-pair-good") return 0.9;
  if (SHOWDOWN.has(primary)) return 0.8;
  if (tags.includes("combo") || tags.includes("nfd")) return 0.78;
  if (tags.includes("fd") || tags.includes("oesd")) return 0.68;
  if (tags.includes("gutshot")) return 0.56;
  if (primary === "overcards" || primary === "one-over") return 0.46;
  if (tags.includes("bdfd")) return 0.38;
  return 0.26;
}

export function studyStrategy(input: {
  kind: NodeKind;
  texture: Texture;
  primary: string;
  tags: string[];
  equity: number;
  pot: number;
  toCall: number;
  actions: StudyAction[];
}): { freq: number[]; evs: number[] } {
  const { kind, texture, primary, tags, equity, pot, toCall, actions } = input;
  const real = realization(primary, tags);
  const evCheck = equity * pot * real;
  const evCall = equity * real * (pot + toCall) - toCall;
  let evRaise = evCall;
  if (STRONG.has(primary) || primary === "combo" || tags.includes("nfd")) evRaise += pot * 0.14;
  else if (tags.includes("fd") || tags.includes("oesd") || primary === "top-pair-good") evRaise -= pot * 0.02;
  else evRaise -= pot * 0.16;

  const blocker = tags.includes("blocker");
  const evs = actions.map((action) => {
    if (action.type === "fold") return 0;
    if (action.type === "check") return evCheck;
    if (action.type === "call") return evCall;
    if (action.type === "raise") return evRaise;
    return evCheck + betEdge(action.sizePotPct ?? 33, kind, texture, primary, tags, blocker, pot);
  });

  const temperature = Math.max(0.2, pot * (kind === "river-ip" || kind === "river-call" ? 0.035 : 0.05));
  return { freq: sparsify(softmax(evs, temperature)), evs: evs.map((e) => round2(e)) };
}

function betEdge(
  sizePct: number,
  kind: NodeKind,
  texture: Texture,
  primary: string,
  tags: string[],
  blocker: boolean,
  pot: number,
): number {
  const big = sizePct >= 60;
  const strong = STRONG.has(primary);
  const drawStrong = tags.includes("nfd") || tags.includes("combo") || tags.includes("oesd");
  const showdown = SHOWDOWN.has(primary);
  const air = AIR.has(primary) || primary === "gutshot";
  const madeDraw = tags.includes("fd") || tags.includes("oesd");

  if (kind === "oop-srp") {
    if (strong && texture !== "dry") return pot * 0.035;
    if (drawStrong && (texture === "dynamic" || texture === "wet")) return pot * 0.01;
    return -pot * (texture === "dry" ? 0.16 : 0.1);
  }

  if (kind === "oop-3bp") {
    if (!big) {
      if (strong || drawStrong) return pot * 0.1;
      if (primary === "top-pair-good" || tags.includes("fd")) return pot * 0.045;
      if (air && texture === "wet") return pot * 0.015;
      if (showdown) return -pot * 0.07;
      return -pot * 0.01;
    }
    if (strong || tags.includes("combo")) return pot * 0.06;
    return -pot * 0.1;
  }

  if (kind === "river-ip") {
    if (sizePct >= 100) {
      if (strong && primary !== "overpair") return pot * 0.12;
      if (primary === "top-pair-good") return -pot * 0.05;
      if (air && blocker) return pot * 0.045;
      if (air) return -pot * 0.03;
      return -pot * 0.11;
    }
    if (strong || primary === "top-pair-good") return pot * 0.09;
    if (primary === "top-pair-weak") return pot * 0.02;
    if (air && blocker) return pot * 0.03;
    if (showdown) return -pot * 0.06;
    return -pot * 0.035;
  }

  if (kind === "ip-vs-check" && texture === "dry") {
    if (big) {
      if (strong) return pot * 0.11;
      if (primary === "top-pair-good") return pot * 0.015;
      if (air && blocker) return pot * 0.02;
      return -pot * 0.08;
    }
    if (primary === "underpair") return -pot * 0.015;
    if (strong) return pot * 0.13;
    if (showdown) return pot * 0.03;
    return pot * 0.075;
  }

  if (kind === "ip-vs-check" && texture === "dynamic") {
    if (big) {
      if (strong || drawStrong) return pot * 0.09;
      if (primary === "top-pair-good" || madeDraw) return pot * 0.02;
      return -pot * 0.055;
    }
    if (strong) return pot * 0.07;
    if (primary === "top-pair-good" || madeDraw || tags.includes("gutshot")) return pot * 0.045;
    if (primary === "top-pair-weak") return pot * 0.005;
    if (showdown) return -pot * 0.03;
    if (air) return -pot * 0.005;
    return pot * 0.02;
  }

  if (kind === "ip-vs-check" && texture === "wet") {
    if (big) {
      if ((strong && primary !== "overpair" && primary !== "top-pair-good") || drawStrong) return pot * 0.1;
      if (primary === "overpair" || primary === "top-pair-good") return -pot * 0.015;
      return -pot * 0.08;
    }
    if (strong || drawStrong || tags.includes("fd")) return pot * 0.05;
    if (showdown || primary === "top-pair-weak") return -pot * 0.035;
    if (air) return 0;
    return pot * 0.015;
  }

  if (kind === "ip-vs-check" && texture === "paired") {
    if (big) {
      if (["quads", "full-house", "trips", "set", "straight-flush"].includes(primary)) return pot * 0.12;
      return -pot * 0.09;
    }
    if (primary === "underpair") return -pot * 0.01;
    if (showdown) return pot * 0.025;
    return pot * 0.07;
  }

  return 0;
}

function softmax(evs: number[], temperature: number): number[] {
  const max = Math.max(...evs);
  const exps = evs.map((e) => Math.exp((e - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function sparsify(freq: number[]): number[] {
  const cut = freq.map((f) => (f < 0.035 ? 0 : f));
  const sum = cut.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    let best = 0;
    for (let i = 1; i < freq.length; i++) if (freq[i] > freq[best]) best = i;
    return freq.map((_, i) => (i === best ? 1 : 0));
  }
  const norm = cut.map((f) => f / sum);
  const rounded = norm.map((f) => Math.round(f * 1000) / 1000);
  const drift = Math.round((1 - rounded.reduce((a, b) => a + b, 0)) * 1000) / 1000;
  let best = 0;
  for (let i = 1; i < rounded.length; i++) if (rounded[i] > rounded[best]) best = i;
  rounded[best] = Math.round((rounded[best] + drift) * 1000) / 1000;
  return rounded;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mixEv(freq: number[], evs: number[]): number {
  let ev = 0;
  for (let i = 0; i < freq.length; i++) ev += freq[i] * evs[i];
  return Math.round(ev * 100) / 100;
}
