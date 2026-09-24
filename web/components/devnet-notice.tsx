"use client";

import { useEffect, useState } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WRITE_CLUSTER } from "@/lib/config";

const ENOUGH_FOR_FEES = 0.01 * LAMPORTS_PER_SOL;

/**
 * Most wallets arrive set to mainnet, where this wallet's devnet SOL does not
 * exist, so every write would fail. Say so before the first signature, not after.
 */
export function DevnetNotice() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<{ owner: string; lamports: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!publicKey || WRITE_CLUSTER !== "devnet") return;
    let live = true;
    const owner = publicKey.toBase58();
    const read = () =>
      connection
        .getBalance(publicKey)
        .then((lamports) => live && setBalance({ owner, lamports }))
        .catch(() => {});
    read();
    const timer = setInterval(read, 15_000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [connection, publicKey]);

  if (
    !publicKey ||
    balance?.owner !== publicKey.toBase58() ||
    balance.lamports >= ENOUGH_FOR_FEES
  ) {
    return null;
  }

  async function copy() {
    await navigator.clipboard.writeText(publicKey!.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div role="status" className="border-b border-gold/30 bg-gold/[0.07]">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-3 text-sm sm:px-8 md:flex-row md:items-center md:gap-6">
        <p className="leading-relaxed text-ivory-dim md:flex-1">
          <span className="text-ivory">Tessera settles on devnet, and this wallet has no devnet SOL.</span>{" "}
          Switch your wallet&apos;s network to devnet (Phantom: Settings, Developer
          settings, Testnet mode), then get free SOL from the Solana faucet.
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            onClick={copy}
            className="border border-rule-bright px-4 py-2 text-xs text-ivory transition-colors hover:border-gold hover:text-gold"
          >
            {copied ? "Copied" : "Copy my address"}
          </button>
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noreferrer"
            className="border border-gold/60 px-4 py-2 text-xs text-gold transition-colors hover:border-gold hover:bg-gold/10"
          >
            Open faucet.solana.com
          </a>
        </div>
      </div>
    </div>
  );
}
