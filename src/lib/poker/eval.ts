/**
 * 5- and 7-card hold'em evaluator.
 * Score is comparable: higher wins. Category lives in the top base-15 digit.
 */

const counts = new Int8Array(13);

function pack(cat: number, k0 = 0, k1 = 0, k2 = 0, k3 = 0, k4 = 0): number {
  return (
    ((((cat * 15 + (k0 + 1)) * 15 + (k1 + 1)) * 15 + (k2 + 1)) * 15 + (k3 + 1)) * 15 +
    (k4 + 1)
  );
}

function straightHigh(): number {
  let bits = 0;
  let n = 0;
  for (let r = 0; r < 13; r++) {
    if (counts[r]) {
      bits |= 1 << r;
      n += counts[r];
    }
  }
  if (n !== 5 || bitCount(bits) !== 5) return -1;
  // Wheel A-2-3-4-5. High card for kickers is the five (rank 3).
  if ((bits & 0b1000000001111) === 0b1000000001111) return 3;
  for (let high = 12; high >= 4; high--) {
    const mask = 0b11111 << (high - 4);
    if ((bits & mask) === mask) return high;
  }
  return -1;
}

function bitCount(bits: number): number {
  let n = 0;
  let x = bits;
  while (x) {
    n += x & 1;
    x >>= 1;
  }
  return n;
}

/** Five card ids (rank << 2 | suit). */
export function eval5(ids: number[]): number {
  counts.fill(0);
  const s0 = ids[0] & 3;
  let flush = true;
  for (let i = 0; i < 5; i++) {
    counts[ids[i] >> 2]++;
    if ((ids[i] & 3) !== s0) flush = false;
  }

  let quad = -1;
  let trip = -1;
  let pairA = -1;
  let pairB = -1;
  const kick: number[] = [];
  for (let r = 12; r >= 0; r--) {
    const c = counts[r];
    if (c === 4) quad = r;
    else if (c === 3) trip = r;
    else if (c === 2) {
      if (pairA < 0) pairA = r;
      else pairB = r;
    } else if (c === 1) kick.push(r);
  }

  const sh = straightHigh();
  if (flush && sh >= 0) return pack(8, sh);
  if (quad >= 0) return pack(7, quad, kick[0] ?? 0);
  if (trip >= 0 && pairA >= 0) return pack(6, trip, pairA);
  if (flush) return pack(5, kick[0], kick[1], kick[2], kick[3], kick[4]);
  if (sh >= 0) return pack(4, sh);
  if (trip >= 0) return pack(3, trip, kick[0], kick[1]);
  if (pairA >= 0 && pairB >= 0) return pack(2, pairA, pairB, kick[0]);
  if (pairA >= 0) return pack(1, pairA, kick[0], kick[1], kick[2]);
  return pack(0, kick[0], kick[1], kick[2], kick[3], kick[4]);
}

const seven = [0, 0, 0, 0, 0, 0, 0];
const five = [0, 0, 0, 0, 0];

/** Best 5 of 5, 6, or 7 cards. */
export function evalCards(ids: number[]): number {
  const n = ids.length;
  if (n === 5) return eval5(ids);
  if (n !== 6 && n !== 7) throw new Error(`Bad hand length ${n}`);
  for (let i = 0; i < n; i++) seven[i] = ids[i];
  let best = 0;
  if (n === 6) {
    for (let skip = 0; skip < 6; skip++) {
      let k = 0;
      for (let i = 0; i < 6; i++) if (i !== skip) five[k++] = seven[i];
      const score = eval5(five);
      if (score > best) best = score;
    }
    return best;
  }
  for (let skipA = 0; skipA < 7; skipA++) {
    for (let skipB = skipA + 1; skipB < 7; skipB++) {
      let k = 0;
      for (let i = 0; i < 7; i++) {
        if (i === skipA || i === skipB) continue;
        five[k++] = seven[i];
      }
      const score = eval5(five);
      if (score > best) best = score;
    }
  }
  return best;
}

export function categoryOf(score: number): number {
  let x = score;
  for (let i = 0; i < 5; i++) x = Math.floor(x / 15);
  return x;
}

export const CATEGORY_NAME = [
  "high card",
  "pair",
  "two pair",
  "trips",
  "straight",
  "flush",
  "full house",
  "quads",
  "straight flush",
];
