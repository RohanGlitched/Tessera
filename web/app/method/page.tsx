import type { Metadata } from "next";
import Link from "next/link";
import {
  MAX_COMPONENTS,
  MAX_CREATOR_FEE_BPS,
  SHARE_DECIMALS,
  TESSERA_PROGRAM_ID,
  WRITE_CLUSTER,
  explorerAddress,
  explorerTx,
} from "@/lib/config";
import { FEATURED_DBC } from "@/lib/dbc";
import { fetchBasketAt, type Basket } from "@/lib/tessera";
import { stockForWriteMint } from "@/lib/mirror";
import { slotColor } from "@/lib/palette";
import { quantity, shortAddress } from "@/lib/format";
import { FeaturedLaunch } from "@/components/launch-market";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Four stages from a list of companies to a token you can trade: an immutable recipe, a Meteora launch market, in-kind creation, and one token to hold.",
};

export const revalidate = 300;

const [EXAMPLE, DBC] = FEATURED_DBC;
const EXAMPLE_MINT_TX =
  "4jNTjhUgbGUu1eLhCXZmZrzZ8H9Mr1UXJH1stbSw1GVopVM22rdet7xHT5BTWhG6NHYtdoHn3LgHoyppkBAsBbkz";

const STAGES = [
  { id: "recipe", title: "Write the recipe" },
  { id: "market", title: "Open a market" },
  { id: "create", title: "Create shares in kind" },
  { id: "hold", title: "Hold one token" },
];

const GUARANTEES = [
  {
    title: "No oracle",
    body: "Shares are created and redeemed against tokens, never against a price, so there is no feed to go stale or be pushed.",
  },
  {
    title: "No edit button",
    body: "The recipe is written once. There is no manager, no rebalance authority and no instruction that changes what a share holds.",
  },
  {
    title: "Rounding favours holders",
    body: "Deposits round up and redemptions round down, so the vault can only ever hold at least what the shares claim.",
  },
  {
    title: "The fee never touches the vault",
    body: `The creator earns up to ${MAX_CREATOR_FEE_BPS / 100}% of each creation in new shares. The vault always receives the full recipe.`,
  },
  {
    title: "Anyone can create and redeem",
    body: "In a traditional fund that right belongs to a few authorised participants. Here it belongs to whoever holds the tokens.",
  },
  {
    title: "Buying with dollars, measured",
    body: "Every basket page quotes the round trip through Jupiter for each component. A typical basket lands under a quarter of a percent.",
  },
];

function Stage({
  n,
  id,
  title,
  on,
  proof,
  visual,
  children,
}: {
  n: number;
  id: string;
  title: string;
  on: string;
  proof?: { label: string; href: string };
  visual: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="grid scroll-mt-24 gap-10 border-t border-rule py-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16"
    >
      <div className="max-w-[46ch]">
        <p className="flex items-baseline gap-4">
          <span className="display tnum text-5xl text-gold">{n}</span>
          <span className="text-xs tracking-wide text-ivory-faint">{on}</span>
        </p>
        <h2 className="display mt-4 text-title text-ivory">{title}</h2>
        <div className="mt-5 space-y-4 text-base leading-relaxed text-ivory-dim">
          {children}
        </div>
        {proof && (
          <a
            href={proof.href}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-block text-sm text-ivory-dim underline decoration-rule-bright underline-offset-4 hover:text-ivory"
          >
            {proof.label} ↗
          </a>
        )}
      </div>
      <div className="min-w-0 self-center">{visual}</div>
    </section>
  );
}

