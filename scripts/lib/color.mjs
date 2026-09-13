// Colour maths for the two palette search scripts: OKLCH construction with gamut
// mapping, colour-vision-deficiency simulation, and the checks a palette has to
// clear before it goes into the app.
//
// Thresholds are ΔE in OKLab ×100 unless noted. The CVD numbers are calibrated
// against the Machado-Oliveira-Fernandes simulation below; swapping in another
// model (Viénot, Brettel) moves borderline pairs and would need recalibrating.

export const BAND = { light: [0.43, 0.77], dark: [0.48, 0.67] };
export const CHROMA_FLOOR = 0.1;
export const CVD_TARGET = 8;
export const CVD_FLOOR = 6;
export const NORMAL_FLOOR = 15;
export const CONTRAST_MIN = 3;
export const ORDINAL_MIN_DL = 0.06;
// Only the lightest step of a ramp carries a contrast requirement, and a lower
// one. The dark end of a sequential scale is supposed to sit close to the
// surface; holding every step to the categorical minimum would reject every
// ramp that actually reads as a ramp.
export const ORDINAL_LIGHT_FLOOR = 2;

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied in linear RGB.
const MACHADO = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};

function linearFromHex(value) {
  const h = value.replace(/^#/, "");
  return [0, 2, 4].map((i) => toLinear(parseInt(h.slice(i, i + 2), 16) / 255));
}

function oklabFromLinear([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function linearFromOklch(L, C, hueDeg) {
  const h = (hueDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.001 && v <= 1.001);

/**
 * The nearest in-gamut sRGB colour to an OKLCH coordinate, reached by reducing
 * chroma and holding lightness and hue. Returns the chroma actually used, which
 * the callers check against CHROMA_FLOOR: a hue that had to give up most of its
 * chroma to fit in sRGB is no longer the colour that was asked for.
 */
export function fromOklch(L, C, hue, minChroma = 0.02) {
  let c = C;
  while (c > minChroma && !inGamut(linearFromOklch(L, c, hue))) c -= 0.002;
  const hex = linearFromOklch(L, c, hue)
    .map((v) => Math.round(toSrgb(v) * 255).toString(16).padStart(2, "0"))
    .join("");
  return { hex: `#${hex}`, chroma: c };
}

export function oklch(hex) {
  const [L, a, b] = oklabFromLinear(linearFromHex(hex));
  return { L, C: Math.hypot(a, b), h: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 };
}

export function contrast(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = linearFromHex(hex);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function simulate(hex, kind) {
  const [r, g, b] = linearFromHex(hex);
  const M = MACHADO[kind];
  return M.map((row) => Math.min(1, Math.max(0, row[0] * r + row[1] * g + row[2] * b)));
}

/** Euclidean distance in OKLab ×100. Omit `kind` for unsimulated vision. */
export function deltaE(a, b, kind) {
  const p = oklabFromLinear(kind ? simulate(a, kind) : linearFromHex(a));
  const q = oklabFromLinear(kind ? simulate(b, kind) : linearFromHex(b));
  return 100 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

/** The worse of protanopia and deuteranopia, which is the number that matters. */
export const cvdSeparation = (a, b) =>
  Math.min(deltaE(a, b, "protan"), deltaE(a, b, "deutan"));

/**
 * Checks a categorical palette, where every colour is an identity and adjacent
 * slots are the pairs most likely to be compared. Returns numbers rather than a
 * verdict so a search can rank near-misses instead of only seeing pass or fail.
 */
export function checkCategorical(palette, { surface, mode = "dark" } = {}) {
  const [lo, hi] = BAND[mode];
  const coords = palette.map(oklch);

  let worstCvd = Infinity;
  for (let i = 1; i < palette.length; i++) {
    worstCvd = Math.min(worstCvd, cvdSeparation(palette[i - 1], palette[i]));
  }

  let worstNormal = Infinity;
  for (let i = 1; i < palette.length; i++) {
    worstNormal = Math.min(worstNormal, deltaE(palette[i - 1], palette[i]));
  }

  const contrasts = palette.map((c) => contrast(c, surface));

  return {
    worstCvd,
    worstNormal,
    minContrast: Math.min(...contrasts),
    minChroma: Math.min(...coords.map((c) => c.C)),
    inBand: coords.every((c) => c.L >= lo && c.L <= hi),
    // A CVD separation between the floor and the target is survivable only
    // because every mark here is also labelled; below the floor it is not.
    passes:
      coords.every((c) => c.L >= lo && c.L <= hi) &&
      Math.min(...coords.map((c) => c.C)) >= CHROMA_FLOOR &&
      worstCvd >= CVD_FLOOR &&
      worstNormal >= NORMAL_FLOOR &&
      Math.min(...contrasts) >= CONTRAST_MIN,
    warnings:
      (worstCvd < CVD_TARGET ? 1 : 0) + (Math.min(...contrasts) < 4.5 ? 1 : 0),
  };
}

/**
 * Checks an ordinal ramp, where the colours are magnitudes of one thing. Hue
 * separation is irrelevant and monotone lightness is the whole point.
 */
export function checkOrdinal(ramp, { surface, mode = "dark" } = {}) {
  const [lo, hi] = BAND[mode];
  const coords = ramp.map(oklch);
  const steps = coords.slice(1).map((c, i) => c.L - coords[i].L);
  const monotone = steps.every((d) => d > 0) || steps.every((d) => d < 0);
  const minStep = Math.min(...steps.map(Math.abs));
  const lightest = ramp[coords.indexOf(coords.reduce((a, b) => (a.L > b.L ? a : b)))];
  const lightestContrast = contrast(lightest, surface);

  return {
    monotone,
    minStep,
    lightestContrast,
    passes:
      monotone &&
      minStep >= ORDINAL_MIN_DL &&
      coords.every((c) => c.L >= lo && c.L <= hi) &&
      lightestContrast >= ORDINAL_LIGHT_FLOOR,
  };
}
