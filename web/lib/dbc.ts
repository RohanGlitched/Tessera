/**
 * Meteora Dynamic Bonding Curve pools opened for a Tessera basket.
 *
 * A pool here is a separate token from the basket's own share — a front-market,
 * not a redemption right — opened by scripts/dbc-launch.mjs on the real DBC
 * program (dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN, same address on devnet
 * and mainnet). Written by hand because there is one of these, not twenty.
 */

export type DbcPoolInfo = {
  pool: string;
  config: string;
  baseMint: string;
  baseSymbol: string;
  baseName: string;
  quoteSymbol: string;
};

export const DBC_POOLS: Record<string, DbcPoolInfo> = {
  "5Z8XUzGVJjcYPxPZ6Hfxx8uJRNKibFcmZd7yStuSPr1p": {
    pool: "DAZdm2LmiDCfVQaAuVkKdK5Qa1hWmkV1fNK6SzGikqFU",
    config: "DqxXAWXXqurghukxhZmtridTj1nBobJSHG5aSBeYD5nu",
    baseMint: "4A1rSrw6PoAVHg1AUfYfxs9nQzbF2ptY86caUuoJsULV",
    baseSymbol: "FRNTRA",
    baseName: "Frontier Labs, early access",
    quoteSymbol: "SOL",
  },
};

export function dbcPoolFor(basketAddress: string): DbcPoolInfo | null {
  return DBC_POOLS[basketAddress] ?? null;
}
