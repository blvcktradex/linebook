/**
 * Builds the bundled study library.
 * Equity is calculated. Frequencies come from the study model in src/lib/poker/study.ts,
 * not from CFR. Run: node --experimental-strip-types solver/generate.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { canonicalHands, comboKey, parseId } from "../src/lib/poker/cards.ts";
import { classify } from "../src/lib/poker/classify.ts";
import { categoryOf, evalCards } from "../src/lib/poker/eval.ts";
import { equityTable } from "../src/lib/poker/equity.ts";
import { expandRange, parseRange, type WeightedCombo } from "../src/lib/poker/range.ts";
import { mixEv, studyStrategy, type NodeKind, type Texture } from "../src/lib/poker/study.ts";
import type {
  ActionType,
  DecisionNode,
  HandCell,
  HistoryBeat,
  Position,
  Seat,
  SpotSolution,
  SpotSummary,
  Street,
} from "../src/lib/solutions/types.ts";

const HANDS = canonicalHands();
const SOURCE_NOTE =
  "Frequencies are an equity-informed study model (softmax over a realization model), not a CFR solve. Equity is computed against the opposing range at this node. Import a TexasSolver dump to replace the mix.";

function assert(cond: unknown, message: string): void {
  if (!cond) throw new Error(message);
}

function selfTest(): void {
  const wheel = evalCards(["Ac", "5c", "4d", "3h", "2s"].map(parseId));
  const king = evalCards(["Kd", "Qc", "9h", "8s", "6c"].map(parseId));
  assert(categoryOf(wheel) === 4, "wheel should be a straight");
  assert(wheel > king, "wheel beats king high");
  const quads = evalCards(["As", "Ad", "Ac", "Ah", "Kd"].map(parseId));
  const boat = evalCards(["Ks", "Kd", "Kc", "Qs", "Qd"].map(parseId));
  assert(categoryOf(quads) === 7 && quads > boat, "quads beat a full house");
  const sf = evalCards(["Ah", "Kh", "Qh", "Jh", "Th"].map(parseId));
  assert(categoryOf(sf) === 8 && sf > quads, "straight flush beats quads");
  const flush = evalCards(["Ah", "Qh", "9h", "5h", "2h"].map(parseId));
  assert(categoryOf(flush) === 5 && flush > wheel, "flush beats a straight");

  const aa = parseRange("AA,AKs,KTo+");
  assert(aa.get("AA") === 1 && aa.get("AKs") === 1, "exact hands");
  assert(aa.get("KTo") === 1 && aa.get("KJo") === 1 && aa.get("KQo") === 1, "KTo+");
  assert(!aa.has("AKo") && !aa.has("AQs"), "plus does not climb to a new high card");
  const plus = parseRange("22+,A2s+");
  assert(plus.get("22") === 1 && plus.get("AA") === 1 && plus.get("A2s") === 1 && plus.get("AKs") === 1, "pair and ace plus");
  assert(!plus.has("A2o"), "A2s+ is suited only");

  const board = ["Qs", "Jh", "2h"].map(parseId);
  const nfd = classify([parseId("Ah"), parseId("Kh")], board);
  assert(nfd.tags.includes("nfd") && nfd.primary === "combo", `AhKh ${nfd.primary} ${nfd.tags.join(",")}`);
  const backdoor = classify([parseId("As"), parseId("Ks")], board);
  assert(
    backdoor.tags.includes("bdfd") && backdoor.tags.includes("gutshot") && backdoor.primary === "gutshot",
    `AsKs ${backdoor.primary} ${backdoor.tags}`,
  );
  const two = classify([parseId("Qc"), parseId("Jd")], board);
  assert(two.primary === "two-pair", two.primary);
  console.log("self-test ok");
}

interface ActionDraft {
  id: string;
  type: ActionType;
  label: string;
  sizePotPct?: number;
  sizeBb?: number;
  next: string | null;
}

interface NodeDraft {
  id: string;
  actor: "oop" | "ip";
  kind: NodeKind;
  potBb: number;
  toCallBb: number;
  street: Street;
  note: string;
  actions: ActionDraft[];
}

interface SpotDraft {
  id: string;
  title: string;
  subtitle: string;
  lesson: string;
  texture: Texture;
  textureTags: string[];
  stackBb: number;
  hero: Position;
  villain: Position;
  oop: Position;
  ip: Position;
  preflopLine: string;
  potBb: number;
  effectiveStackBb: number;
  board: string[];
  treeLabel: string;
  heroRange: string;
  villainRange: string;
  oopRange: string;
  ipRange: string;
  nodes: NodeDraft[];
}

const BTN_OPEN =
  "22+,A2s+,K9s+,KTo+,Q9s+,QTo+,J9s+,JTo,T8s+,97s+,86s+,76s,65s,54s,ATo+,KJo+";
const BB_CALL =
  "22-TT,JJ:0.45,QQ:0.35,KK:0.25,AA:0.2,A2s-A9s,ATs:0.5,AJs:0.4,AQs:0.28,AKs:0.22,ATo-AJo,AQo:0.35,AKo:0.22,K9s+,KTo+,Q9s+,QTo:0.65,J9s+,JTo:0.55,T8s+,97s+,87s,76s,65s,54s,KJo:0.45,KQo:0.3";
const IP_3B = "99+,ATs+,AJo+,KQs,KJs,KTs,QJs,JTs,T9s,A5s-A4s,A9s:0.35";
const OOP_3B = "77-TT,JJ:0.7,QQ:0.4,KK:0.22,AA:0.18,ATs-AQs,AKs:0.25,AQo,AJo:0.35,KQs,KJs,QJs,JTs,T9s,KQo:0.4";
const BTN_RIVER =
  "AA,KK,QQ,JJ,TT,99,AK,AQ,AJ,AT,A9s,A4s,A2s,KQ,KJ,KT,K9s,QJs,QTs,JTs,44,22,T9s,98s,87s,76s,65s";
const BB_RIVER =
  "AQ,AJ,AT,A9,A8s,A5s,A4s,A3s,A2s,KQ,KJ,KTs,K9s,QJ,JJ,TT,99,88,77,44,22,QTs:0.45,JTs:0.4,T9s:0.35";

function money(pot: number, pct: number): number {
  return Math.round((pot * pct) / 10) / 10;
}

function srpNodes(prefix: string, pot: number, textureNote: { open: string; ip: string; small: string; big: string }): NodeDraft[] {
  const b33 = money(pot, 33);
  const b75 = money(pot, 75);
  return [
    {
      id: `${prefix}-oop`,
      actor: "oop",
      kind: "oop-srp",
      potBb: pot,
      toCallBb: 0,
      street: "flop",
      note: textureNote.open,
      actions: [
        { id: "check", type: "check", label: "Check", next: `${prefix}-ip` },
        { id: "bet33", type: "bet", label: "Bet 33%", sizePotPct: 33, sizeBb: b33, next: null },
      ],
    },
    {
      id: `${prefix}-ip`,
      actor: "ip",
      kind: "ip-vs-check",
      potBb: pot,
      toCallBb: 0,
      street: "flop",
      note: textureNote.ip,
      actions: [
        { id: "check", type: "check", label: "Check", next: null },
        { id: "bet33", type: "bet", label: "Bet 33%", sizePotPct: 33, sizeBb: b33, next: `${prefix}-vs33` },
        { id: "bet75", type: "bet", label: "Bet 75%", sizePotPct: 75, sizeBb: b75, next: `${prefix}-vs75` },
      ],
    },
    {
      id: `${prefix}-vs33`,
      actor: "oop",
      kind: "vs-small",
      potBb: round1(pot + b33),
      toCallBb: b33,
      street: "flop",
      note: textureNote.small,
      actions: [
        { id: "fold", type: "fold", label: "Fold", next: null },
        { id: "call", type: "call", label: "Call", next: null },
        { id: "raise", type: "raise", label: "Raise", sizeBb: round1(b33 * 3.5), next: null },
      ],
    },
    {
      id: `${prefix}-vs75`,
      actor: "oop",
      kind: "vs-large",
      potBb: round1(pot + b75),
      toCallBb: b75,
      street: "flop",
      note: textureNote.big,
      actions: [
        { id: "fold", type: "fold", label: "Fold", next: null },
        { id: "call", type: "call", label: "Call", next: null },
      ],
    },
  ];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

const spots: SpotDraft[] = [
  {
    id: "btn-bb-qjh",
    title: "BTN vs BB",
    subtitle: "Single raised · QJ2 two-tone",
    lesson:
      "Broadway with a flush draw. Small bets still get through, but the large size belongs to strong made hands and nutted draws. Weak top pair checks back more than it does on a dry king.",
    texture: "dynamic",
    textureTags: ["Dynamic", "Two-tone", "SRP"],
    stackBb: 100,
    hero: "BTN",
    villain: "BB",
    oop: "BB",
    ip: "BTN",
    preflopLine: "BTN raises 2.5bb, BB calls",
    potBb: 5.5,
    effectiveStackBb: 97.5,
    board: ["Qs", "Jh", "2h"],
    treeLabel: "Check / 33% / 75%",
    heroRange: BTN_OPEN,
    villainRange: BB_CALL,
    oopRange: BB_CALL,
    ipRange: BTN_OPEN,
    nodes: srpNodes("q", 5.5, {
      open: "BB almost never leads this texture. A lead is a small mix with very strong hands and nut flush draws.",
      ip: "BTN chooses between a check, a small stab, and a large bet. Draws and two pair like the larger size more than weak showdown does.",
      small: "The 33% bet offers a good price. Continues are wide; raises are value and high-equity draws.",
      big: "The 75% size is tighter. Air and weak pairs fold more. Strong draws and good pairs continue.",
    }),
  },
  {
    id: "btn-bb-k72",
    title: "BTN vs BB",
    subtitle: "Single raised · K72 rainbow",
    lesson:
      "Dry king-high rainbow. The in-position range uses a small bet at a high frequency. The big size is for value and a few ace-high bluffs, not the default.",
    texture: "dry",
    textureTags: ["Dry", "Rainbow", "SRP"],
    stackBb: 100,
    hero: "BTN",
    villain: "BB",
    oop: "BB",
    ip: "BTN",
    preflopLine: "BTN raises 2.5bb, BB calls",
    potBb: 5.5,
    effectiveStackBb: 97.5,
    board: ["Kd", "7c", "2s"],
    treeLabel: "Check / 33% / 75%",
    heroRange: BTN_OPEN,
    villainRange: BB_CALL,
    oopRange: BB_CALL,
    ipRange: BTN_OPEN,
    nodes: srpNodes("k", 5.5, {
      open: "Donking a dry king-high board is rare. Check is the default with almost the entire range.",
      ip: "Small c-bet is the range bet. Check back medium pairs that do not need protection and cannot get three streets.",
      small: "Pot odds are generous. Fold the empty air; call a wide pair and draw range; raise sets and some ace-high bluffs.",
      big: "A large bet means a stronger range. Bluff-catch with top pair and good second pair. Fold the bottom of the range.",
    }),
  },
  {
    id: "btn-bb-994",
    title: "BTN vs BB",
    subtitle: "Single raised · paired 994",
    lesson:
      "Paired middle board. A small c-bet is still the workhorse. Large bets are reserved for trips and full houses; most one-pair hands do not need a big size.",
    texture: "paired",
    textureTags: ["Paired", "Dry", "SRP"],
    stackBb: 100,
    hero: "BTN",
    villain: "BB",
    oop: "BB",
    ip: "BTN",
    preflopLine: "BTN raises 2.5bb, BB calls",
    potBb: 5.5,
    effectiveStackBb: 97.5,
    board: ["9s", "9d", "4c"],
    treeLabel: "Check / 33% / 75%",
    heroRange: BTN_OPEN,
    villainRange: BB_CALL,
    oopRange: BB_CALL,
    ipRange: BTN_OPEN,
    nodes: srpNodes("p", 5.5, {
      open: "BB checks paired boards as well. Leading into the preflop raiser gives up the range check.",
      ip: "Bet small with the range advantage. Size up only with trips and boats.",
      small: "Defending is wide because the bet is small and many hands have a pair or an overcard.",
      big: "Continue with trips, strong overpairs, and ace-high that blocks the betting range. Fold the rest.",
    }),
  },
  {
    id: "co-btn-876",
    title: "CO vs BTN",
    subtitle: "3-bet pot · 876 two-tone",
    lesson:
      "Connected, flush-possible, and in a 3-bet pot. Nobody has a clean range bet. Check the vulnerable middle, and bet large with nutted value and combo draws.",
    texture: "wet",
    textureTags: ["Wet", "Connected", "3-bet"],
    stackBb: 100,
    hero: "BTN",
    villain: "CO",
    oop: "CO",
    ip: "BTN",
    preflopLine: "CO raises 2.5bb, BTN 3-bets to 10bb, CO calls",
    potBb: 21.5,
    effectiveStackBb: 90,
    board: ["8h", "7h", "6c"],
    treeLabel: "Check / 33% / 75%",
    heroRange: IP_3B,
    villainRange: OOP_3B,
    oopRange: OOP_3B,
    ipRange: IP_3B,
    nodes: [
      {
        id: "w-oop",
        actor: "oop",
        kind: "oop-3bp",
        potBb: 21.5,
        toCallBb: 0,
        street: "flop",
        note: "Out of position in a 3-bet pot, CO can range-check or lead small with value and equity. Medium showdown prefers a check.",
        actions: [
          { id: "check", type: "check", label: "Check", next: "w-ip" },
          { id: "bet33", type: "bet", label: "Bet 33%", sizePotPct: 33, sizeBb: money(21.5, 33), next: null },
        ],
      },
      {
        id: "w-ip",
        actor: "ip",
        kind: "ip-vs-check",
        potBb: 21.5,
        toCallBb: 0,
        street: "flop",
        note: "BTN, after a check, splits between checking back showdown and betting large with nutted hands and combo draws.",
        actions: [
          { id: "check", type: "check", label: "Check", next: null },
          { id: "bet33", type: "bet", label: "Bet 33%", sizePotPct: 33, sizeBb: money(21.5, 33), next: "w-vs33" },
          { id: "bet75", type: "bet", label: "Bet 75%", sizePotPct: 75, sizeBb: money(21.5, 75), next: null },
        ],
      },
      {
        id: "w-vs33",
        actor: "oop",
        kind: "vs-small",
        potBb: round1(21.5 + money(21.5, 33)),
        toCallBb: money(21.5, 33),
        street: "flop",
        note: "Facing the small bet, continue with pairs, flush draws, and straight draws. Raise the very strongest made hands and combo draws.",
        actions: [
          { id: "fold", type: "fold", label: "Fold", next: null },
          { id: "call", type: "call", label: "Call", next: null },
          { id: "raise", type: "raise", label: "Raise", sizeBb: round1(money(21.5, 33) * 3.2), next: null },
        ],
      },
    ],
  },
  {
    id: "btn-bb-river-ak",
    title: "BTN vs BB",
    subtitle: "River · A K 9 4 2",
    lesson:
      "The turn bet got called and the river bricks. Value is top pair with a good kicker and better. Bluffs want a queen or jack that blocks the calling range; empty low cards mostly give up.",
    texture: "river",
    textureTags: ["River", "Rainbow", "SRP"],
    stackBb: 100,
    hero: "BTN",
    villain: "BB",
    oop: "BB",
    ip: "BTN",
    preflopLine: "Flop 33% called, turn 75% called. River is a blank.",
    potBb: 22.7,
    effectiveStackBb: 88.9,
    board: ["As", "Kd", "9c", "4h", "2s"],
    treeLabel: "Check / 66% / 150%",
    heroRange: BTN_RIVER,
    villainRange: BB_RIVER,
    oopRange: BB_RIVER,
    ipRange: BTN_RIVER,
    nodes: [
      {
        id: "r-ip",
        actor: "ip",
        kind: "river-ip",
        potBb: 22.7,
        toCallBb: 0,
        street: "river",
        note: "BTN's river decision. Overbet the nuts and a few blocker bluffs. Bet two-thirds with good value. Check back the showdown that only gets called by better.",
        actions: [
          { id: "check", type: "check", label: "Check", next: null },
          { id: "bet66", type: "bet", label: "Bet 66%", sizePotPct: 66, sizeBb: money(22.7, 66), next: "r-call" },
          { id: "bet150", type: "bet", label: "Overbet 150%", sizePotPct: 150, sizeBb: money(22.7, 150), next: null },
        ],
      },
      {
        id: "r-call",
        actor: "oop",
        kind: "river-call",
        potBb: round1(22.7 + money(22.7, 66)),
        toCallBb: money(22.7, 66),
        street: "river",
        note: "BB is bluff-catching. Call hands that beat the bluffs and block value. Fold the bottom pair and most missed draws.",
        actions: [
          { id: "fold", type: "fold", label: "Fold", next: null },
          { id: "call", type: "call", label: "Call", next: null },
        ],
      },
    ],
  },
];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildSpot(draft: SpotDraft): SpotSolution {
  const boardIds = draft.board.map(parseId);
  const byId = new Map(draft.nodes.map((node) => [node.id, node]));
  const built = new Map<string, DecisionNode>();
  const oop0 = expandRange(draft.oopRange, boardIds);
  const ip0 = expandRange(draft.ipRange, boardIds);

  function walk(id: string, oop: WeightedCombo[], ip: WeightedCombo[], history: HistoryBeat[]): void {
    if (built.has(id)) return;
    const node = byId.get(id);
    if (!node) throw new Error(`Missing node ${id}`);
    const actorIsOop = node.actor === "oop";
    const actorRange = actorIsOop ? oop : ip;
    const oppRange = actorIsOop ? ip : oop;
    const actorPos = actorIsOop ? draft.oop : draft.ip;
    const t0 = Date.now();
    const equity = equityTable(actorRange, oppRange, boardIds, {
      villains: node.street === "river" ? oppRange.length : 16,
      runouts: node.street === "river" ? 1 : 12,
      seed: hash(draft.id + id),
    });
    console.log(
      `  ${draft.id}/${id} equity ${((Date.now() - t0) / 1000).toFixed(1)}s · ${actorRange.length} vs ${oppRange.length}`,
    );

    const actions = node.actions.map((action) => ({
      id: action.id,
      type: action.type,
      label: action.label,
      sizeBb: action.sizeBb,
      sizePotPct: action.sizePotPct,
      nextNodeId: action.next,
    }));

    const lines: {
      key: string;
      hand: string;
      weight: number;
      equity: number;
      freq: number[];
      evs: number[];
      ev: number;
      tags: string[];
      primary: string;
    }[] = [];

    for (const combo of actorRange) {
      const info = classify([combo.a, combo.b], boardIds);
      const eq = equity.get(combo.key) ?? 0.5;
      const strat = studyStrategy({
        kind: node.kind,
        texture: draft.texture,
        primary: info.primary,
        tags: info.tags,
        equity: eq,
        pot: node.potBb,
        toCall: node.toCallBb,
        actions: node.actions.map((action) => ({
          id: action.id,
          type: action.type,
          sizePotPct: action.sizePotPct,
        })),
      });
      lines.push({
        key: combo.key,
        hand: combo.hand,
        weight: round3(combo.weight),
        equity: round3(eq),
        freq: strat.freq,
        evs: strat.evs,
        ev: mixEv(strat.freq, strat.evs),
        tags: info.tags,
        primary: info.primary,
      });
    }

    const grouped = new Map<string, typeof lines>();
    for (const line of lines) {
      const list = grouped.get(line.hand) ?? [];
      list.push(line);
      grouped.set(line.hand, list);
    }

    const hands: HandCell[] = HANDS.map((hand) => {
      const group = grouped.get(hand) ?? [];
      if (group.length === 0) {
        return {
          hand,
          weight: 0,
          equity: 0,
          ev: 0,
          freq: actions.map(() => 0),
          evs: actions.map(() => 0),
          primary: "",
          combos: [],
        };
      }
      let weightSum = 0;
      let equitySum = 0;
      let evSum = 0;
      const freq = actions.map(() => 0);
      const evs = actions.map(() => 0);
      let primary = group[0].primary;
      let primaryW = -1;
      for (const line of group) {
        weightSum += line.weight;
        equitySum += line.equity * line.weight;
        evSum += line.ev * line.weight;
        line.freq.forEach((value, index) => {
          freq[index] += value * line.weight;
        });
        line.evs.forEach((value, index) => {
          evs[index] += value * line.weight;
        });
        if (line.weight > primaryW) {
          primaryW = line.weight;
          primary = line.primary;
        }
      }
      const denom = weightSum || 1;
      return {
        hand,
        weight: round3(weightSum / group.length),
        equity: round3(equitySum / denom),
        ev: round1(evSum / denom),
        freq: normalize(freq.map((value) => value / denom)),
        evs: evs.map((value) => round1(value / denom)),
        primary,
        combos: group.map((line) => ({
          cards: line.key,
          weight: line.weight,
          equity: line.equity,
          ev: line.ev,
          freq: line.freq,
          evs: line.evs,
          tags: line.tags,
          primary: line.primary,
        })),
      };
    });

    let totalW = 0;
    let totalEv = 0;
    const totalFreq = actions.map(() => 0);
    for (const line of lines) {
      totalW += line.weight;
      totalEv += line.ev * line.weight;
      line.freq.forEach((value, index) => {
        totalFreq[index] += value * line.weight;
      });
    }
    const summaryFreq = totalW ? normalize(totalFreq.map((value) => value / totalW)) : actions.map(() => 0);

    const seat: Seat = actorIsOop ? "OOP" : "IP";
    const decision: DecisionNode = {
      id,
      parentId: null,
      viaActionId: null,
      street: node.street,
      board: draft.board,
      potBb: node.potBb,
      toCallBb: node.toCallBb,
      actor: actorPos,
      actorSeat: seat,
      history,
      actions,
      hands,
      summary: {
        freq: summaryFreq,
        ev: totalW ? round1(totalEv / totalW) : 0,
        combos: lines.length,
      },
      note: node.note,
    };
    built.set(id, decision);
    console.log(
      `  ${id} ${actorPos} ${summaryFreq.map((value, index) => `${actions[index].label} ${Math.round(value * 100)}%`).join(" · ")}`,
    );

    const freqByKey = new Map(lines.map((line) => [line.key, line.freq]));
    node.actions.forEach((action, index) => {
      if (!action.next) return;
      const narrowed = actorRange
        .map((combo) => {
          const freq = freqByKey.get(combo.key)?.[index] ?? 0;
          return { ...combo, weight: combo.weight * freq };
        })
        .filter((combo) => combo.weight >= 0.03);
      const nextOop = actorIsOop ? narrowed : oop;
      const nextIp = actorIsOop ? ip : narrowed;
      const nextHistory = history.concat([{ actor: actorPos, action: action.label }]);
      const child = byId.get(action.next);
      if (child) {
        walk(action.next, nextOop, nextIp, nextHistory);
        const childNode = built.get(action.next);
        if (childNode && !childNode.parentId) {
          childNode.parentId = id;
          childNode.viaActionId = action.id;
        }
      }
    });
  }

  walk(draft.nodes[0].id, oop0, ip0, []);

  return {
    id: draft.id,
    title: draft.title,
    subtitle: draft.subtitle,
    lesson: draft.lesson,
    source: "study-model",
    sourceNote: SOURCE_NOTE,
    game: "NLHE",
    format: "cash-6max",
    stackBb: draft.stackBb,
    hero: draft.hero,
    villain: draft.villain,
    oop: draft.oop,
    ip: draft.ip,
    preflopLine: draft.preflopLine,
    potBb: draft.potBb,
    effectiveStackBb: draft.effectiveStackBb,
    board: draft.board,
    texture: draft.textureTags,
    treeLabel: draft.treeLabel,
    heroRange: draft.heroRange,
    villainRange: draft.villainRange,
    rootNodeId: draft.nodes[0].id,
    nodes: draft.nodes.map((node) => {
      const builtNode = built.get(node.id);
      if (!builtNode) throw new Error(`Node ${node.id} was not built`);
      return builtNode;
    }),
  };
}

function normalize(freq: number[]): number[] {
  const rounded = freq.map((value) => round3(Math.max(0, value)));
  const sum = rounded.reduce((a, b) => a + b, 0);
  if (sum <= 0) return rounded;
  const scaled = rounded.map((value) => round3(value / sum));
  const drift = round3(1 - scaled.reduce((a, b) => a + b, 0));
  let best = 0;
  for (let i = 1; i < scaled.length; i++) if (scaled[i] > scaled[best]) best = i;
  scaled[best] = round3(scaled[best] + drift);
  return scaled;
}

function summaryOf(spot: SpotSolution): SpotSummary {
  return {
    id: spot.id,
    title: spot.title,
    subtitle: spot.subtitle,
    lesson: spot.lesson,
    source: spot.source,
    stackBb: spot.stackBb,
    hero: spot.hero,
    villain: spot.villain,
    potBb: spot.potBb,
    effectiveStackBb: spot.effectiveStackBb,
    board: spot.board,
    texture: spot.texture,
    treeLabel: spot.treeLabel,
    street: spot.nodes[0]?.street ?? "flop",
    preflopLine: spot.preflopLine,
    nodeCount: spot.nodes.length,
  };
}

selfTest();
mkdirSync("src/data/spots", { recursive: true });
const summaries: SpotSummary[] = [];
const started = Date.now();
for (const draft of spots) {
  console.log(`\n${draft.id}`);
  const spot = buildSpot(draft);
  const file = `src/data/spots/${spot.id}.ts`;
  writeFileSync(
    file,
    `import type { SpotSolution } from "@/lib/solutions/types";\n\nconst spot: SpotSolution = ${JSON.stringify(spot)};\nexport default spot;\n`,
  );
  summaries.push(summaryOf(spot));
  console.log(`wrote ${file}`);
}
writeFileSync(
  "src/data/manifest.ts",
  `import type { SpotSummary } from "@/lib/solutions/types";\n\nexport const manifest: SpotSummary[] = ${JSON.stringify(summaries, null, 2)};\n`,
);
console.log(`\ndone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
