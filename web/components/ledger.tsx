"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useConnection } from "@solana/wallet-adapter-react";
import { readLedger, type Ledger, type LedgerEntry } from "@/lib/ledger";
import { useBaskets } from "@/lib/use-baskets";
import { explorerAddress, explorerTx, WRITE_CLUSTER } from "@/lib/config";
import { count, quantity, shortAddress, timeAgo } from "@/lib/format";
import { symbolForWriteMint } from "@/lib/mirror";
import type { Basket } from "@/lib/tessera";

/**
 * The program's whole history, from its own logs.
 *
 * Nothing on this page is stored anywhere but Solana. Each row is an event the
 * program emitted in a transaction, decoded on the way through, which is why a
 * creation made from a terminal with no website involved still shows up.
 */

export function useLedger(basket?: string) {
  const { connection } = useConnection();
  const key = basket ?? "*";
  // Keyed by what was asked for, so switching baskets shows nothing stale
  // without resetting state inside the effect.
  const [state, setState] = useState<{ key: string; ledger: Ledger | null; error: string | null }>({
    key,
    ledger: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    readLedger(connection, {
      basket,
      signal: controller.signal,
      onProgress: (ledger) => !controller.signal.aborted && setState({ key, ledger, error: null }),
    })
      .then((ledger) => !controller.signal.aborted && setState({ key, ledger, error: null }))
      .catch(
        (err) =>
          !controller.signal.aborted &&
          setState({ key, ledger: null, error: err instanceof Error ? err.message : "read failed" }),
      );
    return () => controller.abort();
  }, [connection, basket, key]);

  const ledger = state.key === key ? state.ledger : null;
  const error = state.key === key ? state.error : null;
  return { ledger, error, loading: !ledger && !error, decoding: ledger != null && ledger.done < ledger.total };
}

const KIND: Record<LedgerEntry["kind"], { label: string; color: string }> = {
  created: { label: "Basket created", color: "var(--color-gold)" },
  minted: { label: "Shares created", color: "var(--color-gain)" },
  redeemed: { label: "Shares redeemed", color: "var(--color-loss)" },
};

function describe(entry: LedgerEntry, basket: Basket | undefined): string {
  const parts: string[] = [];
  if (!entry.amounts || !basket) return "";
  basket.components.forEach((c, i) => {
    const raw = entry.amounts![i];
    if (!raw || raw === "0") return;
    const label = (symbolForWriteMint(c.mint) ?? "?").replace(/x$/, "");
    parts.push(`${quantity(Number(raw) / 10 ** c.decimals, 4)} ${label}`);
  });
  return parts.join(" · ");
}

