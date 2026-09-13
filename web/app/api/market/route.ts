import { fetchMarket } from "@/lib/market";

/**
 * The market snapshot, proxied server-side.
 *
 * Two reasons it is not fetched straight from the browser: the upstream is rate
 * limited per IP and a room full of judges is one IP, and a proxy lets one
 * response serve every open tab. Ten seconds of shared cache is well inside the
 * time it takes a price to move meaningfully, and stale-while-revalidate means
 * nobody ever waits on the upstream.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await fetchMarket();
  return Response.json(snapshot, {
    headers: {
      "cache-control": "public, s-maxage=10, stale-while-revalidate=50",
    },
  });
}
