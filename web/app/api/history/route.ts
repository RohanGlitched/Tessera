import { readHistory } from "@/lib/history";

/**
 * A year of daily closes for every listed company in the universe, plus the
 * benchmark, as one document. The track record on each basket page is computed
 * from this in the browser, so a visitor fetches it once and every basket they
 * look at afterwards is arithmetic.
 *
 * Daily data changes once a day, so an hour at the CDN is conservative, and
 * stale-while-revalidate means nobody waits on the upstream after the first
 * visitor of the hour.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const history = await readHistory();
  return Response.json(history, {
    headers: {
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
