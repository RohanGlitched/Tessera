/**
 * Tessera runs on two clusters at once, on purpose.
 *
 * Every price, every premium, every dividend multiplier on screen is read from
 * Solana mainnet, because the twenty xStocks that Tessera composes only exist
 * there. Minting and redeeming run on the cluster in NEXT_PUBLIC_WRITE_CLUSTER,
 * against mock mints that mirror the mainnet ones extension for extension.
 *
 * The alternative — quoting made-up prices on devnet — would make every figure in
 * the product a lie. This way the only thing that is a stand-in is the settlement
 * layer, and it is a faithful one.
 */

export const MAINNET_RPC =
  process.env.NEXT_PUBLIC_MAINNET_RPC ?? "https://api.mainnet-beta.solana.com";

export type WriteCluster = "devnet" | "localnet";

export const WRITE_CLUSTER: WriteCluster =
  (process.env.NEXT_PUBLIC_WRITE_CLUSTER as WriteCluster) ?? "devnet";

export const WRITE_RPC =
  process.env.NEXT_PUBLIC_WRITE_RPC ??
  (WRITE_CLUSTER === "devnet"
    ? "https://api.devnet.solana.com"
    : "http://127.0.0.1:8899");

export const TESSERA_PROGRAM_ID =
  process.env.NEXT_PUBLIC_TESSERA_PROGRAM_ID ??
  "F8QLTZPe9mJuPgXCbccnU9G2kMSEE4inygdUw3QZbrQ";

/** Where a signature can be looked up, for the cluster it was signed on. */
export function explorerTx(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${WRITE_CLUSTER === "localnet" ? "custom" : WRITE_CLUSTER}`;
}

export function explorerAddress(address: string, mainnet = false): string {
  if (mainnet) return `https://explorer.solana.com/address/${address}`;
  return `https://explorer.solana.com/address/${address}?cluster=${WRITE_CLUSTER === "localnet" ? "custom" : WRITE_CLUSTER}`;
}

/** A share of a Tessera basket is always six decimals. Matches the program. */
export const SHARE_DECIMALS = 6;
export const ONE_SHARE = 1_000_000;
/** The program's hard ceiling on components per basket. Also the palette size. */
export const MAX_COMPONENTS = 8;
/** The program's hard ceiling on the creator fee. */
export const MAX_CREATOR_FEE_BPS = 100;
