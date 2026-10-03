import { UNIVERSE_MINTS, fetchMarket, withChainMultipliers } from "@/lib/market";
import { readMints } from "@/lib/mainnet";

/**
 * The market snapshot, proxied server-side.
 *
 * Not fetched from the browser: the upstream rate limits per IP, and visitors
 * behind one NAT share that budget. Proxying lets a single response serve every
 * open tab. Ten seconds of shared cache sits well inside the time a price takes
 * to move meaningfully, and stale-while-revalidate means nobody waits on the
 * upstream.
 *
 * Prices come from Jupiter; the dividend multipliers come from the mint
 * accounts themselves, read in one call through Solami's mainnet RPC.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [market, chain] = await Promise.all([fetchMarket(), readMints(UNIVERSE_MINTS)]);
  const snapshot = withChainMultipliers(market, chain);
  return Response.json(snapshot, {
    headers: {
      "cache-control": "public, s-maxage=10, stale-while-revalidate=50",
    },
  });
}
