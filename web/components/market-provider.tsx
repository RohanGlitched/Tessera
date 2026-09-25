"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { MarketSnapshot, Quote } from "@/lib/market";

type MarketContextValue = {
  snapshot: MarketSnapshot | null;
  /** True only for the first load. A refresh in flight does not blank the screen. */
  loading: boolean;
  error: string | null;
  /** Unix seconds of the last successful read. */
  updatedAt: number | null;
  refresh: () => void;
  byMint: (mint: string) => Quote | undefined;
  bySymbol: (symbol: string) => Quote | undefined;
};

const MarketContext = createContext<MarketContextValue | null>(null);

const POLL_MS = 15_000;

/**
 * One market read, shared by every component on the page.
 *
 * Prices refresh on a timer, but only while the tab is visible: a background tab
 * polling an upstream nobody is looking at is just rate limit spent for nothing.
 * A failed refresh keeps the last good snapshot on screen and says so, because a
 * price that is thirty seconds old is far more useful than an empty cell.
 */
export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/market", { cache: "no-store" });
      if (!res.ok) throw new Error(`market read failed (${res.status})`);
      const data = (await res.json()) as MarketSnapshot;
      if (!data.quotes?.length) throw new Error("market read came back empty");
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "market read failed");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => void load(), POLL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void load();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const byMint = useCallback(
    (mint: string) => snapshot?.quotes.find((q) => q.mint === mint),
    [snapshot],
  );
  const bySymbol = useCallback(
    (symbol: string) => snapshot?.quotes.find((q) => q.symbol === symbol),
    [snapshot],
  );

  return (
    <MarketContext.Provider
      value={{
        snapshot,
        loading,
        error,
        updatedAt: snapshot?.fetchedAt ?? null,
        refresh: () => void load(),
        byMint,
        bySymbol,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket(): MarketContextValue {
  const ctx = useContext(MarketContext);
  if (!ctx) throw new Error("useMarket must be used inside MarketProvider");
  return ctx;
}
