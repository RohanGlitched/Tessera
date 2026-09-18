"use client";

import Link from "next/link";
import { useBaskets } from "@/lib/use-baskets";
import { BasketCard } from "./basket-card";

export function FeaturedBaskets() {
  const { baskets, error, loading } = useBaskets();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="display text-title text-ivory">Laid so far</h2>
          <p className="mt-2 text-sm text-ivory-dim">
            Every basket, read straight from the program.
          </p>
        </div>
        <Link
          href="/explore"
          className="border border-rule px-4 py-2.5 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
        >
          See all
        </Link>
      </div>

      {loading && (
        <p className="mt-10 text-sm text-ivory-faint">Reading the program…</p>
      )}

      {error && (
        <p className="mt-10 border-l-2 border-loss pl-3 text-sm leading-relaxed text-loss">
          {error}
        </p>
      )}

      {baskets && baskets.length === 0 && (
        <div className="mt-10 border border-dashed border-rule-bright/60 px-8 py-14 text-center">
          <p className="display text-xl text-ivory">Nobody has laid one yet.</p>
          <p className="mx-auto mt-3 max-w-[46ch] text-sm leading-relaxed text-ivory-dim">
            The program is deployed and waiting. The first basket takes one
            transaction and about four minutes.
          </p>
          <Link
            href="/compose"
            className="mt-7 inline-block border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e]"
          >
            Lay the first one
          </Link>
        </div>
      )}

      {baskets && baskets.length > 0 && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {baskets.slice(0, 6).map((basket) => (
            <BasketCard key={basket.address} basket={basket} />
          ))}
        </div>
      )}
    </div>
  );
}
