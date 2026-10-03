"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  FEATURED_DBC,
  dammV2PoolAddress,
  launchFor,
  readDbcState,
  type DbcPoolInfo,
  type DbcState,
} from "@/lib/dbc";
import { explorerAddress, explorerTx } from "@/lib/config";
import { count, money, percent, quantity } from "@/lib/format";
import { useMeasure } from "@/lib/use-measure";
import { ConnectButton } from "./connect-button";

const AMOUNTS = [0.01, 0.05, 0.1];

function explain(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/User rejected|rejected the request|declined/i.test(raw)) {
    return "You cancelled the transaction.";
  }
  if (/insufficient lamports|insufficient funds|no record of a prior credit/i.test(raw)) {
    return "Not enough SOL on devnet. Switch the wallet to devnet, or get some at faucet.solana.com.";
  }
  if (/slippage/i.test(raw)) return "The price moved while you were signing. Try again.";
  if (/block height exceeded/i.test(raw)) {
    return "The transaction expired before it was signed. Try again.";
  }
  if (/already in use/i.test(raw)) return "This basket's launch market is already open.";
  return raw.split("\n")[0] || fallback;
}

/** Where a basket's launch lives, and its live state once opened. */
function useLaunch(basket: { address: string; name: string; symbol: string }) {
  const { connection } = useConnection();
  const [info, setInfo] = useState<DbcPoolInfo | null>(null);
  const [state, setState] = useState<DbcState | null | undefined>(undefined);
  const [readError, setReadError] = useState<string | null>(null);
  const { address, name, symbol } = basket;

  const load = useCallback(async () => {
    try {
      const next = await launchFor({ address, name, symbol });
      setInfo(next);
      setState(await readDbcState(connection, next));
      setReadError(null);
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "The pool could not be read.");
    }
  }, [connection, address, name, symbol]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return { info, state, readError, reload: load };
}

export function LaunchMarket() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
      <div className="max-w-[40ch] self-center">
        <p className="text-xs tracking-wide text-gold">Meteora Dynamic Bonding Curve</p>
        <h2 className="display mt-3 text-title text-ivory">
          A basket can trade before anyone has built a share.
        </h2>
        <p className="mt-5 text-base leading-relaxed text-ivory-dim">
          A new basket starts with no shares, and nobody wants to be first to
          assemble every component. So a bonding curve opens in front of it: a
          token priced along a curve that starts at half the basket&rsquo;s NAV
          and graduates into a permanent Meteora pool at twenty times it. The
          curve opens on a shelf, so early money gets nearly the same price, and
          steepens only once a basket has proven it has takers.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ivory-faint">
          Any basket&rsquo;s creator can open one from the basket page in a single
          signature, and earns half of its trading fees. This one stands in front
          of the Frontier Labs basket: buy a little and the dot moves, because
          every figure here is read from the pool account on each load.
        </p>
      </div>
      <FeaturedLaunch />
    </div>
  );
}

/** The featured launch, on its own: the home page and How it works both show it. */
export function FeaturedLaunch() {
  const [address, info] = FEATURED_DBC;
  const launch = useLaunch({ address, name: info.baseName, symbol: info.baseSymbol });
  if (!launch.info) return <LaunchSkeleton />;
  return (
    <LaunchCard
      basketAddress={address}
      info={launch.info}
      state={launch.state ?? null}
      readError={launch.readError}
      onTraded={launch.reload}
    />
  );
}

function LaunchSkeleton() {
  return <div className="h-[420px] animate-pulse border border-rule bg-ground-raised" />;
}

/**
 * A basket's launch market on its own page: the live curve once it is open, the
 * button that opens it for the basket's creator, and nothing for anyone else.
 */
