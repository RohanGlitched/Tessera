/**
 * Meteora Dynamic Bonding Curve pools opened for a Tessera basket.
 *
 * A pool here is a separate token from the basket's own share — a front-market,
 * not a redemption right — opened by scripts/dbc-launch.mjs on the real DBC
 * program (dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN, same address on devnet
 * and mainnet). Written by hand because there is one of these, not twenty.
 */

import { Connection, PublicKey } from "@solana/web3.js";

export type DbcPoolInfo = {
  pool: string;
  config: string;
  baseMint: string;
  baseSymbol: string;
  baseName: string;
  quoteSymbol: string;
  baseDecimals: number;
  supply: number;
};

export const DBC_POOLS: Record<string, DbcPoolInfo> = {
  "5Z8XUzGVJjcYPxPZ6Hfxx8uJRNKibFcmZd7yStuSPr1p": {
    pool: "DAZdm2LmiDCfVQaAuVkKdK5Qa1hWmkV1fNK6SzGikqFU",
    config: "DqxXAWXXqurghukxhZmtridTj1nBobJSHG5aSBeYD5nu",
    baseMint: "4A1rSrw6PoAVHg1AUfYfxs9nQzbF2ptY86caUuoJsULV",
    baseSymbol: "FRNTRA",
    baseName: "Frontier Labs, early access",
    quoteSymbol: "SOL",
    baseDecimals: 6,
    supply: 1_000_000_000,
  },
};

/** The one pool the home page shows. */
export const FEATURED_DBC = Object.entries(DBC_POOLS)[0];

export function dbcPoolFor(basketAddress: string): DbcPoolInfo | null {
  return DBC_POOLS[basketAddress] ?? null;
}

export type DbcState = {
  /** SOL in the curve, and the amount at which it graduates. */
  raised: number;
  threshold: number;
  /** Market caps in SOL at the open, now, and at graduation. */
  openCap: number;
  cap: number;
  graduationCap: number;
  migrated: boolean;
};

const Q64 = 2 ** 64;

function u64(data: Uint8Array, at: number): bigint {
  return new DataView(data.buffer, data.byteOffset + at, 8).getBigUint64(0, true);
}

function u128(data: Uint8Array, at: number): bigint {
  return u64(data, at) | (u64(data, at + 8) << 64n);
}

/**
 * Read a pool and its config straight from their accounts.
 *
 * Offsets are the DBC program's VirtualPool and PoolConfig layouts. Pulling in
 * the SDK for five numbers would put its IDL on every page load.
 */
export async function readDbcState(
  connection: Connection,
  info: DbcPoolInfo,
): Promise<DbcState> {
  const [pool, config] = await connection.getMultipleAccountsInfo([
    new PublicKey(info.pool),
    new PublicKey(info.config),
  ]);
  if (!pool || !config) throw new Error("The pool could not be read.");

  const cap = (sqrtPrice: bigint) =>
    (Number(sqrtPrice) / Q64) ** 2 * 10 ** (info.baseDecimals - 9) * info.supply;

  return {
    raised: Number(u64(pool.data, 240)) / 1e9,
    threshold: Number(u64(config.data, 264)) / 1e9,
    openCap: cap(u128(config.data, 392)),
    cap: cap(u128(pool.data, 280)),
    graduationCap: cap(u128(config.data, 280)),
    migrated: pool.data[305] === 1,
  };
}
