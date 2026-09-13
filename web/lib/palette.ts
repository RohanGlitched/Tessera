/**
 * Every data colour in Tessera comes from here, and every value below was
 * produced and checked by the scripts in ../../scripts, not chosen by eye:
 *
 *   scripts/build-palette.mjs    -> COMPONENT_SLOTS  (categorical, 8 fixed slots)
 *   scripts/build-diverging.mjs  -> CHANGE_SCALE     (diverging, 24h price change)
 *
 * Both were validated against the lapis chart surface for lightness band, chroma
 * floor, protan/deutan separation, normal-vision separation and contrast.
 * If you change a hex here, re-run the script and paste the new passing set.
 */

export const CHART_SURFACE = "#0f1b33";

/**
 * Basket components, in fixed slot order. A basket holds at most 8 components,
 * which is exactly the palette size, so hues are assigned by slot index and are
 * never cycled or generated.
 *
 * Slot 0 is gold: the signature tessera.
 */
export const COMPONENT_SLOTS = [
  "#b18827", // gold
  "#4f7a2a", // olive
  "#08a693", // teal
  "#02769b", // lapis
  "#7d87d7", // periwinkle
  "#8e5192", // amethyst
  "#cd6e7a", // rose
  "#9c5909", // sienna
] as const;

export const slotColor = (index: number): string =>
  COMPONENT_SLOTS[index % COMPONENT_SLOTS.length];

/**
 * 24h price change, as a diverging scale: two single-hue ramps out of one
 * neutral midpoint. Gains sit at hue 186 rather than a true green because the
 * green/red pair collapses under deuteranopia; at 186 the poles hold a worst-case
 * separation of 8.1 while still reading as the market's cool/warm convention.
 *
 * Contrast against the surface is below 3:1 at the faint end, so tiles using this
 * scale must carry a visible signed label and the view must offer a table.
 */
export const CHANGE_SCALE = {
  loss: ["#8e4835", "#b8593f", "#e46a49"],
  neutral: "#616367",
  gain: ["#046e66", "#058c82", "#05aa9e"],
} as const;

/** Percentage moves at or above this read as the strongest tile. */
const STRONG_MOVE = 3;
/** Moves below this are noise and read as neutral. */
const FLAT_MOVE = 0.1;

/** Map a percentage change onto the diverging scale. */
export function changeColor(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return CHANGE_SCALE.neutral;
  const magnitude = Math.abs(percent);
  if (magnitude < FLAT_MOVE) return CHANGE_SCALE.neutral;
  const ramp = percent > 0 ? CHANGE_SCALE.gain : CHANGE_SCALE.loss;
  if (magnitude >= STRONG_MOVE) return ramp[2];
  if (magnitude >= STRONG_MOVE / 2) return ramp[1];
  return ramp[0];
}

/** Ink colour for a signed figure. Used on text, never as a fill. */
export function changeInk(percent: number | null | undefined): string {
  if (percent == null || !Number.isFinite(percent)) return "var(--color-ivory-dim)";
  if (Math.abs(percent) < FLAT_MOVE) return "var(--color-ivory-dim)";
  return percent > 0 ? "var(--color-gain)" : "var(--color-loss)";
}

/**
 * Legend steps for the diverging scale, from strongest loss to strongest gain.
 * Rendered wherever the market map appears, because colour alone never carries
 * meaning.
 */
export const CHANGE_LEGEND = [
  { color: CHANGE_SCALE.loss[2], label: `−${STRONG_MOVE}% or worse` },
  { color: CHANGE_SCALE.loss[1], label: `−${STRONG_MOVE / 2}%` },
  { color: CHANGE_SCALE.loss[0], label: "slightly down" },
  { color: CHANGE_SCALE.neutral, label: "flat" },
  { color: CHANGE_SCALE.gain[0], label: "slightly up" },
  { color: CHANGE_SCALE.gain[1], label: `+${STRONG_MOVE / 2}%` },
  { color: CHANGE_SCALE.gain[2], label: `+${STRONG_MOVE}% or better` },
] as const;
