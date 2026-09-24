"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Basket } from "@/lib/tessera";
import { valueBasket } from "@/lib/basket-view";
import { PRESTOCK_SYMBOLS } from "@/lib/prestocks";
import { dbcPoolFor } from "@/lib/dbc";
import { useMarket } from "./market-provider";
import { BasketMosaic } from "./basket-mosaic";
import { money, signedPercent, percent, count, shortAddress } from "@/lib/format";

export function BasketCard({ basket }: { basket: Basket }) {
  const { snapshot } = useMarket();
  const valuation = useMemo(
    () => valueBasket(basket, snapshot),
    [basket, snapshot],
  );

  const tiles = valuation.components.map((c) => ({
    key: c.mint,
    label: c.base,
    weightBps: c.actualWeightBps ?? c.targetWeightBps,
    slot: c.slot,
  }));

  const hasPreStocks = valuation.components.some((c) =>
    PRESTOCK_SYMBOLS.has(c.symbol),
  );
  const dbc = dbcPoolFor(basket.address);

  return (
    <Link
      href={`/basket/${basket.address}`}
      className="group block border border-rule bg-ground transition-colors hover:border-rule-bright"
    >
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="display truncate text-lg text-ivory">{basket.name}</h3>
          <p className="tnum mt-0.5 text-xs text-ivory-faint">
            {basket.symbol} · {basket.components.length}{" "}
            {basket.components.length === 1 ? "component" : "components"} · by{" "}
            {shortAddress(basket.creator)}
          </p>
          {(hasPreStocks || dbc) && (
            <p className="mt-1.5 flex gap-2 text-xs">
              {hasPreStocks && (
                <span className="text-ivory-faint">Includes PreStocks</span>
              )}
              {dbc && <span className="text-gold">Meteora DBC market</span>}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum display text-lg text-ivory">
            {money(valuation.nav)}
          </p>
          <p
            className="tnum text-xs"
            style={{
              color:
                valuation.change24h == null
                  ? "var(--color-ivory-faint)"
                  : valuation.change24h > 0
                    ? "var(--color-gain)"
                    : "var(--color-loss)",
            }}
          >
            {signedPercent(valuation.change24h)}
          </p>
        </div>
      </div>

      <div className="mt-4 px-5">
        <BasketMosaic tiles={tiles} height={132} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-rule px-5 py-4 text-xs">
        <div>
          <dt className="text-ivory-faint">Creator fee</dt>
          <dd className="tnum mt-0.5 text-ivory-dim">
            {percent(basket.creatorFeeBps / 100)}
          </dd>
        </div>
        <div>
          <dt className="text-ivory-faint">Mints</dt>
          <dd className="tnum mt-0.5 text-ivory-dim">
            {count(Number(basket.mintCount))}
          </dd>
        </div>
        <div>
          <dt className="text-ivory-faint">Dividends inside</dt>
          <dd className="tnum mt-0.5">
            {valuation.accruedSharePct && valuation.accruedSharePct > 0.005 ? (
              <span className="text-gold">
                {percent(valuation.accruedSharePct)}
              </span>
            ) : (
              <span className="text-ivory-faint">none yet</span>
            )}
          </dd>
        </div>
      </dl>
    </Link>
  );
}
