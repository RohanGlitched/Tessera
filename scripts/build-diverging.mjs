// The market map encodes 24h price change as a diverging scale: two single-hue
// ramps rising out of one neutral midpoint.
//
// Finance convention is green-up / red-down, but that pair is the textbook
// deuteranopia failure — the two poles collapse to the same colour. So we search
// for the gain hue *closest to green* whose poles still separate under simulated
// protanopia and deuteranopia at every magnitude step, and label every tile with
// a signed number so identity never rests on colour alone.
import { execFileSync } from "node:child_process";

const VALIDATOR =
  "/tmp/claude-1000/bundled-skills/2.1.270/348a885e8d5028abe2d288568ced9344/dataviz/scripts/validate_palette.js";
const SURFACE = "#0F1B33";

const f = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h),
    b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.001 && v <= 1.001);
function hex(L, C, h) {
  let c = C;
  while (c > 0.01 && !inGamut(oklchToRgb(L, c, h))) c -= 0.002;
  const rgb = oklchToRgb(L, c, h).map((v) => Math.round(Math.min(1, Math.max(0, f(v))) * 255));
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function run(list, extra = []) {
  try {
    return {
      ok: true,
      out: execFileSync(
        "node",
        [VALIDATOR, list.join(","), "--mode", "dark", "--surface", SURFACE, ...extra],
        { encoding: "utf8" },
      ),
    };
  } catch (e) {
    return { ok: false, out: (e.stdout || "") + (e.stderr || "") };
  }
}
const cvdWorst = (out) => {
  const m = out.match(/CVD separation\s+worst adjacent \S+\s+ΔE ([\d.]+)/);
  return m ? parseFloat(m[1]) : 0;
};

// Three magnitude steps per pole, all inside the dark categorical band so the
// poles can also be checked against each other as a categorical pair.
const Ls = [0.485, 0.575, 0.665];
const Cs = [0.10, 0.13, 0.16];
const ramp = (hue) => Ls.map((L, i) => hex(L, Cs[i], hue));

// Neutral midpoint: effectively no chroma, clearly above the lapis surface.
const NEUTRAL = hex(0.5, 0.006, 260);

let best = null;
for (const gainH of Array.from({ length: 26 }, (_, i) => 150 + i * 4)) {
  for (const lossH of [12, 18, 24, 30, 36]) {
    const loss = ramp(lossH),
      gain = ramp(gainH);
    const a = run(loss, ["--ordinal"]);
    const b = run(gain, ["--ordinal"]);
    if (!a.ok || !b.ok) continue;
    // Every matched pair of steps must survive protan and deutan.
    let worst = Infinity;
    let allOk = true;
    for (let i = 0; i < Ls.length; i++) {
      // Only the CVD separation of this pair matters here; the other checks
      // are already covered by validating each ramp on its own.
      const c = run([loss[i], gain[i]]);
      const w = cvdWorst(c.out);
      if (w === 0) allOk = false;
      worst = Math.min(worst, w);
    }
    if (!allOk || worst < 8) continue;
    // Prefer the gain hue nearest true green that still clears the bar.
    const greenDistance = Math.abs(gainH - 155);
    if (!best || greenDistance < best.greenDistance) {
      best = { gainH, lossH, loss, gain, worst, greenDistance, a: a.out, b: b.out };
    }
  }
}

if (!best) {
  console.error("no CVD-safe diverging scale found");
  process.exit(1);
}
console.log(
  `gain hue ${best.gainH}°  loss hue ${best.lossH}°  worst CVD ΔE across matched steps = ${best.worst}`,
);
console.log("neutral :", NEUTRAL);
console.log("loss    :", best.loss.join(","));
console.log("gain    :", best.gain.join(","));
console.log("\n--- loss ramp ---" + best.a);
console.log("--- gain ramp ---" + best.b);
for (let i = 0; i < Ls.length; i++) {
  console.log(`--- poles at step ${i + 1} ---` + run([best.loss[i], best.gain[i]]).out);
}
