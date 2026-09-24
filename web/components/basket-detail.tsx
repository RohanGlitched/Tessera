"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useBasket } from "@/lib/use-baskets";
import { useBalances } from "@/lib/use-balances";
import { useOnChainBasket, valueBasket } from "@/lib/basket-view";
import { useMarket } from "./market-provider";
import { BasketMosaic } from "./basket-mosaic";
import { Figure } from "./figure";
import { FaucetButton } from "./faucet-button";
import { FillCostPanel } from "./fill-cost";
import { TOKEN_2022_PROGRAM_ID, ONE_SHARE } from "@/lib/tessera";
import {
  buildMintShares,
  buildRedeemShares,
  sendSteps,
  explainError,
} from "@/lib/tx";
import { symbolForWriteMint } from "@/lib/mirror";
import { PRESTOCK_SYMBOLS, BY_SYMBOL_PRESTOCKS } from "@/lib/prestocks";
import { dbcPoolFor } from "@/lib/dbc";
import { explorerAddress, explorerTx } from "@/lib/config";
import { slotColor } from "@/lib/palette";
import {
  money,
  percent,
  quantity,
  signedPercent,
  shortAddress,
  timeAgo,
  count,
} from "@/lib/format";
import type { Basket } from "@/lib/tessera";

/**
 * One basket, in full.
 *
 * The page answers four questions in order: what is in it, what is it worth, is it
 * actually backed, and how do I get in and out. The third one is the reason the
 * page exists — every other index product asks to be believed, and this one shows
 * the vault balance next to the claim against it.
 */

const mulDivCeil = (a: bigint, b: bigint, c: bigint) => (a * b + c - 1n) / c;
const mulDivFloor = (a: bigint, b: bigint, c: bigint) => (a * b) / c;
const ONE = BigInt(ONE_SHARE);

export function BasketDetail({ address }: { address: string }) {
  const { basket, state, error, reload } = useBasket(address);

  useEffect(() => {
    if (basket) document.title = `${basket.name} (${basket.symbol}) · Tessera`;
  }, [basket]);

  if (state === "loading") {
    return (
      <p className="py-32 text-center text-sm text-ivory-faint">
        Reading the basket…
      </p>
    );
  }

  if (state === "missing" || !basket) {
    return (
      <div className="py-32 text-center">
        <h1 className="display text-title text-ivory">No basket here.</h1>
        <p className="mx-auto mt-4 max-w-[48ch] text-base leading-relaxed text-ivory-dim">
          Nothing at this address belongs to the Tessera program. It may be on a
          different cluster, or the address may be a typo.
        </p>
        <Link
          href="/explore"
          className="mt-8 inline-block border border-rule px-5 py-3 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
        >
          See the baskets that do exist
        </Link>
      </div>
    );
  }

  if (state === "error") {
    return (
      <p className="py-32 text-center text-sm text-loss">
        Could not reach the cluster. {error}
      </p>
    );
  }

  return <Loaded basket={basket} reloadBasket={reload} />;
}

