// Searches OKLCH space for the categorical palette used by basket mosaics.
// A basket holds at most 8 components, so 8 fixed slots is the whole palette and
// hues are never cycled.
//
// Constraint beyond the standard checks: one slot must land near gold (OKLCH hue
// ~85), because gold is the signature tessera colour of this product.
import { execFileSync } from "node:child_process";

const VALIDATOR =
  "/tmp/claude-1000/bundled-skills/2.1.270/348a885e8d5028abe2d288568ced9344/dataviz/scripts/validate_palette.js";
const SURFACE = "#0F1B33";
const GOLD_HUE = 85;

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
  while (c > 0.02 && !inGamut(oklchToRgb(L, c, h))) c -= 0.002;
  const rgb = oklchToRgb(L, c, h).map((v) => Math.round(Math.min(1, Math.max(0, f(v))) * 255));
  return { hex: "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join(""), c };
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
const num = (out, label) => {
  const m = out.match(new RegExp(label + "[^\\n]*?ΔE ([\\d.]+)"));
  return m ? parseFloat(m[1]) : 0;
};

const results = [];
// Anchor slot 0 on gold, then walk the hue circle in even steps so no two
// neighbours are close in hue, alternating lightness so neighbours also differ
// in lightness (hue alone does not survive colour-vision deficiency).
for (const spacing of [40, 42, 45, 48, 50]) {
  for (const [hi, lo] of [
    [0.66, 0.5],
    [0.665, 0.52],
    [0.65, 0.53],
    [0.67, 0.51],
  ]) {
    for (const C of [0.12, 0.13, 0.14, 0.15, 0.16]) {
      for (const dir of [1, -1]) {
        const slots = [];
        for (let i = 0; i < 8; i++) {
          const L = i % 2 === 0 ? hi : lo;
          const h = (GOLD_HUE + dir * i * spacing + 360) % 360;
          slots.push(hex(L, C, h));
        }
        if (slots.some((s) => s.c < 0.1)) continue;
        const list = slots.map((s) => s.hex);
        const r = run(list);
        if (!r.ok) continue;
        results.push({
          list,
          spacing,
          hi,
          lo,
          C,
          dir,
          cvd: num(r.out, "CVD separation"),
          normal: num(r.out, "Normal-vision floor"),
          warns: (r.out.match(/\[WARN\]/g) || []).length,
          out: r.out,
        });
      }
    }
  }
}

if (!results.length) {
  console.error("no passing palette found");
  process.exit(1);
}
// Prefer fewest warnings, then the most colour-vision headroom, then chroma.
results.sort(
  (a, b) => a.warns - b.warns || b.cvd - a.cvd || b.normal - a.normal || b.C - a.C,
);
for (const r of results.slice(0, 3)) {
  console.log(
    `spacing=${r.spacing}° L=${r.hi}/${r.lo} C=${r.C} dir=${r.dir} warns=${r.warns} cvdΔE=${r.cvd} normalΔE=${r.normal}`,
  );
  console.log("  " + r.list.join(","));
}
console.log("\n=== winner ===");
console.log(results[0].list.join(","));
console.log(results[0].out);