export function BasketLaunch({
  basket,
  navUsd,
}: {
  basket: { address: string; name: string; symbol: string; creator: string };
  navUsd: number | null;
}) {
  const launch = useLaunch(basket);
  const { publicKey } = useWallet();
  const isCreator = publicKey?.toBase58() === basket.creator;
  const ready = launch.info != null && launch.state !== undefined;

  // The section renders after a read, so the browser's own jump to #launch has
  // already happened by the time there is anything to jump to.
  useEffect(() => {
    if (ready && window.location.hash === "#launch") {
      document.getElementById("launch")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ready, isCreator]);

  if (!launch.info || launch.state === undefined) return null;
  if (launch.state) {
    return (
      <section id="launch" className="mt-12 scroll-mt-24">
        <div className="mb-5 max-w-[62ch]">
          <p className="text-xs tracking-wide text-gold">Meteora Dynamic Bonding Curve</p>
          <h2 className="display mt-2 text-xl text-ivory">{basket.symbol} has a launch market</h2>
          <p className="mt-2 text-sm leading-relaxed text-ivory-dim">
            {launch.info.baseSymbol} is a separate token priced off {basket.symbol}&rsquo;s NAV: the
            curve opened at half of it and graduates at twenty times, into a Meteora DAMM v2 pool
            with its liquidity locked. It is a bet on the basket, not a redemption right into it.
          </p>
        </div>
        <LaunchCard
          basketAddress={basket.address}
          info={launch.info}
          state={launch.state}
          readError={launch.readError}
          onTraded={launch.reload}
          onBasketPage
        />
      </section>
    );
  }
  if (!isCreator) return null;
  return (
    <section id="launch" className="mt-12 scroll-mt-24">
      <OpenLaunch basket={basket} info={launch.info} navUsd={navUsd} onOpened={launch.reload} />
    </section>
  );
}

function OpenLaunch({
  basket,
  info,
  navUsd,
  onOpened,
}: {
  basket: { address: string; name: string; symbol: string };
  info: DbcPoolInfo;
  navUsd: number | null;
  onOpened: () => Promise<void>;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void import("@/lib/launch")
      .then(({ solUsd }) => solUsd())
      .then((price) => live && setSol(price))
      .catch(() => live && setError("Could not read a live SOL price. Reload to try again."));
    return () => {
      live = false;
    };
  }, []);

  const navSol = navUsd != null && sol ? navUsd / sol : null;

  async function open() {
    if (!publicKey || navSol == null) return;
    setBusy(true);
    setError(null);
    try {
      const { buildLaunch } = await import("@/lib/launch");
      const transaction = await buildLaunch({ connection, creator: publicKey, basket, navSol });
      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(sig, "confirmed");
      await onOpened();
    } catch (err) {
      setError(explain(err, "The launch could not be opened."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-gold/40 bg-ground-raised">
      <div className="px-6 py-6">
        <p className="text-xs tracking-wide text-gold">Meteora Dynamic Bonding Curve</p>
        <h2 className="display mt-2 text-xl text-ivory">Open a launch market for {basket.symbol}</h2>
        <p className="mt-3 max-w-[62ch] text-sm leading-relaxed text-ivory-dim">
          Give people a way in before anyone has assembled a share. {info.baseSymbol} trades on
          a Meteora curve priced from this basket&rsquo;s own value: it opens at half the NAV and
          graduates into a Meteora DAMM v2 pool, liquidity locked for good, at twenty times it.
          The curve starts with a shelf, so the first fifth of the money in moves the price
          less than a quarter: nobody is punished for being early. You earn half of every
          trading fee on the curve.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-px border-y border-rule bg-rule sm:grid-cols-3">
        <Fact
          label="Opens at"
          value={navSol != null ? `${quantity(navSol / 2, 2)} SOL` : "—"}
          note={navUsd != null ? `½ × NAV of ${money(navUsd)}` : "reading NAV"}
        />
        <Fact
          label="Graduates at"
          value={navSol != null ? `${quantity(navSol * 20, 2)} SOL` : "—"}
          note="20 × NAV, into Meteora DAMM v2"
        />
        <Fact label="Your share of fees" value="50%" note="4% at the open, 1% within the hour" />
      </dl>
      <div className="px-6 py-5">
        <button
          type="button"
          onClick={open}
          disabled={busy || navSol == null}
          className="border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e] disabled:opacity-50"
        >
          {busy ? "Opening the market…" : "Open the launch market"}
        </button>
        {error && (
          <p className="mt-4 border-l-2 border-loss pl-3 text-sm text-loss">{error}</p>
        )}
        <p className="mt-4 text-xs leading-relaxed text-ivory-faint">
          One signature and about 0.02 SOL of rent. The token is fixed once it exists: no mint
          authority, no edits, and one launch per basket.
        </p>
      </div>
    </div>
  );
}

/** The live curve and a buy, for one launch. */
export function LaunchCard({
  basketAddress,
  info,
  state,
  readError,
  onTraded,
  onBasketPage = false,
}: {
  basketAddress: string;
  info: DbcPoolInfo;
  state: DbcState | null;
  readError: string | null;
  onTraded: () => Promise<void>;
  onBasketPage?: boolean;
}) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [held, setHeld] = useState<number | null>(null);
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const [busy, setBusy] = useState<"buy" | "claim" | "graduate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ what: string; signature: string } | null>(null);
  const isCreator = publicKey != null && state?.creator === publicKey.toBase58();

  const loadHeld = useCallback(async () => {
    if (!publicKey) {
      setHeld(null);
      return;
    }
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(info.baseMint),
      });
      setHeld(
        accounts.value.reduce(
          (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
          0,
        ),
      );
    } catch {
      setHeld(null);
    }
  }, [connection, info.baseMint, publicKey]);

  useEffect(() => {
    void Promise.resolve().then(loadHeld);
  }, [loadHeld]);

  async function buy() {
    if (!publicKey) return;
    setBusy("buy");
    setError(null);
    setDone(null);
    try {
      // Loaded on the click, so the SDK and its IDL stay off the page load.
      const [{ DynamicBondingCurveClient, getCurrentPoint, SwapMode }, { BN }] =
        await Promise.all([
          import("@meteora-ag/dynamic-bonding-curve-sdk"),
          import("@coral-xyz/anchor"),
        ]);
      const client = new DynamicBondingCurveClient(connection, "confirmed");
      const pool = new PublicKey(info.pool);
      const [virtualPool, config] = await Promise.all([
        client.state.getPool(pool),
        client.state.getPoolConfig(info.config),
      ]);
      if (!virtualPool || !config) throw new Error("The pool could not be read.");

      // Partial fill: a buy bigger than what is left on the curve takes the rest
      // and refunds the difference, rather than failing at the last step.
      const amountIn = new BN(Math.round(amount * 1e9));
      const quote = client.pool.swapQuote2({
        virtualPool,
        config,
        swapBaseForQuote: false,
        swapMode: SwapMode.PartialFill,
        amountIn,
        slippageBps: 100,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint: await getCurrentPoint(connection, config.activationType),
      });
      const transaction = await client.pool.swap2({
        owner: publicKey,
        pool,
        swapMode: SwapMode.PartialFill,
        amountIn,
        minimumAmountOut: quote.minimumAmountOut ?? new BN(0),
        swapBaseForQuote: false,
        referralTokenAccount: null,
      });
      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setDone({ what: "Bought.", signature: sig });
      await Promise.all([onTraded(), loadHeld()]);
    } catch (err) {
      setError(explain(err, "The buy failed."));
    } finally {
      setBusy(null);
    }
  }

  async function graduate() {
    if (!publicKey) return;
    setBusy("graduate");
    setError(null);
    setDone(null);
    try {
      const { DynamicBondingCurveClient, DAMM_V2_MIGRATION_FEE_ADDRESS } = await import(
        "@meteora-ag/dynamic-bonding-curve-sdk"
      );
      const client = new DynamicBondingCurveClient(connection, "confirmed");
      const config = await client.state.getPoolConfig(info.config);
      if (!config) throw new Error("The pool's config could not be read.");
      const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
        await client.migration.migrateToDammV2({
          payer: publicKey,
          pool: new PublicKey(info.pool),
          dammConfig: DAMM_V2_MIGRATION_FEE_ADDRESS[config.migrationFeeOption],
        });
      const sig = await sendTransaction(transaction, connection, {
        signers: [firstPositionNftKeypair, secondPositionNftKeypair],
      });
      await connection.confirmTransaction(sig, "confirmed");
      setDone({ what: "Graduated into Meteora DAMM v2.", signature: sig });
      await onTraded();
    } catch (err) {
      setError(explain(err, "The graduation failed."));
    } finally {
      setBusy(null);
    }
  }

  async function claim() {
    if (!publicKey || !state) return;
    setBusy("claim");
    setError(null);
    setDone(null);
    try {
      const [{ DynamicBondingCurveClient }, { BN }] = await Promise.all([
        import("@meteora-ag/dynamic-bonding-curve-sdk"),
        import("@coral-xyz/anchor"),
      ]);
      const client = new DynamicBondingCurveClient(connection, "confirmed");
      const transaction = await client.creator.claimCreatorTradingFee({
        creator: publicKey,
        payer: publicKey,
        pool: new PublicKey(info.pool),
        maxBaseAmount: new BN("18446744073709551615"),
        maxQuoteAmount: new BN("18446744073709551615"),
      });
      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setDone({ what: `Claimed ${quantity(state.creatorFees, 6)} SOL.`, signature: sig });
      await onTraded();
    } catch (err) {
      setError(explain(err, "The claim failed."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border border-gold/40 bg-ground-raised">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-6 py-4">
        <p className="text-sm text-ivory">
          <span className="display text-lg">{info.baseSymbol}</span>{" "}
          <span className="text-ivory-dim">{info.baseName}</span>
        </p>
        <p className="flex items-center gap-2 text-xs text-ivory-faint">
          <span className={`size-1.5 rounded-full bg-gain ${state?.migrated ? "" : "live-dot"}`} aria-hidden />
          {state?.migrated
            ? "Graduated to Meteora DAMM v2"
            : state && state.raised >= state.threshold
              ? "Curve full"
              : "Trading live"}
        </p>
      </div>

      <Curve state={state} error={readError} />

      <dl className="grid grid-cols-3 gap-px border-y border-rule bg-rule">
        <Fact
          label="Opened at"
          value={state ? `${quantity(state.openCap, 2)} SOL` : "—"}
          note="½ × NAV"
        />
        <Fact
          label="Market cap now"
          value={state ? `${quantity(state.cap, 2)} SOL` : "—"}
          note={
            state
              ? `${percent((state.raised / state.threshold) * 100, 2)} to graduation`
              : "reading"
          }
        />
        <Fact
          label="Graduates at"
          value={state ? `${quantity(state.graduationCap, 2)} SOL` : "—"}
          note="20 × NAV, liquidity locked"
        />
      </dl>

      <div className="px-6 py-5">
        {state?.migrated ? (
          <p className="text-sm leading-relaxed text-ivory-dim">
            The curve filled and its liquidity moved into a Meteora DAMM v2 pool, locked for good.{" "}
            <a
              href={explorerAddress(dammV2PoolAddress(info.baseMint))}
              target="_blank"
              rel="noreferrer"
              className="text-ivory underline decoration-rule-bright underline-offset-4 hover:decoration-gold"
            >
              The DAMM v2 pool
            </a>
          </p>
        ) : connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="SOL to spend" className="flex">
              {AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={amount === value}
                  onClick={() => setAmount(value)}
                  className="tnum -ml-px border px-3 py-2.5 text-sm transition-colors first:ml-0"
                  style={{
                    borderColor:
                      amount === value ? "var(--color-gold)" : "var(--color-rule)",
                    color:
                      amount === value
                        ? "var(--color-ivory)"
                        : "var(--color-ivory-faint)",
                    position: amount === value ? "relative" : undefined,
                  }}
                >
                  {value} SOL
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={buy}
              disabled={busy != null || !state || state.migrated}
              className="border border-gold bg-gold px-5 py-2.5 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e] disabled:opacity-50"
            >
              {busy === "buy" ? "Buying…" : `Buy ${info.baseSymbol}`}
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <ConnectButton />
            <p className="text-xs text-ivory-faint">
              Connect a wallet to buy on the curve.
            </p>
          </div>
        )}

        {error && (
          <p className="mt-4 border-l-2 border-loss pl-3 text-sm text-loss">{error}</p>
        )}
        {done && (
          <p className="mt-4 text-sm text-ivory-dim">
            {done.what}{" "}
            <a
              href={explorerTx(done.signature)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-rule-bright underline-offset-4 hover:text-ivory"
            >
              View the transaction
            </a>
          </p>
        )}
        {state && !state.migrated && state.raised >= state.threshold && (
          <div className="mt-5 border border-gold/40 bg-gold/[0.06] p-4">
            <p className="text-sm leading-relaxed text-ivory-dim">
              <span className="text-ivory">The curve is full.</span> Anyone can move it into its
              Meteora DAMM v2 pool, where the liquidity is locked for good and trading carries on.
            </p>
            {connected && (
              <button
                type="button"
                onClick={graduate}
                disabled={busy != null}
                className="mt-3 border border-gold bg-gold px-4 py-2.5 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e] disabled:opacity-50"
              >
                {busy === "graduate" ? "Graduating…" : "Graduate to Meteora DAMM v2"}
              </button>
            )}
          </div>
        )}
        {isCreator && state && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4">
            <p className="tnum text-sm text-ivory-dim">
              You created this market. Fees owed to you:{" "}
              <span className="text-ivory">{quantity(state.creatorFees, 6)} SOL</span>
            </p>
            <button
              type="button"
              onClick={claim}
              disabled={busy != null || state.creatorFees <= 0}
              className="border border-rule-bright px-4 py-2 text-xs text-ivory transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:text-ivory-faint"
            >
              {busy === "claim" ? "Claiming…" : "Claim fees"}
            </button>
          </div>
        )}
        {held != null && held > 0 && (
          <p className="tnum mt-2 text-xs text-ivory-faint">
            You hold {count(Math.floor(held))} {info.baseSymbol}
          </p>
        )}

        <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ivory-faint">
          {!onBasketPage && (
            <Link
              href={`/basket/${basketAddress}`}
              className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
            >
              The basket behind it
            </Link>
          )}
          <a
            href={explorerAddress(info.pool)}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
          >
            Pool on Explorer
          </a>
        </p>
      </div>
    </div>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-ground-raised px-4 py-4 sm:px-6">
      <dt className="text-xs text-ivory-faint">{label}</dt>
      <dd className="tnum display mt-1 text-lg text-ivory">{value}</dd>
      <dd className="mt-1 text-xs text-ivory-faint">{note}</dd>
    </div>
  );
}

const H = 220;
const PAD = { top: 20, right: 16, bottom: 30, left: 16 };

/**
 * Market cap against SOL raised, drawn through the pool's own segments. Within
 * a segment liquidity is constant, so SOL raised is linear in the square root
 * of price and the piece between two points is an exact parabola.
 */
function Curve({ state, error }: { state: DbcState | null; error: string | null }) {
  const { ref: measure, width } = useMeasure<HTMLDivElement>();
  const el = useRef<HTMLDivElement | null>(null);
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      el.current = node;
      measure(node);
    },
    [measure],
  );
  // The chart usually sits below the fold, so the draw-in waits until it is seen.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setSeen(true);
    });
    observer.observe(el.current);
    return () => observer.disconnect();
  }, []);
  const progress = useTween(seen && state ? Math.min(1, state.raised / state.threshold) : 0);
  return (
    <div ref={ref} className="h-[220px]">
      {state && width > 0 ? (
        <CurvePlot state={state} W={width} progress={progress} />
      ) : (
        <p className="flex h-full items-center justify-center px-6 text-center text-xs text-ivory-faint">
          {error ?? "Reading the pool"}
        </p>
      )}
    </div>
  );
}

