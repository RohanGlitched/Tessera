/**
 * The track record of a recipe.
 *
 * A basket is a fixed quantity of each component per share, so what a share
 * would have been worth on any past day is those quantities times that day's
 * prices. This module computes that series from the listed shares' adjusted
 * closes, scaled so each component's line ends exactly at its live value on
 * chain today: the shape of the past year is the share's total return, and the
 * last point is the number on the basket page.
 *
 * Two honesties are built in rather than footnoted. A component with no listed
 * history (a pre-IPO PreStock) is held flat at today's value and named. A
 * component listed more recently than the range asked for pulls the start of
 * the chart forward to its first trading day, rather than being invented.
 */

import type { History, Series } from "./history";

export type TrackComponent = {
  /** The listed ticker, used to find its history. */
  base: string;
  /** Dollar value of this component inside one share, today. */
  valueNow: number;
};

export type Range = "1m" | "3m" | "6m" | "1y";

export const RANGES: { key: Range; label: string; days: number }[] = [
  { key: "1m", label: "1 month", days: 31 },
  { key: "3m", label: "3 months", days: 92 },
  { key: "6m", label: "6 months", days: 183 },
  { key: "1y", label: "1 year", days: 366 },
];

export type TrackPoint = {
  /** YYYYMMDD */
  d: number;
  /** What one share would have been worth, total return. */
  nav: number;
  /** The same starting dollars in the benchmark. */
  bench: number | null;
};

export type Track = {
  points: TrackPoint[];
  start: number;
  end: number;
  /** Total return over the range, percent. */
  returnPct: number;
  /** Price return over the range, percent: total return without the dividends. */
  priceReturnPct: number;
  benchReturnPct: number | null;
  /** Deepest peak-to-trough fall over the range, percent, as a negative number. */
  maxDrawdownPct: number;
  /** Annualised standard deviation of daily returns, percent. Null if too short. */
  volPct: number | null;
  bestDay: { d: number; pct: number } | null;
  worstDay: { d: number; pct: number } | null;
  /** Share of today's value with a listed history behind it, 0 to 1. */
  listedShare: number;
  /** Components held flat because they have no listed history. */
  unlisted: string[];
  /** Components listed after the range began, which pulled the start forward. */
  startedLate: { base: string; d: number }[];
  /** Components whose history came from the snapshot, not a live read. */
  stale: string[];
};

export const dayToDate = (d: number) =>
  new Date(Date.UTC(Math.floor(d / 10000), Math.floor((d / 100) % 100) - 1, d % 100));

export const dateToDay = (date: Date) =>
  date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();

/** Value at or before a day, forward-filled; the last known value if none before. */
function valueOn(series: Series, field: "adj" | "close", day: number, cursor: { i: number }) {
  const t = series.t;
  while (cursor.i + 1 < t.length && t[cursor.i + 1] <= day) cursor.i++;
  return series[field][cursor.i];
}

