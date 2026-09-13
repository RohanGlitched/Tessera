/**
 * What the last mile actually costs.
 *
 * Creating shares in kind means holding every component first, in the right
 * proportions. That is the price of a program that never consults an oracle, and
 * the obvious question is what the convenience of paying in one currency would
 * cost instead. This measures it rather than guessing.
 *
 * The measurement is a round trip, deliberately. Comparing a route's output
 * against a price feed mixes two sources and can make buying look free — or
 * better than free — when the two disagree by more than the spread. So each
 * component is quoted twice through the same router: dollars in, then straight
 * back out again. The gap between the two is what a buyer pays to hold the
 * component instead of the dollars, it comes from one source, and it cannot go
 * negative for reasons that are an artefact.
 *
 * Exact-output quotes would let a leg ask for precisely the units the recipe
 * needs, but Jupiter returns NO_ROUTES_FOUND for exact-out on these pairs, so the
 * buy leg is quoted exact-in at the component's spot value and how much of the
 * recipe that fills is reported alongside.
 *
 * Nothing here is executed. It is a measurement of the routes that exist today.
 */

/** Mainnet USDC. The quote currency for every leg. */
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

export type FillLegRequest = {
  /** The mainnet mint to route into. Not the mirror. */
  mint: string;
  /** Ticker, for display and for error messages. */
  base: string;
  /** Raw units of this component the recipe needs, as a decimal string. */
  units: string;
  /** What those units are worth in USD at spot, used as the buy leg's amount. */
  usd: number;
};

export type FillLeg = {
  base: string;
  /** USDC the buy leg spends. */
  usdcIn: number;
  /** USDC selling the result straight back would return. Null if that leg failed. */
  usdcBack: number | null;
  /** The round trip, in basis points of usdcIn. Spread plus impact, both ways. */
  roundTripBps: number | null;
  /** Raw units the buy leg returns. */
  unitsOut: string;
  /** Raw units the recipe needs. */
  unitsNeeded: string;
  /** unitsOut / unitsNeeded. Below 1 means the spot value does not buy enough. */
  coverage: number | null;
  /** The worse of the two legs' price-impact estimates, as a percentage. */
  priceImpactPct: number | null;
  /** The venues the buy route passes through, in order. */
  venues: string[];
  /** Set when this component could not be routed. */
  error?: string;
};

export type FillCost = {
  shares: number;
  legs: FillLeg[];
  /** Σ of the buy legs: what assembling the recipe costs in USDC. */
  usdcIn: number;
  /** Σ of the sell legs: what selling it all straight back returns. */
  usdcBack: number | null;
  /** The gap between the two, in basis points. The cost of the last mile. */
  roundTripBps: number | null;
  /** The worst single-leg price impact, which is usually the binding one. */
  worstImpactPct: number | null;
  /** Tickers that could not be routed. Present means the totals are null. */
  unroutable: string[];
};

const QUOTE_URL = "https://lite-api.jup.ag/swap/v1/quote";

type Quote = {
  outAmount: number;
  priceImpactPct: number | null;
  venues: string[];
};

/** One direction of one leg. Returns null rather than throwing. */
async function quote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number,
  signal?: AbortSignal,
): Promise<Quote | { error: string }> {
  if (!Number.isFinite(amount) || amount < 1) return { error: "amount too small" };
  const url = `${QUOTE_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${Math.round(
    amount,
  )}&slippageBps=${slippageBps}&swapMode=ExactIn`;
  try {
    const res = await fetch(url, { signal, headers: { accept: "application/json" } });
    const body = (await res.json()) as {
      outAmount?: string;
      priceImpactPct?: string;
      routePlan?: { swapInfo?: { label?: string } }[];
      error?: string;
    };
    if (!res.ok || body.error || !body.outAmount) {
      return { error: body.error ?? `quote failed (${res.status})` };
    }
    return {
      outAmount: Number(body.outAmount),
      priceImpactPct:
        body.priceImpactPct != null ? Number(body.priceImpactPct) * 100 : null,
      venues: (body.routePlan ?? [])
        .map((hop) => hop.swapInfo?.label)
        .filter((label): label is string => Boolean(label)),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "quote failed" };
  }
}

const failed = (q: Quote | { error: string }): q is { error: string } =>
  "error" in q;

/** One component, bought and sold straight back. */
async function measureLeg(
  leg: FillLegRequest,
  slippageBps: number,
  signal?: AbortSignal,
): Promise<FillLeg> {
  const blank: FillLeg = {
    base: leg.base,
    usdcIn: leg.usd,
    usdcBack: null,
    roundTripBps: null,
    unitsOut: "0",
    unitsNeeded: leg.units,
    coverage: null,
    priceImpactPct: null,
    venues: [],
  };

  // Below a cent there is nothing to route and nothing worth reporting.
  const amountIn = Math.round(leg.usd * 10 ** USDC_DECIMALS);
  if (amountIn < 10_000) return { ...blank, error: "too small to route" };

  const buy = await quote(USDC_MINT, leg.mint, amountIn, slippageBps, signal);
  if (failed(buy)) return { ...blank, error: buy.error };

  const needed = Number(leg.units);
  const bought: FillLeg = {
    ...blank,
    unitsOut: String(buy.outAmount),
    coverage: needed > 0 ? buy.outAmount / needed : null,
    priceImpactPct: buy.priceImpactPct,
    venues: buy.venues,
  };

  const sell = await quote(leg.mint, USDC_MINT, buy.outAmount, slippageBps, signal);
  if (failed(sell)) {
    // The buy priced, so the useful half of the answer survives. Say which half
    // is missing rather than throwing the leg away.
    return { ...bought, error: `no return route: ${sell.error}` };
  }

  const usdcBack = sell.outAmount / 10 ** USDC_DECIMALS;
  return {
    ...bought,
    usdcBack,
    roundTripBps: leg.usd > 0 ? (1 - usdcBack / leg.usd) * 10_000 : null,
    priceImpactPct: Math.max(
      buy.priceImpactPct ?? 0,
      sell.priceImpactPct ?? 0,
    ),
  };
}

/**
 * Price a whole recipe. Legs run together — there are at most eight of them, and
 * each is two sequential quotes, which is well inside what the endpoint tolerates.
 */
export async function quoteFill(
  legs: FillLegRequest[],
  shares: number,
  slippageBps = 50,
  signal?: AbortSignal,
): Promise<FillCost> {
  const measured = await Promise.all(
    legs.map((leg) => measureLeg(leg, slippageBps, signal)),
  );

  const usdcIn = measured.reduce((a, leg) => a + leg.usdcIn, 0);
  const unroutable = measured
    .filter((leg) => leg.usdcBack == null)
    .map((leg) => leg.base);

  // Every leg has to price for the total to mean anything. A basket costed from
  // the legs that happened to route would flatter itself.
  const usdcBack =
    unroutable.length === 0
      ? measured.reduce((a, leg) => a + (leg.usdcBack as number), 0)
      : null;

  const impacts = measured
    .map((leg) => leg.priceImpactPct)
    .filter((impact): impact is number => impact != null);

  return {
    shares,
    legs: measured,
    usdcIn,
    usdcBack,
    roundTripBps:
      usdcBack != null && usdcIn > 0 ? (1 - usdcBack / usdcIn) * 10_000 : null,
    worstImpactPct: impacts.length ? Math.max(...impacts) : null,
    unroutable,
  };
}
