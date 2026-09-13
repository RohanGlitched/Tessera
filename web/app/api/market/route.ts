import { fetchMarket } from "@/lib/market";

/**
 * The market snapshot, proxied server-side.
 *
 * Not fetched from the browser: the upstream rate limits per IP, and visitors
 * behind one NAT share that budget. Proxying lets a single response serve every
 * open tab. Ten seconds of shared cache sits well inside the time a price takes
 * to move meaningfully, and stale-while-revalidate means nobody waits on the
 * upstream.
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
