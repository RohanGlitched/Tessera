"use client";

import { useEffect, useState } from "react";
import type { History } from "./history";

/**
 * The price history, fetched once per page load and shared by every chart on
 * it. A module-level promise rather than a context, so a card deep in a list
 * and a figure in the composer read the same bytes without wiring.
 */

let promise: Promise<History | null> | null = null;
let value: History | null = null;

function load(): Promise<History | null> {
  if (!promise) {
    promise = fetch("/api/history")
      .then((res) => (res.ok ? (res.json() as Promise<History>) : null))
      .then((h) => {
        value = h;
        return h;
      })
      .catch(() => null);
  }
  return promise;
}

export function useHistory(): { history: History | null; loading: boolean } {
  const [history, setHistory] = useState<History | null>(value);
  const [loading, setLoading] = useState(value == null);

  useEffect(() => {
    let live = true;
    void load().then((h) => {
      if (!live) return;
      setHistory(h);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, []);

  return { history, loading };
}