function RecipeVisual({ basket }: { basket: Basket }) {
  return (
    <div className="border border-rule bg-ground-raised">
      <p className="border-b border-rule px-6 py-4 text-sm text-ivory-dim">
        One <span className="text-ivory">{basket.symbol}</span> share of{" "}
        {basket.name} is exactly
      </p>
      <ul className="divide-y divide-rule">
        {basket.components.map((component, i) => {
          const stock = stockForWriteMint(component.mint);
          return (
            <li key={component.mint} className="flex items-center gap-4 px-6 py-3.5">
              <span
                className="size-3 shrink-0"
                style={{ background: slotColor(i) }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-sm text-ivory">
                {stock?.company ?? shortAddress(component.mint)}
              </span>
              <span className="tnum text-sm text-ivory-dim">
                {quantity(Number(component.unitsPerShare) / 10 ** component.decimals, 6)}
                <span className="hidden sm:inline"> {stock?.symbol ?? ""}</span>
              </span>
              <span className="tnum w-12 text-right text-xs text-ivory-faint">
                {(component.weightBps / 100).toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-rule px-6 py-4 text-xs text-ivory-faint">
        Stored as raw units in a program account. No instruction can change it.
      </p>
    </div>
  );
}

function CreateVisual({ basket }: { basket: Basket | null }) {
  const symbols = basket
    ? basket.components.map((c) => stockForWriteMint(c.mint)?.symbol ?? "?")
    : ["AAPLx", "NVDAx", "TSLAx"];
  const share = basket?.symbol ?? "share";
  const fee = basket ? basket.creatorFeeBps / 100 : 0.5;

  const box = "border border-rule bg-ground-raised px-4 py-4";
  return (
    <div className="space-y-3">
      <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <div className={box}>
          <p className="text-xs text-ivory-faint">You hand over</p>
          <p className="mt-2 flex flex-wrap gap-1.5">
            {symbols.map((symbol, i) => (
              <span
                key={symbol + i}
                className="tnum border px-1.5 py-0.5 text-xs text-ivory"
                style={{ borderColor: slotColor(i) }}
              >
                {symbol}
              </span>
            ))}
          </p>
        </div>
        <span className="self-center text-center text-gold" aria-hidden>
          <span className="hidden sm:inline">→</span>
          <span className="sm:hidden">↓</span>
        </span>
        <div className={`${box} border-gold/40`}>
          <p className="text-xs text-ivory-faint">The vault</p>
          <p className="mt-2 text-sm text-ivory">The basket&rsquo;s own token accounts</p>
          <p className="mt-1 text-xs text-ivory-faint">rounds up on the way in</p>
        </div>
        <span className="self-center text-center text-gold" aria-hidden>
          <span className="hidden sm:inline">→</span>
          <span className="sm:hidden">↓</span>
        </span>
        <div className={box}>
          <p className="text-xs text-ivory-faint">You receive</p>
          <p className="tnum mt-2 text-sm text-ivory">
            {share} shares, less {fee}%
          </p>
          <p className="tnum mt-1 text-xs text-ivory-faint">
            the {fee}% is minted to the creator
          </p>
        </div>
      </div>
      <p className="border border-dashed border-rule-bright/60 px-4 py-3 text-center text-xs text-ivory-dim">
        Redeeming runs it backwards: burn {share} shares and every component
        comes back, rounded down.
      </p>
    </div>
  );
}

function HoldVisual({ basket }: { basket: Basket | null }) {
  const rows: [string, string][] = [
    ["Standard", "Token-2022, like any other token"],
    ["Mint authority", "the basket's program account, nobody else"],
    ["Freeze authority", "none, the program refuses one"],
    ["Transfers", "any wallet, any program"],
    ["Dividends", "raise the components' multiplier, so the vault grows"],
  ];
  return (
    <div className="border border-rule bg-ground-raised">
      <p className="border-b border-rule px-6 py-4 text-sm text-ivory-dim">
        What a {basket?.symbol ?? "share"} token is
        {basket && (
          <>
            {" · "}
            <a
              href={explorerAddress(basket.shareMint)}
              target="_blank"
              rel="noreferrer"
              className="tnum text-ivory-faint underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
            >
              {shortAddress(basket.shareMint, 6, 6)}
            </a>
          </>
        )}
      </p>
      <dl className="divide-y divide-rule text-sm">
        {rows.map(([term, value]) => (
          <div key={term} className="grid gap-1 px-6 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-ivory-faint">{term}</dt>
            <dd className="text-ivory">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function MethodPage() {
  const basket = await fetchBasketAt(EXAMPLE);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-8">
      <header className="max-w-[62ch]">
        <h1 className="display text-hero leading-[0.95] text-ivory">How it works</h1>
        <p className="mt-6 text-lg leading-[1.65] text-ivory-dim">
          Four stages turn a list of companies into a token you can trade. Every
          one has already happened on {WRITE_CLUSTER}, and each links to the
          account or transaction that proves it. The running example is{" "}
          <Link
            href={`/basket/${EXAMPLE}`}
            className="text-ivory underline decoration-rule-bright underline-offset-4 hover:decoration-ivory-dim"
          >
            {basket?.name ?? "Frontier Labs"}
          </Link>
          , a basket of pre-IPO companies.
        </p>
      </header>

      <nav aria-label="Stages" className="mt-10 grid gap-px bg-rule sm:grid-cols-4">
        {STAGES.map((stage, i) => (
          <a
            key={stage.id}
            href={`#${stage.id}`}
            className="flex items-baseline gap-3 bg-ground-deep px-4 py-3 text-sm text-ivory-dim transition-colors hover:bg-ground-raised hover:text-ivory"
          >
            <span className="tnum text-gold">{i + 1}</span>
            {stage.title}
          </a>
        ))}
      </nav>

      <div className="mt-6">
        <Stage
          n={1}
          id="recipe"
          title="Write the recipe"
          on="Tessera program · create_basket"
          proof={{ label: "The recipe account on Explorer", href: explorerAddress(EXAMPLE) }}
          visual={
            basket ? (
              <RecipeVisual basket={basket} />
            ) : (
              <p className="border border-rule px-6 py-10 text-center text-sm text-ivory-faint">
                The example recipe could not be read right now.
              </p>
            )
          }
        >
          <p>
            Pick up to {MAX_COMPONENTS} tokenised equities: xStocks such as Apple
            and NVIDIA, or PreStocks SPVs over OpenAI, Anthropic and SpaceX. Set a
            weight for each.
          </p>
          <p>
            Tessera turns the weights into an exact number of raw token units per
            share at the prices on screen. The program writes that recipe into an
            account, then takes over the share mint for good.
          </p>
        </Stage>

        <Stage
          n={2}
          id="market"
          title="Open a market"
          on="Meteora Dynamic Bonding Curve"
          proof={{ label: "The pool on Explorer", href: explorerAddress(DBC.pool) }}
          visual={<FeaturedLaunch />}
        >
          <p>
            A new basket has no holders yet, and nobody wants to be first to
            assemble every component. So a bonding curve opens in front of it, and
            people can buy in before the first share exists.
          </p>
          <p>
            The curve is set from the basket&rsquo;s own NAV rather than round
            numbers. It opens at half of it and graduates at twenty times it into a
            Meteora DAMM v2 pool with all liquidity locked. The fee starts at 4% to
            deter snipers and settles at 1% within the hour.
          </p>
          <p>
            The basket&rsquo;s creator opens it from the basket page in one
            signature and earns half of the curve&rsquo;s trading fees; Tessera
            earns the other half. The pool&rsquo;s address is derived from the
            basket&rsquo;s, so every basket has exactly one launch and anyone can
            find it. When the curve fills, anyone can graduate it from the same
            page.
          </p>
        </Stage>

        <Stage
          n={3}
          id="create"
          title="Create shares in kind"
          on="Token-2022 vault · mint_shares, redeem_shares"
          proof={{ label: "A creation with a PreStocks fee grossed up", href: explorerTx(EXAMPLE_MINT_TX) }}
          visual={<CreateVisual basket={basket} />}
        >
          <p>
            To create a share you hand the vault exactly what the recipe names. To
            redeem one you take exactly that back. No price is consulted at any
            point.
          </p>
          <p>
            Some PreStocks charge a fee on every transfer. The program reads that
            fee live and grosses the deposit up, so the vault always nets the full
            recipe.
          </p>
        </Stage>

        <Stage
          n={4}
          id="hold"
          title="Hold one token"
          on="Any Solana wallet"
          proof={
            basket
              ? { label: "The share mint on Explorer", href: explorerAddress(basket.shareMint) }
              : undefined
          }
          visual={<HoldVisual basket={basket} />}
        >
          <p>
            Several positions become one. The share sends, sits in a wallet and can be
            sold like any token, and{" "}
            <Link
              href="/portfolio"
              className="text-ivory underline decoration-rule-bright underline-offset-4 hover:decoration-ivory-dim"
            >
              Portfolio
            </Link>{" "}
            looks through it to the companies underneath.
          </p>
          <p>
            xStocks pay dividends by raising a multiplier on the mint rather than
            sending tokens. The recipe is in raw units, so the vault keeps every
            dividend for the people holding shares.
          </p>
        </Stage>
      </div>

      <section className="border-t border-rule py-16">
        <h2 className="display text-title max-w-[24ch] text-ivory">
          Why nobody has to trust the creator, or us
        </h2>
        <ul className="mt-10 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {GUARANTEES.map((item) => (
            <li key={item.title} className="bg-ground-deep p-7">
              <h3 className="display text-lg text-ivory">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-10 border-t border-rule py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="max-w-[48ch] space-y-4 text-base leading-relaxed text-ivory-dim">
          <h2 className="display text-title text-ivory">What is live</h2>
          <p>
            Every price, 24-hour move, liquidity figure and dividend multiplier is
            read from Solana mainnet as you look at it.
          </p>
          <p>
            Creation and redemption settle on {WRITE_CLUSTER} against mirrors of
            the same mints, with the same decimals, metadata, multipliers and
            transfer fees. You can try the whole thing without spending money.
          </p>
          <p>
            Solana is what makes it worth doing: issuing the instrument, taking
            custody of its backing and settling the trade happen in one
            transaction for a fraction of a cent.
          </p>
          <p className="tnum text-sm text-ivory-faint">
            Program{" "}
            <a
              href={explorerAddress(TESSERA_PROGRAM_ID)}
              target="_blank"
              rel="noreferrer"
              className="break-all underline decoration-rule-bright underline-offset-4 hover:text-ivory-dim"
            >
              {TESSERA_PROGRAM_ID}
            </a>
          </p>
        </div>
        <div className="self-center">
          <dl className="divide-y divide-rule border border-rule text-sm">
            {[
              ["Components per basket", `1 to ${MAX_COMPONENTS}`],
              ["Share decimals", String(SHARE_DECIMALS)],
              ["Creator fee ceiling", `${MAX_CREATOR_FEE_BPS / 100}%`],
              ["Deposits", "round up"],
              ["Redemptions", "round down"],
              ["Oracles used", "none"],
              ["Recipe after creation", "immutable"],
              ["Launch market", "Meteora DBC"],
            ].map(([term, value]) => (
              <div key={term} className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="text-ivory-faint">{term}</dt>
                <dd className="tnum text-ivory">{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/compose"
            className="mt-6 inline-block border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e]"
          >
            Create a basket
          </Link>
        </div>
      </section>
    </div>
  );
}