export function LedgerTable({
  entries,
  baskets,
  showBasket = true,
}: {
  entries: LedgerEntry[];
  baskets: Map<string, Basket>;
  showBasket?: boolean;
}) {
  return (
    <div className="min-w-0 overflow-x-auto border border-rule">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule text-left text-xs text-ivory-faint">
            <th className="px-3 py-3 font-normal sm:px-4">When</th>
            <th className="px-3 py-3 font-normal sm:px-4">What</th>
            {showBasket && <th className="px-3 py-3 font-normal sm:px-4">Basket</th>}
            <th className="px-3 py-3 font-normal sm:px-4">Wallet</th>
            <th className="px-3 py-3 text-right font-normal sm:px-4">Shares</th>
            <th className="hidden px-4 py-3 font-normal md:table-cell">Moved through the vault</th>
            <th className="px-3 py-3 text-right font-normal sm:px-4">Tx</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => {
            const basket = baskets.get(e.basket);
            const kind = KIND[e.kind];
            return (
              <tr key={`${e.signature}-${e.kind}`} className="border-b border-rule/60 last:border-0">
                <td className="tnum whitespace-nowrap px-3 py-3 text-ivory-dim sm:px-4" title={new Date(e.time * 1000).toISOString()}>
                  {timeAgo(e.time)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 shrink-0" style={{ background: kind.color }} />
                    <span className="text-ivory">{kind.label}</span>
                  </span>
                </td>
                {showBasket && (
                  <td className="px-3 py-3 sm:px-4">
                    <Link href={`/basket/${e.basket}`} className="text-ivory underline decoration-rule-bright underline-offset-4 hover:decoration-ivory-dim">
                      {basket?.symbol ?? e.symbol ?? shortAddress(e.basket)}
                    </Link>
                    <span className="ml-2 hidden text-xs text-ivory-faint lg:inline">{basket?.name ?? e.name}</span>
                  </td>
                )}
                <td className="tnum whitespace-nowrap px-3 py-3 sm:px-4">
                  <a href={explorerAddress(e.actor)} target="_blank" rel="noreferrer" className="text-ivory-dim underline decoration-rule-bright underline-offset-4 hover:text-ivory">
                    {shortAddress(e.actor)}
                  </a>
                </td>
                <td className="tnum px-3 py-3 text-right text-ivory sm:px-4">
                  {e.kind === "created"
                    ? `${e.componentCount} ${e.componentCount === 1 ? "holding" : "holdings"}`
                    : quantity(e.shares ?? 0, 4)}
                  {e.feeShares ? <span className="block text-xs text-ivory-faint">+{quantity(e.feeShares, 4)} to the creator</span> : null}
                </td>
                <td className="tnum hidden px-4 py-3 text-xs text-ivory-faint md:table-cell">{describe(e, basket)}</td>
                <td className="tnum whitespace-nowrap px-3 py-3 text-right sm:px-4">
                  <a href={explorerTx(e.signature)} target="_blank" rel="noreferrer" className="text-ivory-dim underline decoration-rule-bright underline-offset-4 hover:text-ivory">
                    {shortAddress(e.signature, 4, 4)}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LedgerPage() {
  const { ledger, error, loading, decoding } = useLedger();
  const { baskets } = useBaskets();
  const byAddress = useMemo(() => new Map((baskets ?? []).map((b) => [b.address, b])), [baskets]);

  const stats = useMemo(() => {
    const entries = ledger?.entries ?? [];
    const wallets = new Set(entries.map((e) => e.actor));
    const created = entries.filter((e) => e.kind === "minted").reduce((a, e) => a + (e.shares ?? 0) + (e.feeShares ?? 0), 0);
    const redeemed = entries.filter((e) => e.kind === "redeemed").reduce((a, e) => a + (e.shares ?? 0), 0);
    return {
      baskets: entries.filter((e) => e.kind === "created").length,
      creations: entries.filter((e) => e.kind === "minted").length,
      redemptions: entries.filter((e) => e.kind === "redeemed").length,
      wallets: wallets.size,
      created,
      redeemed,
      first: entries.length ? entries[entries.length - 1].time : null,
    };
  }, [ledger]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <h1 className="display text-hero leading-[0.95] text-ivory">The ledger</h1>
          <p className="mt-4 max-w-[56ch] text-base leading-relaxed text-ivory-dim">
            Every basket created, every share created and every share redeemed,
            read from the events the program wrote into its own transactions.
            There is no database behind this page: anyone can rebuild it from the
            chain.
          </p>
        </div>
        {ledger && (
          <dl className="tnum grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:flex">
            {[
              ["Baskets", count(stats.baskets)],
              ["Creations", count(stats.creations)],
              ["Redemptions", count(stats.redemptions)],
              ["Wallets", count(stats.wallets)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-ivory-faint">{label}</dt>
                <dd className="display mt-1 text-xl text-ivory">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {loading && <p className="mt-12 text-sm text-ivory-faint">Reading the program&rsquo;s transactions…</p>}
      {error && (
        <p className="mt-12 border-l-2 border-loss pl-3 text-sm leading-relaxed text-loss">
          Could not read the ledger. {error}
        </p>
      )}

      {ledger && (
        <>
          <p className="tnum mt-10 text-xs text-ivory-faint">
            {decoding
              ? `Decoding ${count(ledger.done)} of ${count(ledger.total)} transactions in your browser…`
              : `${count(ledger.entries.length)} events on ${WRITE_CLUSTER}`}
            {!decoding && stats.first ? ` since ${new Date(stats.first * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            {!decoding && (
              <>
                {" · "}
                {quantity(stats.created, 2)} shares created and {quantity(stats.redeemed, 2)} redeemed across every basket
              </>
            )}
            {ledger.truncated ? " · showing the most recent 300 transactions" : ""}
          </p>
          <div className="mt-4">
            {ledger.entries.length === 0 && decoding ? (
              <p className="text-sm text-ivory-faint">Reading the program&rsquo;s transactions…</p>
            ) : ledger.entries.length === 0 ? (
              <p className="border border-dashed border-rule-bright/60 px-6 py-10 text-sm text-ivory-dim">
                The program has not settled anything yet.
              </p>
            ) : (
              <LedgerTable entries={ledger.entries} baskets={byAddress} />
            )}
          </div>
          <p className="mt-6 max-w-[62ch] text-xs leading-relaxed text-ivory-faint">
            Each row is one <code className="text-ivory-dim">BasketCreated</code>,{" "}
            <code className="text-ivory-dim">SharesMinted</code> or{" "}
            <code className="text-ivory-dim">SharesRedeemed</code> event, decoded from
            the <code className="text-ivory-dim">Program data</code> lines of the
            transaction log, in your browser, against the public RPC. The decoder is{" "}
            <code className="text-ivory-dim">web/lib/ledger.ts</code>, and what it has
            decoded stays in this browser so the next visit only reads what is new.
          </p>
        </>
      )}
    </div>
  );
}

/** One basket's own history, for its page. */
export function BasketHistory({ basket }: { basket: Basket }) {
  const { ledger, error, loading, decoding } = useLedger(basket.address);
  const baskets = useMemo(() => new Map([[basket.address, basket]]), [basket]);
  return (
    <section className="mt-16">
      <h2 className="display text-title text-ivory">Everything that has happened to it</h2>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ivory-dim">
        Every creation and redemption since the basket was made, decoded from the
        program&rsquo;s own events. The full ledger across every basket is on{" "}
        <Link href="/ledger" className="text-ivory underline decoration-rule-bright underline-offset-4 hover:decoration-ivory-dim">
          one page
        </Link>
        .
      </p>
      <div className="mt-7">
        {loading && <p className="text-sm text-ivory-faint">Reading the transactions…</p>}
        {error && <p className="text-sm text-loss">Could not read the history. {error}</p>}
        {ledger && ledger.entries.length === 0 && !decoding && (
          <p className="border border-dashed border-rule-bright/60 px-6 py-8 text-sm text-ivory-dim">
            Nothing yet beyond the basket being created.
          </p>
        )}
        {ledger && decoding && (
          <p className="mb-3 text-xs text-ivory-faint">
            Decoding {count(ledger.done)} of {count(ledger.total)} transactions…
          </p>
        )}
        {ledger && ledger.entries.length > 0 && (
          <LedgerTable entries={ledger.entries} baskets={baskets} showBasket={false} />
        )}
      </div>
    </section>
  );
}
