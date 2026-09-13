// Builds the diverging scale the market map uses for 24h price change: two
// single-hue ramps rising out of one neutral midpoint.
//
// Finance convention is green-up / red-down, which is the textbook deuteranopia
// failure — the two poles collapse to the same colour. So this searches for the
// gain hue closest to green whose poles still separate under protanopia and
// deuteranopia at every magnitude step. Tiles carry a signed number as well, so
// identity never rests on colour alone.
//
// Prints the winning scale. Paste the result into web/app/globals.css.
import { fromOklch, checkOrdinal, cvdSeparation } from "./lib/color.mjs";

const SURFACE = "#0F1B33";
const TRUE_GREEN = 155;

// Three magnitude steps per pole, all inside the dark categorical lightness band
// so the poles can also be checked against each other as a categorical pair.
const LIGHTNESS = [0.485, 0.575, 0.665];
const CHROMA = [0.1, 0.13, 0.16];

const ramp = (hue) => LIGHTNESS.map((L, i) => fromOklch(L, CHROMA[i], hue).hex);

const NEUTRAL = fromOklch(0.5, 0.006, 260).hex;

let best = null;
for (let gainHue = 150; gainHue <= 250; gainHue += 4) {
  for (const lossHue of [12, 18, 24, 30, 36]) {
    const loss = ramp(lossHue);
    const gain = ramp(gainHue);
    if (!checkOrdinal(loss, { surface: SURFACE }).passes) continue;
    if (!checkOrdinal(gain, { surface: SURFACE }).passes) continue;

    // Every matched pair of steps has to survive, not just the extremes: a scale
    // whose ends are distinct but whose middles are not is still unreadable.
    const worst = Math.min(
      ...LIGHTNESS.map((_, i) => cvdSeparation(loss[i], gain[i])),
    );
    if (worst < 8) continue;

    const greenDistance = Math.abs(gainHue - TRUE_GREEN);
    if (!best || greenDistance < best.greenDistance) {
      best = { gainHue, lossHue, loss, gain, worst, greenDistance };
    }
  }
}

if (!best) {
  console.error("no colour-vision-safe diverging scale found");
  process.exit(1);
}

console.log(`gain hue  ${best.gainHue}°`);
console.log(`loss hue  ${best.lossHue}°`);
console.log(`worst CVD separation across matched steps  ΔE ${best.worst.toFixed(1)}`);
console.log(`neutral   ${NEUTRAL}`);
console.log(`loss      ${best.loss.join(", ")}`);
console.log(`gain      ${best.gain.join(", ")}`);
for (let i = 0; i < LIGHTNESS.length; i++) {
  const separation = cvdSeparation(best.loss[i], best.gain[i]).toFixed(1);
  console.log(`  step ${i + 1}: ${best.loss[i]} vs ${best.gain[i]}  ΔE ${separation}`);
}
