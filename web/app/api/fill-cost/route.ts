import { quoteFill, type FillLegRequest } from "@/lib/fill-cost";
import { MAX_COMPONENTS } from "@/lib/config";

/**
 * Quote what it would cost to buy a whole recipe with USDC.
 *
 * Proxied for the same reason the market snapshot is: the routing endpoint limits
 * by IP, and a room full of judges is one IP. Unlike the snapshot this is a POST
 * with a body, so it is not cached by the CDN — it is only ever called when
 * somebody asks for it, one call per basket, not on page load.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { shares?: number; legs?: FillLegRequest[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const legs = body.legs;
  if (!Array.isArray(legs) || legs.length === 0) {
    return Response.json({ error: "Expected at least one leg." }, { status: 400 });
  }
  if (legs.length > MAX_COMPONENTS) {
    return Response.json(
      { error: `A basket holds at most ${MAX_COMPONENTS} components.` },
      { status: 400 },
    );
  }

  const clean: FillLegRequest[] = [];
  for (const leg of legs) {
    if (
      typeof leg?.mint !== "string" ||
      typeof leg?.base !== "string" ||
      typeof leg?.units !== "string" ||
      typeof leg?.usd !== "number" ||
      !Number.isFinite(leg.usd) ||
      leg.usd < 0
    ) {
      return Response.json({ error: "A leg is malformed." }, { status: 400 });
    }
    // Base58 and a plain integer. Both go straight into a URL.
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(leg.mint)) {
      return Response.json({ error: "A mint is not an address." }, { status: 400 });
    }
    if (!/^\d{1,20}$/.test(leg.units)) {
      return Response.json({ error: "A unit amount is not an integer." }, { status: 400 });
    }
    clean.push({
      mint: leg.mint,
      base: leg.base.slice(0, 12),
      units: leg.units,
      usd: leg.usd,
    });
  }

  const shares = Number(body.shares);
  const cost = await quoteFill(
    clean,
    Number.isFinite(shares) && shares > 0 ? shares : 1,
  );

  return Response.json(cost, {
    headers: { "cache-control": "no-store" },
  });
}
