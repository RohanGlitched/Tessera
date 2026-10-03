import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getScaledUiAmountConfig, unpackMint } from "@solana/spl-token";
import { MAINNET_RPC } from "./config";

/**
 * Mainnet reads go through Solami's private RPC when a key is configured, and
 * fall back to the public endpoint when it is not. The key stays on the server.
 */
function mainnetRpc(): { url: string; via: "solami" | "public" } {
  const key = process.env.SOLAMI_API_KEY?.trim();
  return key
    ? { url: `https://rpc.solami.dev/solana?api-key=${encodeURIComponent(key)}`, via: "solami" }
    : { url: MAINNET_RPC, via: "public" };
}

export type MintState = {
  /** Raw supply over 10^decimals, before the multiplier. */
  supply: number;
  multiplier: number;
  nextMultiplier: number | null;
  /** ISO time the next multiplier takes effect, if one is scheduled. */
  nextMultiplierAt: string | null;
};

export type ChainRead = {
  slot: number;
  via: "solami" | "public";
  mints: Map<string, MintState>;
};

/**
 * Every mint in one round trip, straight from its account: the supply and the
 * Token-2022 ScaledUiAmount config that carries each dividend multiplier. These
 * are the numbers that value a basket, so they come from the chain rather than
 * from an aggregator's copy of it.
 */
export async function readMints(mints: string[]): Promise<ChainRead | null> {
  const { url, via } = mainnetRpc();
  const connection = new Connection(url, "confirmed");
  try {
    const keys = mints.map((m) => new PublicKey(m));
    const out = new Map<string, MintState>();
    let slot = 0;
    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      const { context, value } = await connection.getMultipleAccountsInfoAndContext(chunk);
      slot = Math.max(slot, context.slot);
      value.forEach((account, j) => {
        if (!account || !account.owner.equals(TOKEN_2022_PROGRAM_ID)) return;
        const mint = unpackMint(chunk[j], account, TOKEN_2022_PROGRAM_ID);
        const scaled = getScaledUiAmountConfig(mint);
        const at = scaled ? Number(scaled.newMultiplierEffectiveTimestamp) * 1000 : 0;
        // A scheduled step switches on by itself once its time has passed.
        const stepped = scaled != null && at > 0 && scaled.newMultiplier !== scaled.multiplier;
        const pending = stepped && at > Date.now();
        out.set(chunk[j].toBase58(), {
          supply: Number(mint.supply) / 10 ** mint.decimals,
          multiplier: stepped && !pending ? scaled.newMultiplier : (scaled?.multiplier ?? 1),
          nextMultiplier: pending ? scaled.newMultiplier : null,
          nextMultiplierAt: pending ? new Date(at).toISOString() : null,
        });
      });
    }
    return { slot, via, mints: out };
  } catch {
    return null;
  }
}
