"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { fetchBaskets, fetchBasket, type Basket } from "./tessera";

/** Every basket on the write cluster. */
export function useBaskets() {
  const { connection } = useConnection();
  const [baskets, setBaskets] = useState<Basket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBaskets(await fetchBaskets(connection));
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not read the program: ${err.message}`
          : "Could not read the program.",
      );
    }
  }, [connection]);

  useEffect(() => {
    void load();
  }, [load]);

  return { baskets, error, reload: load, loading: baskets == null && !error };
}

/** One basket, by address. */
export function useBasket(address: string | null) {
  const { connection } = useConnection();
  const [basket, setBasket] = useState<Basket | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    let key: PublicKey;
    try {
      key = new PublicKey(address);
    } catch {
      setState("missing");
      return;
    }
    try {
      const found = await fetchBasket(connection, key);
      if (!found) {
        setState("missing");
        return;
      }
      setBasket(found);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "read failed");
      setState("error");
    }
  }, [connection, address]);

  useEffect(() => {
    void load();
  }, [load]);

  return { basket, state, error, reload: load };
}