function Loaded({
  basket,
  reloadBasket,
}: {
  basket: Basket;
  /** The creation and redemption counts live on the basket record, so a trade has
   *  to refetch that too or the tally sits one behind what just happened. */
  reloadBasket: () => Promise<void>;
}) {
  const { snapshot } = useMarket();
  const { onChain, reload: reloadChain } = useOnChainBasket(basket);
  const valuation = useMemo(
    () => valueBasket(basket, snapshot),
    [basket, snapshot],
  );

  const watched = useMemo(
    () => [
      { mint: basket.shareMint, tokenProgram: TOKEN_2022_PROGRAM_ID.toBase58() },
      ...basket.components.map((c) => ({
        mint: c.mint,
        tokenProgram: basket.tokenProgram,
      })),
    ],
    [basket],
  );
  const balances = useBalances(watched);

  const tiles = valuation.components.map((c) => ({
    key: c.mint,
    label: c.base,
    sub: c.company,
    weightBps: c.actualWeightBps ?? c.targetWeightBps,
    slot: c.slot,
  }));

  const heldRaw = balances.raw.get(basket.shareMint) ?? 0n;

  return (
    <div>
      <div className="grid gap-12 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {/* ------------------------------------------------------------- left */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="display text-hero leading-[0.95] text-ivory">
              {basket.name}
            </h1>
            <p className="tnum mt-3 text-sm text-ivory-faint">
              {basket.symbol} · laid {timeAgo(basket.createdAt)} by{" "}
              <a
                href={explorerAddress(basket.creator)}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
              >
                {shortAddress(basket.creator)}
              </a>
            </p>
          </div>
          {/* Right-aligned beside the name, but once it wraps under the name on a
              narrow screen a right rag would leave it floating, so it aligns left. */}
          <div className="text-left sm:text-right">
            <p className="text-xs text-ivory-faint">One share</p>
            <p className="tnum display mt-1 text-title leading-none text-ivory">
              {money(valuation.nav)}
            </p>
            <p
              className="tnum mt-1.5 text-sm"
              style={{
                color:
                  valuation.change24h == null
                    ? "var(--color-ivory-faint)"
                    : valuation.change24h > 0
                      ? "var(--color-gain)"
                      : "var(--color-loss)",
              }}
            >
              {signedPercent(valuation.change24h)} today
            </p>
          </div>
        </div>

        <p className="mt-8 max-w-[62ch] text-base leading-relaxed text-ivory-dim">
          One {basket.symbol} share is a claim on{" "}
          {basket.components.length === 1
            ? "one holding"
            : `${basket.components.length} holdings`}{" "}
          sitting in a vault this program controls. Nobody can move them except by
          redeeming a share, and a share can always be redeemed.
        </p>

        <div className="mt-9">
          <BasketMosaic tiles={tiles} height={260} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-px bg-rule sm:grid-cols-4">
          {/* The hero already prints the price of one share, so this slot carries
              the size of the whole thing instead. */}
          <Figure
            label="Everything in the vault"
            value={
              onChain && valuation.nav != null
                ? money(valuation.nav * onChain.shares)
                : "—"
            }
            note="Components held against every outstanding share"
          />
          <Figure
            label="Against the real shares"
            value={
              valuation.premiumBps == null
                ? "—"
                : signedPercent(valuation.premiumBps / 100)
            }
            note={
              valuation.premiumBps == null
                ? valuation.components.some((c) => PRESTOCK_SYMBOLS.has(c.symbol))
                  ? "Pre-IPO components have no listed share to compare"
                  : "Needs a listed price for every component"
                : valuation.premiumBps > 0
                  ? "The tokens trade above the shares behind them"
                  : "The tokens trade below the shares behind them"
            }
            tone={
              valuation.premiumBps == null
                ? undefined
                : valuation.premiumBps > 0
                  ? "loss"
                  : "gain"
            }
          />
          <Figure
            label="Dividends inside"
            value={percent(valuation.accruedSharePct)}
            note="Share of the value that is dividends already paid on chain"
            tone={
              valuation.accruedSharePct && valuation.accruedSharePct > 0.005
                ? "gold"
                : undefined
            }
          />
          <Figure
            label="Shares outstanding"
            value={onChain ? count(onChain.shares) : "—"}
            note={`${count(Number(basket.mintCount))} creations, ${count(
              Number(basket.redeemCount),
            )} redemptions`}
          />
        </dl>

        {valuation.unpriced.length > 0 && (
          <p className="mt-5 border-l-2 border-gold pl-3 text-sm leading-relaxed text-ivory-dim">
            No price for {valuation.unpriced.join(", ")}, so the value of a share
            is left blank rather than computed from part of the basket.
          </p>
        )}

      </div>

      {/* ------------------------------------------------------------ right */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <TradePanel
          basket={basket}
          navPerShare={valuation.nav}
          balances={balances}
          shareBalance={heldRaw}
          onDone={() => {
            void balances.reload();
            void reloadChain();
            void reloadBasket();
          }}
        />
      </div>
      </div>

      <DbcPanel basketAddress={basket.address} symbol={basket.symbol} />

      {/* What it should hold, beside what it does hold. `min-w-0` on the tracks,
          because a grid item defaults to min-content and the tables inside carry a
          minimum width — without it the whole page scrolls sideways. */}
      <div className="mt-16 grid gap-14 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-16">
        <Composition basket={basket} valuation={valuation} />
        <Backing basket={basket} onChain={onChain} />
      </div>

      <FillCostPanel components={valuation.components} nav={valuation.nav} />

      <div className="mt-16 flex flex-wrap items-baseline justify-between gap-5 border-t border-rule pt-7 text-sm">
        <p className="max-w-[62ch] leading-relaxed text-ivory-dim">
          Prices come from Solana mainnet, balances from the program itself. The
          arithmetic behind both is written out in full.
        </p>
        <div className="flex gap-7">
          <Link
            href="/method"
            className="underline decoration-rule-bright underline-offset-4 transition-colors hover:text-ivory"
          >
            How it works
          </Link>
          <Link
            href="/explore"
            className="underline decoration-rule-bright underline-offset-4 transition-colors hover:text-ivory"
          >
            Every basket
          </Link>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- DBC

/**
 * This basket also has a primary market on Meteora's Dynamic Bonding Curve —
 * a separate token, not a redemption right, opened by scripts/dbc-launch.mjs
 * and sized off this basket's own NAV rather than round numbers. Shown only
 * for the one basket it exists for; see web/lib/dbc.ts.
 */
function DbcPanel({
  basketAddress,
  symbol,
}: {
  basketAddress: string;
  symbol: string;
}) {
  const pool = dbcPoolFor(basketAddress);
  if (!pool) return null;

  return (
    <section className="mt-12 border border-gold/40 bg-ground-raised px-6 py-6">
      <p className="text-xs tracking-wide text-gold">Meteora DBC</p>
      <h2 className="display mt-2 text-xl text-ivory">
        This basket has an early-access market
      </h2>
      <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ivory-dim">
        {pool.baseSymbol} trades against {pool.quoteSymbol} on a Dynamic
        Bonding Curve pool, opened by Tessera and sized off this basket&rsquo;s
        own NAV — the curve&rsquo;s opening and migration market caps are set
        at a multiple of {symbol}&rsquo;s stated value in {pool.quoteSymbol},
        not a round number picked out of the air. It is a separate token, not
        a redemption right into {symbol}: buying it is a bet on the basket
        without first assembling every component.
      </p>
      <p className="tnum mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ivory-faint">
        <a
          href={explorerAddress(pool.pool)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
        >
          Pool {shortAddress(pool.pool, 6, 6)}
        </a>
        <a
          href={explorerAddress(pool.config)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
        >
          Config {shortAddress(pool.config, 6, 6)}
        </a>
        <a
          href={explorerAddress(pool.baseMint)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
        >
          {pool.baseSymbol} mint {shortAddress(pool.baseMint, 6, 6)}
        </a>
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ composition

function Composition({
  basket,
  valuation,
}: {
  basket: Basket;
  valuation: ReturnType<typeof valueBasket>;
}) {
  return (
    <section>
      <h2 className="display text-title text-ivory">The recipe</h2>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ivory-dim">
        These numbers were written once, when the basket was laid, and cannot be
        changed. The weight on the right drifts as prices move; nothing rebalances
        it, because rebalancing would mean somebody deciding to trade your holdings.
      </p>

      {/* The market price of one component is the least useful column here — the
          value it produces is right beside it — so a narrow screen drops that and
          the company name rather than scrolling sideways. */}
      <div className="mt-7 min-w-0 overflow-x-auto border border-rule">
        <table className="w-full border-collapse text-sm sm:min-w-[34rem]">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ivory-faint">
              <th className="px-3 py-3 font-normal sm:px-4">Holding</th>
              <th className="px-3 py-3 text-right font-normal sm:px-4">
                Per share
              </th>
              <th className="hidden px-4 py-3 text-right font-normal sm:table-cell">
                Price
              </th>
              <th className="px-3 py-3 text-right font-normal sm:px-4">Value</th>
              <th className="px-3 py-3 text-right font-normal sm:px-4">Weight</th>
            </tr>
          </thead>
          <tbody>
            {valuation.components.map((c) => (
              <tr key={c.mint} className="border-b border-rule/60 last:border-0">
                <td className="px-3 py-3 sm:px-4">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0"
                      style={{ background: slotColor(c.slot) }}
                    />
                    <span>
                      <span className="text-ivory">{c.base}</span>
                      {PRESTOCK_SYMBOLS.has(c.symbol) && (
                        <span className="ml-2 text-xs text-ivory-faint">
                          PreStocks
                        </span>
                      )}
                      <span className="ml-2 hidden text-xs text-ivory-faint sm:inline">
                        {c.company}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="tnum px-3 py-3 text-right text-ivory-dim sm:px-4">
                  {quantity(c.tokensPerShare, 6)}
                </td>
                <td className="tnum hidden px-4 py-3 text-right text-ivory-dim sm:table-cell">
                  {money(c.quote?.price)}
                </td>
                <td className="tnum px-3 py-3 text-right text-ivory sm:px-4">
                  {money(c.value)}
                </td>
                <td className="tnum px-3 py-3 text-right sm:px-4">
                  <span className="text-ivory-dim">
                    {percent(
                      (c.actualWeightBps ?? c.targetWeightBps) / 100,
                      1,
                    )}
                  </span>
                  {c.actualWeightBps != null &&
                    Math.abs(c.actualWeightBps - c.targetWeightBps) > 5 && (
                      <span className="block text-xs text-ivory-faint">
                        set {percent(c.targetWeightBps / 100, 1)}
                      </span>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="tnum mt-4 text-xs leading-relaxed text-ivory-faint">
        Share mint{" "}
        <a
          href={explorerAddress(basket.shareMint)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
        >
          {shortAddress(basket.shareMint, 6, 6)}
        </a>{" "}
        · vault owner{" "}
        <a
          href={explorerAddress(basket.address)}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
        >
          {shortAddress(basket.address, 6, 6)}
        </a>{" "}
        · creator fee {percent(basket.creatorFeeBps / 100)} of shares created
      </p>
    </section>
  );
}

// --------------------------------------------------------------------- backing

function Backing({
  basket,
  onChain,
}: {
  basket: Basket;
  onChain: ReturnType<typeof useOnChainBasket>["onChain"];
}) {
  return (
    <section>
      <h2 className="display text-title text-ivory">Is it actually backed?</h2>
      <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-ivory-dim">
        Held is what the vault contains right now. Owed is what every outstanding
        share can claim. Deposits round up and redemptions round down, so held can
        only ever be at or above owed, and the difference is rounding dust that
        stays with the remaining holders.
      </p>

      {!onChain ? (
        <p className="mt-7 text-sm text-ivory-faint">Reading the vault…</p>
      ) : onChain.supply === 0n ? (
        <p className="mt-7 border border-dashed border-rule-bright/60 px-6 py-8 text-sm leading-relaxed text-ivory-dim">
          No shares exist yet, so the vault is empty and there is nothing to back.
          Create the first share and this table fills in.
        </p>
      ) : (
        <>
          <div
            className="mt-7 flex items-center gap-3 border px-4 py-3 text-sm"
            style={{
              borderColor: onChain.fullyBacked
                ? "color-mix(in oklab, var(--color-gain) 45%, transparent)"
                : "var(--color-loss)",
              color: onChain.fullyBacked
                ? "var(--color-gain)"
                : "var(--color-loss)",
            }}
          >
            <span aria-hidden className="size-2 rotate-45 bg-current" />
            {onChain.fullyBacked
              ? "Every outstanding share is fully backed."
              : "A vault is short. Do not create more shares."}
          </div>

          <div className="mt-5 min-w-0 overflow-x-auto border border-rule">
            <table className="w-full border-collapse text-sm sm:min-w-[26rem]">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ivory-faint">
                  <th className="px-3 py-3 font-normal sm:px-4">Holding</th>
                  <th className="px-3 py-3 text-right font-normal sm:px-4">Held</th>
                  <th className="px-3 py-3 text-right font-normal sm:px-4">Owed</th>
                  <th className="px-3 py-3 text-right font-normal sm:px-4">
                    Surplus
                  </th>
                </tr>
              </thead>
              <tbody>
                {onChain.vaults.map((vault, i) => {
                  const component = basket.components[i];
                  const decimals = component?.decimals ?? 0;
                  const label = symbolForWriteMint(vault.mint) ?? "Unknown";
                  const surplus = onChain.surplus[i] ?? 0n;
                  return (
                    <tr
                      key={vault.mint}
                      className="border-b border-rule/60 last:border-0"
                    >
                      <td className="px-3 py-3 text-ivory sm:px-4">
                        {label.replace(/x$/, "")}
                        {PRESTOCK_SYMBOLS.has(label) && (
                          <span className="ml-2 text-xs text-ivory-faint">
                            PreStocks
                          </span>
                        )}
                      </td>
                      <td className="tnum px-3 py-3 text-right text-ivory-dim sm:px-4">
                        {quantity(Number(vault.held) / 10 ** decimals, 6)}
                      </td>
                      <td className="tnum px-3 py-3 text-right text-ivory-dim sm:px-4">
                        {quantity(Number(vault.owed) / 10 ** decimals, 6)}
                      </td>
                      <td className="tnum px-3 py-3 text-right sm:px-4">
                        <span
                          style={{
                            color:
                              surplus > 0n
                                ? "var(--color-gold)"
                                : "var(--color-ivory-faint)",
                          }}
                        >
                          {surplus === 0n
                            ? "exact"
                            : `${surplus.toString()} ${surplus === 1n ? "unit" : "units"}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ trade panel

type Mode = "create" | "redeem";

function TradePanel({
  basket,
  navPerShare,
  balances,
  shareBalance,
  onDone,
}: {
  basket: Basket;
  navPerShare: number | null;
  balances: ReturnType<typeof useBalances>;
  shareBalance: bigint;
  onDone: () => void;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [mode, setMode] = useState<Mode>("create");
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const shares = Number(amount);
  const valid = Number.isFinite(shares) && shares > 0;
  const rawShares = valid ? BigInt(Math.round(shares * ONE_SHARE)) : 0n;

  const rows = basket.components.map((component) => {
    const symbol = symbolForWriteMint(component.mint) ?? "?";
    const target = mulDivCeil(component.unitsPerShare, rawShares, ONE);
    // The program grosses up a deposit for a live TransferFeeConfig, same as
    // gross_for_transfer_fee in lib.rs, so a PreStocks component costs
    // slightly more than the recipe alone would suggest. Estimated from the
    // fee this component quoted at seeding time, not a live read, so it can
    // undershoot by a few raw units if the fee has since changed on chain.
    const feeBps = BY_SYMBOL_PRESTOCKS[symbol]?.transferFeeBps ?? 0;
    const need = feeBps > 0 ? mulDivCeil(target, 10_000n, 10_000n - BigInt(feeBps)) : target;
    const back = mulDivFloor(component.unitsPerShare, rawShares, ONE);
    const have = balances.raw.get(component.mint) ?? 0n;
    return {
      mint: component.mint,
      symbol,
      decimals: component.decimals,
      need,
      back,
      have,
      grossedUp: feeBps > 0,
      short: have < need,
    };
  });

  const feeShares = (rawShares * BigInt(basket.creatorFeeBps)) / 10_000n;
  const netShares = rawShares - feeShares;
  const shortSymbols = connected
    ? rows.filter((r) => r.short).map((r) => r.symbol)
    : [];
  const enoughShares = shareBalance >= rawShares;

  const blocked =
    !connected ||
    !valid ||
    (mode === "create" ? shortSymbols.length > 0 : !enoughShares);

  async function submit() {
    if (!publicKey || !valid) return;
    setBusy(true);
    setError(null);
    setSignature(null);
    try {
      const steps =
        mode === "create"
          ? await buildMintShares({
              connection,
              basket,
              depositor: publicKey,
              shares: rawShares,
            })
          : await buildRedeemShares({
              connection,
              basket,
              owner: publicKey,
              shares: rawShares,
            });
      const signatures = await sendSteps(
        steps,
        connection,
        sendTransaction,
        (done, total) => setStep({ done, total }),
      );
      setSignature(signatures[signatures.length - 1] ?? null);
      onDone();
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <div className="border border-rule bg-ground-raised">
      <div className="grid grid-cols-2">
        {(["create", "redeem"] as Mode[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setMode(tab);
              setSignature(null);
              setError(null);
            }}
            aria-pressed={mode === tab}
            className="border-b px-4 py-4 text-sm transition-colors"
            style={{
              borderColor: mode === tab ? "var(--color-gold)" : "var(--color-rule)",
              color:
                mode === tab ? "var(--color-ivory)" : "var(--color-ivory-faint)",
              background:
                mode === tab ? "var(--color-ground-high)" : "transparent",
            }}
          >
            {tab === "create" ? "Create shares" : "Redeem shares"}
          </button>
        ))}
      </div>

      <div className="p-6">
        <label className="block">
          <span className="text-xs text-ivory-faint">
            {mode === "create" ? "Shares to create" : "Shares to redeem"}
          </span>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.000001"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="tnum display w-full border border-rule bg-ground px-3 py-3 text-xl text-ivory outline-none focus-visible:border-gold"
            />
            {mode === "redeem" && shareBalance > 0n && (
              <button
                type="button"
                onClick={() =>
                  setAmount((Number(shareBalance) / ONE_SHARE).toString())
                }
                className="shrink-0 border border-rule px-3 py-3 text-xs text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
              >
                All
              </button>
            )}
          </div>
        </label>

        <p className="tnum mt-2 text-xs text-ivory-faint">
          You hold {quantity(Number(shareBalance) / ONE_SHARE, 6)}{" "}
          {basket.symbol}
          {navPerShare != null && valid
            ? ` · about ${money(navPerShare * shares)} of components`
            : ""}
        </p>

        <div className="mt-6 border-t border-rule pt-5">
          <p className="text-xs text-ivory-faint">
            {mode === "create"
              ? "You hand the vault"
              : "The vault hands you back"}
          </p>
          <ul className="mt-3 space-y-2.5">
            {rows.map((row) => {
              const value = mode === "create" ? row.need : row.back;
              return (
                <li
                  key={row.mint}
                  className="tnum flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-ivory-dim">
                    {row.symbol.replace(/x$/, "")}
                    {mode === "create" && row.grossedUp && (
                      <span
                        className="ml-1.5 text-xs text-ivory-faint"
                        title="PreStocks charges a transfer fee; the program grosses up the deposit so the vault still nets the recipe amount."
                      >
                        +fee
                      </span>
                    )}
                  </span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-ivory">
                      {quantity(Number(value) / 10 ** row.decimals, 6)}
                    </span>
                    {mode === "create" && connected && (
                      <span
                        className="text-xs"
                        style={{
                          color: row.short
                            ? "var(--color-loss)"
                            : "var(--color-ivory-faint)",
                        }}
                      >
                        have {quantity(Number(row.have) / 10 ** row.decimals, 4)}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {mode === "create" && basket.creatorFeeBps > 0 && (
          <p className="tnum mt-5 border-t border-rule pt-5 text-xs leading-relaxed text-ivory-faint">
            You receive {quantity(Number(netShares) / ONE_SHARE, 6)}{" "}
            {basket.symbol}. The creator receives{" "}
            {quantity(Number(feeShares) / ONE_SHARE, 6)}, which is{" "}
            {percent(basket.creatorFeeBps / 100)} of the shares created. The fee
            never comes out of the vault, so backing per share is unchanged.
          </p>
        )}

        {mode === "create" && shortSymbols.length > 0 && (
          <div className="mt-5 border border-rule bg-ground p-4">
            <p className="text-sm leading-relaxed text-ivory-dim">
              Short on {shortSymbols.map((s) => s.replace(/x$/, "")).join(", ")}.
            </p>
            <div className="mt-3">
              <FaucetButton
                symbols={shortSymbols}
                onDone={() => void balances.reload()}
              />
            </div>
          </div>
        )}

        {mode === "redeem" && !enoughShares && valid && (
          <p className="mt-5 text-sm leading-relaxed text-loss">
            {shareBalance === 0n
              ? `You hold no ${basket.symbol} to redeem.`
              : `You only hold ${quantity(
                  Number(shareBalance) / ONE_SHARE,
                  6,
                )} ${basket.symbol}.`}
          </p>
        )}

        <button
          type="button"
          disabled={blocked || busy}
          onClick={submit}
          className="mt-6 w-full border border-gold bg-gold px-5 py-3.5 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e] disabled:cursor-not-allowed disabled:border-rule disabled:bg-transparent disabled:text-ivory-faint"
        >
          {busy
            ? /* A basket with many components needs a second signature, so say
                 which one the wallet is asking about rather than hanging. */
              (step && step.total > 1
                ? `${mode === "create" ? "Creating" : "Redeeming"} · ${Math.min(
                    step.done + 1,
                    step.total,
                  )} of ${step.total}`
                : mode === "create"
                  ? "Creating…"
                  : "Redeeming…")
            : !connected
              ? "Connect a wallet"
              : mode === "create"
                ? `Create ${basket.symbol}`
                : `Redeem ${basket.symbol}`}
        </button>

        {error && (
          <p className="mt-4 border-l-2 border-loss pl-3 text-sm leading-relaxed text-loss">
            {error}
          </p>
        )}

        {signature && (
          <p className="mt-4 text-sm leading-relaxed text-gain">
            Done.{" "}
            <a
              href={explorerTx(signature)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-current underline-offset-4"
            >
              See the transaction
            </a>
          </p>
        )}

        <p className="mt-5 text-xs leading-relaxed text-ivory-faint">
          {mode === "create"
            ? "In kind, so no price is quoted and no oracle is trusted. Amounts round up in the vault's favour."
            : "In kind, so redemption always works, whatever the market thinks the basket is worth. Amounts round down in the vault's favour."}
        </p>
      </div>
    </div>
  );
}
