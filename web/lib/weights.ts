/**
 * Weights, as integers that always add to exactly 10,000 basis points.
 *
 * The program refuses a recipe whose weights do not sum to one, and refuses a
 * component weighted at zero. Floating point cannot promise either, so weights are
 * whole basis points here from end to end and every operation closes its own
 * rounding gap before returning.
 */

const TOTAL = 10_000;
const MIN = 1;

/** Distribute a total across n slots as evenly as integers allow. */
export function equalWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(TOTAL / n);
  const out = new Array<number>(n).fill(base);
  let remainder = TOTAL - base * n;
  for (let i = 0; remainder > 0; i = (i + 1) % n, remainder--) out[i] += 1;
  return out;
}

/**
 * Weights proportional to a measure, such as liquidity or market value.
 *
 * Uses largest-remainder: floor everything, then hand the leftover basis points to
 * whoever lost the most to rounding. That keeps the sum exact without letting one
 * slot absorb all the error.
 */
export function proportionalWeights(values: number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equalWeights(values.length);

  const exact = clean.map((v) => (v / sum) * TOTAL);
  const floored = exact.map((v) => Math.max(MIN, Math.floor(v)));
  let short = TOTAL - floored.reduce((a, b) => a + b, 0);

  const order = exact
    .map((v, i) => ({ i, loss: v - Math.floor(v) }))
    .sort((a, b) => b.loss - a.loss);

  for (let k = 0; short > 0; k = (k + 1) % order.length, short--) {
    floored[order[k].i] += 1;
  }
  // If the MIN floor pushed us over, claw back from the largest.
  while (short < 0) {
    const largest = floored.indexOf(Math.max(...floored));
    floored[largest] -= 1;
    short++;
  }
  return floored;
}

/**
 * Set one weight and rebalance the rest.
 *
 * The others move in proportion to what they already held, so a slider drag does
 * not reshuffle the ranking of the components the reader is not touching.
 */
export function setWeight(
  weights: number[],
  index: number,
  next: number,
): number[] {
  const n = weights.length;
  if (n === 0) return weights;
  if (n === 1) return [TOTAL];

  const target = Math.min(TOTAL - MIN * (n - 1), Math.max(MIN, Math.round(next)));
  const remaining = TOTAL - target;

  const others = weights.filter((_, i) => i !== index);
  const otherSum = others.reduce((a, b) => a + b, 0);

  const scaled = others.map((w) =>
    Math.max(MIN, Math.round(otherSum > 0 ? (w / otherSum) * remaining : remaining / others.length)),
  );

  // Close the gap on the largest of the others, so the touched slider holds still.
  let drift = remaining - scaled.reduce((a, b) => a + b, 0);
  while (drift !== 0) {
    const pick = drift > 0
      ? scaled.indexOf(Math.max(...scaled))
      : scaled.findIndex((w) => w > MIN);
    if (pick < 0) break;
    scaled[pick] += drift > 0 ? 1 : -1;
    drift += drift > 0 ? -1 : 1;
  }

  const out: number[] = [];
  let cursor = 0;
  for (let i = 0; i < n; i++) out.push(i === index ? target : scaled[cursor++]);
  return out;
}

/** Drop a slot and give its weight back to the others in proportion. */
export function removeWeight(weights: number[], index: number): number[] {
  const kept = weights.filter((_, i) => i !== index);
  if (!kept.length) return [];
  return proportionalWeights(kept);
}

/** Add a slot at an equal share, taking it from the others in proportion. */
export function addWeight(weights: number[]): number[] {
  return equalWeights(weights.length + 1);
}

export const WEIGHT_TOTAL = TOTAL;
