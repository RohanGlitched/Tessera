/**
 * Joining the two clusters.
 *
 * A ticker has two mints: the real one on mainnet, which every price and every
 * dividend multiplier is read from, and its mirror on the write cluster, which
 * mint and redeem transactions actually touch. Nothing else in the app should
 * have to know which is which — it asks here.
 */

import { MIRROR, MIRROR_CLUSTER, type MirrorEntry } from "./mirror.generated";
import { PRESTOCKS_MIRROR } from "./mirror-prestocks.generated";
import { XSTOCKS, BY_SYMBOL, type XStock } from "./universe";
import { PRESTOCKS, BY_SYMBOL_PRESTOCKS, asXStock } from "./prestocks";

export { MIRROR_CLUSTER };
export type { MirrorEntry };

/** The mint a transaction should name, for a ticker. */
export function writeMint(symbol: string): string | null {
  return MIRROR[symbol]?.writeMint ?? PRESTOCKS_MIRROR[symbol]?.writeMint ?? null;
}

/** The mainnet mint a price should be read from, for a ticker. */
export function priceMint(symbol: string): string | null {
  return BY_SYMBOL[symbol]?.mint ?? BY_SYMBOL_PRESTOCKS[symbol]?.mint ?? null;
}

const BY_WRITE_MINT = new Map<string, string>([
  ...Object.entries(MIRROR).map(([symbol, entry]) => [entry.writeMint, symbol] as const),
  ...Object.entries(PRESTOCKS_MIRROR).map(
    ([symbol, entry]) => [entry.writeMint, symbol] as const,
  ),
]);

/** Which ticker a write-cluster mint belongs to. */
export function symbolForWriteMint(mint: string): string | null {
  return BY_WRITE_MINT.get(mint) ?? null;
}

export function stockForWriteMint(mint: string): XStock | null {
  const symbol = symbolForWriteMint(mint);
  if (!symbol) return null;
  if (BY_SYMBOL[symbol]) return BY_SYMBOL[symbol];
  const p = BY_SYMBOL_PRESTOCKS[symbol];
  return p ? asXStock(p) : null;
}

/** Tickers that have a mirror and can therefore be composed today. */
export const COMPOSABLE: XStock[] = [
  ...XSTOCKS.filter((s) => MIRROR[s.symbol]),
  ...PRESTOCKS.filter((s) => PRESTOCKS_MIRROR[s.symbol]).map(asXStock),
];

/** How much of each component the faucet hands out, in whole tokens. */
export const FAUCET_TOKENS_PER_CLAIM = 25;
