"use client";

import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { shortAddress } from "@/lib/format";
import { WRITE_CLUSTER } from "@/lib/config";

export function ConnectButton() {
  const { wallets, select, connect, connected, connecting, publicKey, disconnect, wallet } =
    useWallet();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onAway = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed,
  );

  /**
   * With autoConnect on, the provider connects a newly selected wallet itself,
   * after it has subscribed to the adapter. Connecting from here raced that
   * subscription: a wallet that already trusts the site connects without a
   * popup, its connect event was lost, and every later click was a no-op.
   */
  function pick(name: string) {
    setOpen(false);
    if (wallet?.adapter.name !== name) {
      select(name as never);
      return;
    }
    void connect().catch(() => {
      /* the wallet reports its own rejection */
    });
  }

  if (connected && publicKey) {
    return (
      <div className="relative" ref={root}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group flex items-center gap-2.5 border border-rule bg-ground-raised px-3.5 py-2 text-sm text-ivory transition-colors hover:border-rule-bright"
        >
          <span
            aria-hidden
            className="size-1.5 bg-gain"
            style={{ clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }}
          />
          <span className="tnum">{shortAddress(publicKey.toBase58())}</span>
        </button>
        {open && (
          <div className="absolute right-0 top-full z-50 mt-1.5 w-60 border border-rule bg-ground-raised p-1 shadow-2xl shadow-black/50">
            <div className="px-3 py-2.5 text-xs text-ivory-faint">
              {wallet?.adapter.name} on {WRITE_CLUSTER}
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(publicKey.toBase58());
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-ivory-dim transition-colors hover:bg-ground-high hover:text-ivory"
            >
              Copy address
            </button>
            <button
              type="button"
              onClick={() => {
                void disconnect();
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-ivory-dim transition-colors hover:bg-ground-high hover:text-ivory"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={connecting}
        className="border border-gold/60 bg-gold/10 px-4 py-2 text-sm text-ivory transition-colors hover:bg-gold/20 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 border border-rule bg-ground-raised p-1 shadow-2xl shadow-black/50">
          {installed.length === 0 ? (
            <p className="px-3 py-3 text-sm leading-relaxed text-ivory-dim">
              No Solana wallet detected in this browser.{" "}
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noreferrer"
                className="text-gold underline decoration-gold/40 underline-offset-2"
              >
                Install Phantom
              </a>{" "}
              and reload.
            </p>
          ) : (
            installed.map((w) => (
              <button
                key={w.adapter.name}
                type="button"
                onClick={() => pick(w.adapter.name)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-ivory-dim transition-colors hover:bg-ground-high hover:text-ivory"
              >
                {w.adapter.icon && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={w.adapter.icon} alt="" className="size-5" />
                )}
                {w.adapter.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
