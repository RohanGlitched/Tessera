"use client";

import Link from "next/link";
import { useMarket } from "./market-provider";
import { MarketMosaic } from "./market-mosaic";
import { moneyCompact, count, timeAgo } from "@/lib/format";
import { PRESTOCK_SYMBOLS } from "@/lib/prestocks";

export function HomeMosaic() {
  const { snapshot, loading, error, updatedAt } = useMarket();

  if (loading && !snapshot) {
    return (
      <div
        className="flex h-[460px] items-center justify-center border border-rule bg-ground"
        aria-busy
      >
        <p className="text-sm text-ivory-faint">Reading mainnet prices…</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="flex h-[460px] flex-col items-center justify-center gap-3 border border-rule bg-ground px-8 text-center">
        <p className="text-sm text-ivory-dim">
          Mainnet prices are unavailable right now.
        </p>
        <p className="text-xs text-ivory-faint">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <MarketMosaic quotes={snapshot.quotes} height={460} />
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3 text-xs text-ivory-faint">
        <span>
          {count(snapshot.quotes.length)} tickers ·{" "}
          {moneyCompact(
            snapshot.quotes.reduce((a, q) => a + q.liquidity, 0),
          )}{" "}
          of liquidity
          {snapshot.blockId != null && (
            <> · mainnet slot {count(snapshot.blockId)}</>
          )}
        </span>
        <span>
          {error ? `stale: ${error}` : updatedAt ? `read ${timeAgo(updatedAt)}` : ""}
        </span>
      </div>
      {snapshot.missing.length > 0 && (
        <p className="mt-2 text-xs text-loss">
          No price returned for {snapshot.missing.join(", ")}.
        </p>
      )}
    </div>
  );
}

/** Four figures that are all read live, never written down. */
export function HomeStats() {
  const { snapshot } = useMarket();
  const quotes = snapshot?.quotes ?? [];
  const prestocks = quotes.filter((q) => PRESTOCK_SYMBOLS.has(q.symbol)).length;
  const dividendPayers = quotes.filter((q) => q.paysDividend);
  const best = [...dividendPayers].sort(
    (a, b) => b.accruedYieldPct - a.accruedYieldPct,
  )[0];
  const widest = [...quotes]
    .filter((q) => q.premiumBps != null)
    .sort((a, b) => Math.abs(b.premiumBps!) - Math.abs(a.premiumBps!))[0];

  const stats: { label: string; value: string; note: string }[] = [
    {
      label: "Tokens you can compose",
      value: quotes.length ? String(quotes.length) : "—",
      note: prestocks
        ? `${quotes.length - prestocks} xStocks, ${prestocks} PreStocks, all live mints`
        : "every one a Token-2022 mint on mainnet",
    },
    {
      label: "Components per basket",
      value: "up to 8",
      note: "the program's own ceiling, not a plan tier",
    },
    {
      label: "Paying dividends on chain",
      value: dividendPayers.length ? String(dividendPayers.length) : "—",
      note: best
        ? `${best.base} has accrued ${best.accruedYieldPct.toFixed(2)}%`
        : "through the mint's scaled-amount multiplier",
    },
    {
      label: "Widest gap to the listed share",
      value: widest?.premiumBps != null
        ? `${widest.premiumBps > 0 ? "+" : "−"}${Math.abs(widest.premiumBps / 100).toFixed(2)}%`
        : "—",
      note: widest ? `${widest.base}, right now` : "premium or discount",
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px bg-rule lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-ground-deep p-5">
          <dt className="text-xs text-ivory-faint">{s.label}</dt>
          <dd className="display tnum mt-2 text-2xl text-ivory">{s.value}</dd>
          <p className="mt-1.5 text-xs leading-relaxed text-ivory-faint">
            {s.note}
          </p>
        </div>
      ))}
    </dl>
  );
}

export function ComposeCta({
  children = "Compose a basket",
}: {
  children?: React.ReactNode;
}) {
  return (
    <Link
      href="/compose"
      className="inline-flex items-center gap-2.5 border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e]"
    >
      {children}
    </Link>
  );
}
