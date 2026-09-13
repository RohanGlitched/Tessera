// Searches OKLCH space for the categorical palette used by basket mosaics.
//
// A basket holds at most 8 components, so 8 fixed slots is the whole palette and
// hues are never cycled. One slot has to land near gold (OKLCH hue ~85), because
// gold is the one signal colour in this product.
//
// Prints the three best candidates and the winner. Paste it into web/lib/palette.ts.
import { fromOklch, checkCategorical } from "./lib/color.mjs";

const SURFACE = "#0F1B33";
const GOLD_HUE = 85;
const SLOTS = 8;

const candidates = [];

// Anchor slot 0 on gold, then walk the hue circle in even steps so no two
// neighbours are close in hue, alternating lightness so neighbours differ in
// lightness too. Hue alone does not survive colour-vision deficiency.
for (const spacing of [40, 42, 45, 48, 50]) {
  for (const [light, dark] of [
    [0.66, 0.5],
    [0.665, 0.52],
    [0.65, 0.53],
    [0.67, 0.51],
  ]) {
    for (const chroma of [0.12, 0.13, 0.14, 0.15, 0.16]) {
      for (const direction of [1, -1]) {
        const slots = Array.from({ length: SLOTS }, (_, i) =>
          fromOklch(
            i % 2 === 0 ? light : dark,
            chroma,
            (GOLD_HUE + direction * i * spacing + 360) % 360,
          ),
        );
        // A slot that had to shed most of its chroma to fit in sRGB is no longer
        // the hue the search asked for, so the whole candidate is discarded.
        if (slots.some((s) => s.chroma < 0.1)) continue;

        const palette = slots.map((s) => s.hex);
        const result = checkCategorical(palette, { surface: SURFACE });
        if (!result.passes) continue;
        candidates.push({ palette, spacing, light, dark, chroma, direction, ...result });
      }
    }
  }
}

if (!candidates.length) {
  console.error("no passing palette found");
  process.exit(1);
}

// Fewest warnings first, then the most colour-vision headroom, then chroma.
candidates.sort(
  (a, b) =>
    a.warnings - b.warnings ||
    b.worstCvd - a.worstCvd ||
    b.worstNormal - a.worstNormal ||
    b.chroma - a.chroma,
);

for (const c of candidates.slice(0, 3)) {
  console.log(
    `spacing ${c.spacing}°  L ${c.light}/${c.dark}  C ${c.chroma}  ` +
      `direction ${c.direction}  warnings ${c.warnings}  ` +
      `CVD ΔE ${c.worstCvd.toFixed(1)}  normal ΔE ${c.worstNormal.toFixed(1)}`,
  );
  console.log(`  ${c.palette.join(", ")}`);
}

const winner = candidates[0];
console.log("\nwinner");
console.log(winner.palette.join(", "));
console.log(
  `worst adjacent pair under colour-vision deficiency: ΔE ${winner.worstCvd.toFixed(1)}, ` +
    `minimum contrast against the surface: ${winner.minContrast.toFixed(1)}:1`,
);