export function trackRecord(
  components: TrackComponent[],
  history: History | null,
  range: Range = "1y",
  now: Date = new Date(),
): Track | null {
  if (!history) return null;
  const listed = components.filter((c) => history.series[c.base] && c.valueNow > 0);
  const unlisted = components.filter((c) => !history.series[c.base]).map((c) => c.base);
  const total = components.reduce((a, c) => a + Math.max(0, c.valueNow), 0);
  if (!listed.length || total <= 0) return null;

  const bench = history.series[history.benchmark];
  const calendar = bench ?? history.series[listed[0].base];
  const rangeDays = RANGES.find((r) => r.key === range)?.days ?? 366;
  const wanted = dateToDay(new Date(now.getTime() - rangeDays * 86_400_000));

  // The chart starts at the range, or at the first day every component traded.
  // The history itself begins a year back, so a component is only "late" when
  // its first close comes a week or more after the earliest day on the
  // calendar; one missing session at the edge is the data, not a listing.
  let start = Math.max(wanted, calendar.t[0]);
  const startedLate: { base: string; d: number }[] = [];
  for (const c of listed) {
    const first = history.series[c.base].t[0];
    if (first > start) {
      const lateBy = (dayToDate(first).getTime() - dayToDate(start).getTime()) / 86_400_000;
      if (lateBy >= 7) startedLate.push({ base: c.base, d: first });
      start = first;
    }
  }
  const startIndex = calendar.t.findIndex((d) => d >= start);
  if (startIndex < 0) return null;
  const days = calendar.t.slice(startIndex);
  if (days.length < 2) return null;

  const flat = components
    .filter((c) => !history.series[c.base])
    .reduce((a, c) => a + Math.max(0, c.valueNow), 0);

  const lanes = listed.map((c) => {
    const s = history.series[c.base];
    const last = s.adj[s.adj.length - 1];
    const lastClose = s.close[s.close.length - 1];
    return { s, scaleAdj: c.valueNow / last, scaleClose: c.valueNow / lastClose, adj: { i: 0 }, close: { i: 0 } };
  });
  const benchCursor = { i: 0 };

  const points: TrackPoint[] = [];
  const priceNav: number[] = [];
  for (const d of days) {
    let nav = flat;
    let price = flat;
    for (const lane of lanes) {
      nav += valueOn(lane.s, "adj", d, lane.adj) * lane.scaleAdj;
      price += valueOn(lane.s, "close", d, lane.close) * lane.scaleClose;
    }
    points.push({ d, nav, bench: null });
    priceNav.push(price);
  }
  if (bench) {
    const b0 = valueOn(bench, "adj", days[0], { i: 0 });
    const cursor = benchCursor;
    const first = points[0].nav;
    for (const p of points) p.bench = (first * valueOn(bench, "adj", p.d, cursor)) / b0;
  }

  const first = points[0].nav;
  const last = points[points.length - 1].nav;
  const returnPct = ((last - first) / first) * 100;
  const priceReturnPct = ((priceNav[priceNav.length - 1] - priceNav[0]) / priceNav[0]) * 100;
  const benchReturnPct =
    bench && points[0].bench && points[points.length - 1].bench
      ? ((points[points.length - 1].bench! - points[0].bench!) / points[0].bench!) * 100
      : null;

  let peak = first;
  let maxDrawdownPct = 0;
  let bestDay: Track["bestDay"] = null;
  let worstDay: Track["worstDay"] = null;
  const dailies: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.nav > peak) peak = p.nav;
    const dd = ((p.nav - peak) / peak) * 100;
    if (dd < maxDrawdownPct) maxDrawdownPct = dd;
    if (i > 0) {
      const r = p.nav / points[i - 1].nav - 1;
      dailies.push(r);
      if (!bestDay || r * 100 > bestDay.pct) bestDay = { d: p.d, pct: r * 100 };
      if (!worstDay || r * 100 < worstDay.pct) worstDay = { d: p.d, pct: r * 100 };
    }
  }
  let volPct: number | null = null;
  if (dailies.length >= 20) {
    const mean = dailies.reduce((a, r) => a + r, 0) / dailies.length;
    const variance = dailies.reduce((a, r) => a + (r - mean) ** 2, 0) / (dailies.length - 1);
    volPct = Math.sqrt(variance) * Math.sqrt(252) * 100;
  }

  const listedValue = listed.reduce((a, c) => a + c.valueNow, 0);
  const stale = listed.map((c) => c.base).filter((b) => history.stale.includes(b));

  return {
    points,
    start: days[0],
    end: days[days.length - 1],
    returnPct,
    priceReturnPct,
    benchReturnPct,
    maxDrawdownPct,
    volPct,
    bestDay,
    worstDay,
    listedShare: listedValue / total,
    unlisted,
    startedLate,
    stale,
  };
}

/** A short date for an axis or a note: "6 Oct" or "6 Oct 2025". */
export function shortDay(d: number, withYear = false): string {
  return dayToDate(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}
