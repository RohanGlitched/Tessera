"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useBaskets } from "@/lib/use-baskets";
import { useMarket } from "./market-provider";
import { valueBasket } from "@/lib/basket-view";
import { BasketCard } from "./basket-card";
import { count, money } from "@/lib/format";
import { CardSkeletons } from "./skeletons";

/**
 * Every basket, in an order the visitor chooses.
 *
 * There is no curation and no ranking algorithm here on purpose: the list is
 * literally what `getProgramAccounts` returns, and the only editorial act is the
 * sort key, which the visitor picks.
 */

type SortKey = "newest" | "value" | "activity" | "components";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "value", label: "Most valuable share" },
  { key: "activity", label: "Most traded" },
  { key: "components", label: "Most holdings" },
];

export function Explorer() {
  const { baskets, error, loading } = useBaskets();
  const { snapshot } = useMarket();
  const [sort, setSort] = useState<SortKey>("newest");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!baskets) return [];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? baskets.filter(
          (b) =>
            b.name.toLowerCase().includes(needle) ||
            b.symbol.toLowerCase().includes(needle) ||
            b.creator.toLowerCase().startsWith(needle),
        )
      : baskets.slice();

    const navOf = (address: string) =>
      valueBasket(
        baskets.find((b) => b.address === address)!,
        snapshot,
      ).nav ?? 0;

    switch (sort) {
      case "value":
        return filtered.sort((a, b) => navOf(b.address) - navOf(a.address));
      case "activity":
        return filtered.sort(
          (a, b) =>
            Number(b.mintCount + b.redeemCount) -
            Number(a.mintCount + a.redeemCount),
        );
      case "components":
        return filtered.sort(
          (a, b) => b.components.length - a.components.length,
        );
      default:
        return filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [baskets, snapshot, sort, query]);

  const totalValue = useMemo(
    () =>
      (baskets ?? []).reduce(
        (sum, b) => sum + (valueBasket(b, snapshot).nav ?? 0),
        0,
      ),
    [baskets, snapshot],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <h1 className="display text-hero leading-[0.95] text-ivory">
            Every basket
          </h1>
          <p className="mt-4 max-w-[54ch] text-base leading-relaxed text-ivory-dim">
            Read straight from the program. Nothing here is listed,
            approved, or promoted. If somebody laid it, it is on this page.
          </p>
        </div>
        {baskets && baskets.length > 0 && (
          <dl className="tnum flex gap-8 text-sm">
            <div>
              <dt className="text-xs text-ivory-faint">Baskets</dt>
              <dd className="display mt-1 text-xl text-ivory">
                {count(baskets.length)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ivory-faint">Combined share price</dt>
              <dd className="display mt-1 text-xl text-ivory">
                {money(totalValue)}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {baskets && baskets.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-3 border-y border-rule py-4">
          <label className="flex-1 min-w-[14rem]">
            <span className="sr-only">Search baskets</span>
            <input
              type="search"
              value={query}
              placeholder="Search by name, ticker, or creator"
              onChange={(event) => setQuery(event.target.value)}
              className="w-full border border-rule bg-ground px-3 py-2.5 text-sm text-ivory placeholder:text-ivory-faint outline-none focus-visible:border-gold"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSort(option.key)}
                aria-pressed={sort === option.key}
                className="border px-3 py-2.5 text-xs transition-colors"
                style={{
                  borderColor:
                    sort === option.key
                      ? "var(--color-gold)"
                      : "var(--color-rule)",
                  color:
                    sort === option.key
                      ? "var(--color-gold)"
                      : "var(--color-ivory-dim)",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && <CardSkeletons count={6} />}

      {error && (
        <p className="mt-12 border-l-2 border-loss pl-3 text-sm leading-relaxed text-loss">
          {error}
        </p>
      )}

      {baskets && baskets.length === 0 && (
        <div className="mt-12 border border-dashed border-rule-bright/60 px-8 py-16 text-center">
          <p className="display text-xl text-ivory">The program is empty.</p>
          <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-ivory-dim">
            No baskets have been laid on this cluster yet. Laying one takes a
            single transaction.
          </p>
          <Link
            href="/compose"
            className="mt-7 inline-block border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e]"
          >
            Lay the first one
          </Link>
        </div>
      )}

      {baskets && baskets.length > 0 && rows.length === 0 && (
        <p className="mt-12 text-sm leading-relaxed text-ivory-dim">
          Nothing matches “{query.trim()}”. Clear the search to see all{" "}
          {count(baskets.length)}.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <h2 className="sr-only">Baskets</h2>
          {rows.map((basket) => (
            <BasketCard key={basket.address} basket={basket} />
          ))}
        </div>
      )}
    </div>
  );
}
