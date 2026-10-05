"use client";

import { useMarket } from "./market-provider";
import { changeColor } from "@/lib/palette";
import { money, signedPercent } from "@/lib/format";

/**
 * Two prices for one company. Every xStock has the price its token trades at on
 * Solana and the price of the listed share behind it. The gap is the premium, and
 * it is the thing a basket of tokens cannot pretend away, so it is laid out here
 * as stones: one per ticker, coloured by how far the token sits from the share.
 */
export function Premiums() {
  const { snapshot } = useMarket();
  const rows = (snapshot?.quotes ?? [])
    .filter((q) => q.premiumBps != null && q.sharePrice != null)
    .sort((a, b) => b.premiumBps! - a.premiumBps!);
  if (!rows.length) return <div className="skeleton h-40 border border-rule" />;
  const widest = [...rows].sort((a, b) => Math.abs(b.premiumBps!) - Math.abs(a.premiumBps!))[0];
  const tightest = [...rows].sort((a, b) => Math.abs(a.premiumBps!) - Math.abs(b.premiumBps!))[0];

  return (
    <div>
      <ul className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-10" aria-label="Premium of each token to its listed share">
        {rows.map((q) => {
          const pct = q.premiumBps! / 100;
          return (
            <li
              key={q.symbol}
              className="mosaic-tile relative aspect-[5/4] p-2.5 text-[#f3eee2]"
              style={{ background: changeColor(pct * 3), boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.18)" }}
              title={`${q.base}: token ${money(q.price)}, share ${money(q.sharePrice)}`}
            >
              <span className="block text-[11px] font-semibold tracking-wide">{q.base}</span>
              <span className="tnum display absolute bottom-2 left-2.5 text-lg leading-none">{signedPercent(pct)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm leading-relaxed text-ivory-dim">
        <span className="text-ivory">{widest.base}</span> is the widest gap right now, {signedPercent(widest.premiumBps! / 100)} against a share at{" "}
        {money(widest.sharePrice)}; <span className="text-ivory">{tightest.base}</span> the tightest, at {signedPercent(tightest.premiumBps! / 100)}.
        Read from Solana mainnet and the listing&rsquo;s last print; the colour runs from a discount in rust to a premium in teal.
      </p>
    </div>
  );
}

/**
 * A dividend here is a number going up. A tokenised equity pays by raising the
 * mint's scaled-amount multiplier, not by sending anything, so a holder's balance
 * reads higher while the raw units never move. Tessera stores recipes in raw units
 * for exactly this reason.
 */
export function Dividends() {
  const { snapshot } = useMarket();
  const payers = (snapshot?.quotes ?? []).filter((q) => q.paysDividend).sort((a, b) => b.accruedYieldPct - a.accruedYieldPct);
  if (!snapshot) return <div className="skeleton h-40 border border-rule" />;
  if (!payers.length) return null;
  const max = Math.max(...payers.map((p) => p.accruedYieldPct), 0.01);

  return (
    <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4" aria-label="Tokens that pay dividends through their multiplier">
      {payers.map((q) => (
        <li key={q.symbol} className="bg-ground-deep p-5">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-ivory">{q.base}</span>
            <span className="text-xs text-ivory-faint">{q.company}</span>
          </p>
          <p className="tnum display mt-3 text-3xl text-ivory">×{q.multiplier.toFixed(4)}</p>
          <p className="mt-1 text-xs text-ivory-faint">one raw unit reads as this many</p>
          <div className="mt-4 h-1 bg-rule-bright">
            <div className="h-full bg-gold" style={{ width: `${Math.max(2, (q.accruedYieldPct / max) * 100)}%` }} />
          </div>
          <p className="tnum mt-2 text-xs text-ivory-dim">
            {q.accruedYieldPct.toFixed(2)}% accrued
            {q.nextMultiplier != null && q.nextMultiplierAt
              ? ` · next step ×${q.nextMultiplier.toFixed(4)} on ${new Date(q.nextMultiplierAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
              : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
