"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { FEATURED_DBC, readDbcState, type DbcState } from "@/lib/dbc";
import { explorerAddress, explorerTx } from "@/lib/config";
import { count, percent, quantity } from "@/lib/format";
import { useMeasure } from "@/lib/use-measure";
import { ConnectButton } from "./connect-button";

const AMOUNTS = [0.01, 0.05, 0.1];

function explainBuy(error: unknown): string {
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
  return raw.split("\n")[0] || "The buy failed.";
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
          and graduates into a permanent Meteora pool at twenty times it.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ivory-faint">
          This one stands in front of the Frontier Labs basket. Buy a little and the
          dot moves: every figure here is read from the pool account on each
          load.
        </p>
      </div>
      <LaunchCard />
    </div>
  );
}

/** The live curve and a buy, for the featured pool. */
export function LaunchCard({ onBasketPage = false }: { onBasketPage?: boolean }) {
  const [basketAddress, info] = FEATURED_DBC;
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const [state, setState] = useState<DbcState | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [held, setHeld] = useState<number | null>(null);
  const [amount, setAmount] = useState(AMOUNTS[1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await readDbcState(connection, info));
      setReadError(null);
      if (!publicKey) {
        setHeld(null);
        return;
      }
      const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: new PublicKey(info.baseMint),
      });
      setHeld(
        accounts.value.reduce(
          (sum, a) => sum + (a.account.data.parsed.info.tokenAmount.uiAmount ?? 0),
          0,
        ),
      );
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "The pool could not be read.");
    }
  }, [connection, info, publicKey]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function buy() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    setSignature(null);
    try {
      // Loaded on the click, so the SDK and its IDL stay off the page load.
      const [{ DynamicBondingCurveClient, getCurrentPoint }, { BN }] = await Promise.all([
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

      const amountIn = new BN(Math.round(amount * 1e9));
      const quote = client.pool.swapQuote({
        virtualPool,
        config,
        swapBaseForQuote: false,
        amountIn,
        slippageBps: 100,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint: await getCurrentPoint(connection, config.activationType),
      });
      const transaction = await client.pool.swap({
        owner: publicKey,
        pool,
        amountIn,
        minimumAmountOut: quote.minimumAmountOut,
        swapBaseForQuote: false,
        referralTokenAccount: null,
      });
      const sig = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(sig, "confirmed");
      setSignature(sig);
      await load();
    } catch (err) {
      setError(explainBuy(err));
    } finally {
      setBusy(false);
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
          <span className="size-1.5 rounded-full bg-gain" aria-hidden />
          {state?.migrated ? "Graduated" : "Trading live"}
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
          value={state ? `${count(Math.round(state.graduationCap))} SOL` : "—"}
          note="20 × NAV, liquidity locked"
        />
      </dl>

      <div className="px-6 py-5">
        {connected ? (
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
              disabled={busy || !state || state.migrated}
              className="border border-gold bg-gold px-5 py-2.5 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e] disabled:opacity-50"
            >
              {busy ? "Buying…" : `Buy ${info.baseSymbol}`}
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
        {signature && (
          <p className="mt-4 text-sm text-ivory-dim">
            Bought.{" "}
            <a
              href={explorerTx(signature)}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-rule-bright underline-offset-4 hover:text-ivory"
            >
              View the swap
            </a>
          </p>
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
 * Market cap against SOL raised. Liquidity is constant along the one segment
 * this curve has, so SOL raised is linear in the square root of price and the
 * shape is an exact parabola, not an illustration.
 */
function Curve({ state, error }: { state: DbcState | null; error: string | null }) {
  const { ref, width } = useMeasure<HTMLDivElement>();
  return (
    <div ref={ref} className="h-[220px]">
      {state && width > 0 ? (
        <CurvePlot state={state} W={width} />
      ) : (
        <p className="flex h-full items-center justify-center px-6 text-center text-xs text-ivory-faint">
          {error ?? "Reading the pool"}
        </p>
      )}
    </div>
  );
}

function CurvePlot({ state, W }: { state: DbcState; W: number }) {
  const a = Math.sqrt(state.openCap);
  const b = Math.sqrt(state.graduationCap);
  const capAt = (t: number) => (a + (b - a) * t) ** 2;
  const x = (t: number) => PAD.left + t * (W - PAD.left - PAD.right);
  const y = (cap: number) => H - PAD.bottom - (cap / state.graduationCap) * (H - PAD.top - PAD.bottom);
  const progress = Math.min(1, state.raised / state.threshold);

  const line = (from: number, to: number) =>
    Array.from({ length: 61 }, (_, i) => from + ((to - from) * i) / 60)
      .map((t, i) => `${i === 0 ? "M" : "L"}${x(t).toFixed(1)},${y(capAt(t)).toFixed(1)}`)
      .join(" ");
  const base = H - PAD.bottom;
  const filled = `${line(0, progress)} L${x(progress).toFixed(1)},${base} L${x(0)},${base} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="block"
      role="img"
      aria-label={`Bonding curve: ${quantity(state.raised, 4)} of ${quantity(state.threshold, 2)} SOL raised, market cap ${quantity(state.cap, 2)} SOL`}
    >
      <line x1={x(0)} x2={x(1)} y1={base} y2={base} stroke="var(--color-rule)" />
      <path d={line(0, 1)} fill="none" stroke="var(--color-rule-bright)" strokeWidth="2" strokeDasharray="4 4" />
      <path d={filled} fill="var(--color-gold)" fillOpacity="0.18" />
      <path d={line(0, progress)} fill="none" stroke="var(--color-gold)" strokeWidth="2.5" />
      <line x1={x(progress)} x2={x(progress)} y1={base} y2={y(state.cap)} stroke="var(--color-gold)" strokeDasharray="2 3" />
      <circle cx={x(progress)} cy={y(state.cap)} r="6" fill="var(--color-gold)" stroke="var(--color-ground-raised)" strokeWidth="2" />
      <text x={x(progress) + 12} y={y(state.cap) - 10} fill="var(--color-ivory)" fontSize="13">
        now · {quantity(state.raised, 4)} SOL in
      </text>
      <circle cx={x(1)} cy={y(state.graduationCap)} r="4" fill="none" stroke="var(--color-ivory-dim)" strokeWidth="1.5" />
      <text x={x(1) - 10} y={y(state.graduationCap) + 4} fill="var(--color-ivory-dim)" fontSize="12" textAnchor="end">
        graduates to Meteora DAMM v2
      </text>
      <text x={x(0)} y={H - 8} fill="var(--color-ivory-faint)" fontSize="12">
        0 SOL raised
      </text>
      <text x={x(1)} y={H - 8} fill="var(--color-ivory-faint)" fontSize="12" textAnchor="end">
        {quantity(state.threshold, 2)} SOL
      </text>
    </svg>
  );
}