/**
 * Eases a value towards its target over 800ms, so the curve draws itself on
 * first view and the marker slides along it after a buy instead of jumping.
 */
function useTween(target: number): number {
  const [value, setValue] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      const eased = 1 - (1 - t) ** 3;
      const next = begin + (target - begin) * eased;
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

function CurvePlot({ state, W, progress }: { state: DbcState; W: number; progress: number }) {
  const x = (raised: number) => PAD.left + (raised / state.threshold) * (W - PAD.left - PAD.right);
  const y = (cap: number) => H - PAD.bottom - (cap / state.graduationCap) * (H - PAD.top - PAD.bottom);
  const base = H - PAD.bottom;

  // The curve as a function of SOL raised, following each segment's parabola.
  const capAt = (raised: number) => {
    const pts = state.shape;
    for (let i = 1; i < pts.length; i++) {
      if (raised <= pts[i].raised || i === pts.length - 1) {
        const [p, q] = [pts[i - 1], pts[i]];
        const t = q.raised > p.raised ? Math.min(1, (raised - p.raised) / (q.raised - p.raised)) : 1;
        return (Math.sqrt(p.cap) + (Math.sqrt(q.cap) - Math.sqrt(p.cap)) * t) ** 2;
      }
    }
    return pts[0]?.cap ?? 0;
  };
  const line = (from: number, to: number) =>
    Array.from({ length: 97 }, (_, i) => from + ((to - from) * i) / 96)
      .map((f, i) => `${i === 0 ? "M" : "L"}${x(f * state.threshold).toFixed(1)},${y(capAt(f * state.threshold)).toFixed(1)}`)
      .join(" ");
  // While the marker is moving it sits on the curve itself; at rest it sits at the pool's own price.
  const settled = Math.abs(progress - Math.min(1, state.raised / state.threshold)) < 0.0005;
  const raised = settled ? state.raised : progress * state.threshold;
  const cap = settled ? state.cap : capAt(raised);
  const filled = `${line(0, progress)} L${x(progress * state.threshold).toFixed(1)},${base} L${x(0)},${base} Z`;
  const px = x(Math.min(raised, state.threshold));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="block"
      role="img"
      aria-label={`Bonding curve: ${quantity(state.raised, 4)} of ${quantity(state.threshold, 2)} SOL raised, market cap ${quantity(state.cap, 2)} SOL`}
    >
      <line x1={x(0)} x2={x(state.threshold)} y1={base} y2={base} stroke="var(--color-rule)" />
      <path d={line(0, 1)} fill="none" stroke="var(--color-rule-bright)" strokeWidth="2" strokeDasharray="4 4" />
      <path d={filled} fill="var(--color-gold)" fillOpacity="0.18" />
      <path d={line(0, progress)} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
      <line x1={px} x2={px} y1={base} y2={y(cap)} stroke="var(--color-gold)" strokeDasharray="2 3" />
      <circle cx={px} cy={y(cap)} r="6" fill="var(--color-gold)" stroke="var(--color-ground-raised)" strokeWidth="2" />
      {/* Past the middle the label sits left of the dot, so it never runs off the edge. */}
      <text
        x={progress > 0.6 ? px - 12 : px + 12}
        y={progress > 0.6 ? y(cap) + 20 : y(cap) - 10}
        fill="var(--color-ivory)"
        fontSize="13"
        textAnchor={progress > 0.6 ? "end" : "start"}
      >
        {state.migrated ? "graduated" : "now"} · {quantity(raised, 4)} SOL in
      </text>
      <circle cx={x(state.threshold)} cy={y(state.graduationCap)} r="4" fill="none" stroke="var(--color-ivory-dim)" strokeWidth="1.5" />
      {progress < 0.85 && (
        <text x={x(state.threshold) - 10} y={y(state.graduationCap) + 4} fill="var(--color-ivory-dim)" fontSize="12" textAnchor="end">
          graduates to Meteora DAMM v2
        </text>
      )}
      <text x={x(0)} y={H - 8} fill="var(--color-ivory-faint)" fontSize="12">
        0 SOL raised
      </text>
      <text x={x(state.threshold)} y={H - 8} fill="var(--color-ivory-faint)" fontSize="12" textAnchor="end">
        {quantity(state.threshold, 2)} SOL
      </text>
    </svg>
  );
}
