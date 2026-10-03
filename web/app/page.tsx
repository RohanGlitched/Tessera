import Link from "next/link";
import { HomeMosaic, HomeStats, ComposeCta } from "@/components/home-mosaic";
import { MarketClock } from "@/components/market-clock";
import { FeaturedBaskets } from "@/components/featured-baskets";
import { LaunchMarket } from "@/components/launch-market";

const LIFE = [
  {
    n: "1",
    title: "Write the recipe",
    on: "Tessera program",
    body: "Pick up to eight tokenised equities, xStocks or PreStocks SPVs over OpenAI, Anthropic and SpaceX, and weigh them. The program stores the exact raw units per share and gives up the power to change them.",
  },
  {
    n: "2",
    title: "Open a market",
    on: "Meteora DBC",
    body: "A basket with no holders has no market. Its creator opens a bonding curve priced from the basket's own NAV, so people can buy in before anyone has assembled a share. It graduates into a locked Meteora pool.",
    href: "#launch",
  },
  {
    n: "3",
    title: "Create shares in kind",
    on: "Token-2022 vault",
    body: "A share is minted by handing the vault exactly what the recipe names and redeemed by taking exactly that back. No oracle is read, so there is no price to push. PreStocks transfer fees are grossed up, so the vault never falls short.",
  },
  {
    n: "4",
    title: "Hold one token",
    on: "Any Solana wallet",
    body: "The share is an ordinary Token-2022 mint: it transfers, sits in a wallet and can be sold. Dividends on the components accrue to the vault, and so to every holder. The creator earns a fee in shares on every creation.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      {/* ------------------------------------------------------------- hero */}
      <section className="grid gap-12 pt-14 pb-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 lg:pt-20">
        <div className="max-w-[34rem] self-center">
          <Link
            href="#launch"
            className="rise mb-7 inline-flex items-center gap-2.5 border border-gold/40 px-3 py-1.5 text-xs text-ivory-dim transition-colors hover:border-gold hover:text-ivory"
          >
            <span className="live-dot size-1.5 shrink-0 rounded-full bg-gain" aria-hidden />
            Live now: a basket trading on a Meteora bonding curve
            <span aria-hidden>↓</span>
          </Link>
          <h1 className="rise display text-hero text-ivory" style={{ "--i": 1 } as React.CSSProperties}>
            An index fund is a list of companies and a set of weights.
          </h1>
          <p className="rise mt-7 max-w-[46ch] text-lg leading-relaxed text-ivory-dim" style={{ "--i": 2 } as React.CSSProperties}>
            Tessera is an ETF launchpad on Solana. Pick up to eight tokenised
            stocks and pre-IPO companies such as OpenAI and SpaceX, set the
            weights, and launch them as one token. Every share is backed by the
            real tokens in an on-chain vault and can be redeemed for them at any
            time. You earn a fee on every share created.
          </p>
          <div className="rise mt-9 flex flex-wrap items-center gap-4" style={{ "--i": 3 } as React.CSSProperties}>
            <ComposeCta />
            <Link
              href="/explore"
              className="border border-rule px-5 py-3 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
            >
              Explore baskets
            </Link>
          </div>
          <p className="rise mt-7 text-sm leading-relaxed text-ivory-faint" style={{ "--i": 4 } as React.CSSProperties}>
            Nothing is priced by an oracle. A share is created by handing the vault
            the exact tokens the recipe names, and redeemed by taking them back.
          </p>
        </div>

        <div className="self-center">
          <HomeMosaic />
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="reveal border-y border-rule py-px">
        <HomeStats />
      </section>

      {/* ------------------------------------------------------- lifecycle */}
      <section className="reveal py-20">
        <h2 className="display text-title max-w-[26ch] text-ivory">
          From a recipe to a market, and none of it trusts us.
        </h2>
        <ol className="mt-12 grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {LIFE.map((step) => (
            <li key={step.title} className="flex flex-col bg-ground-deep p-7">
              <p className="flex items-baseline justify-between gap-3 text-xs">
                <span className="tnum text-gold">{step.n}</span>
                <span className="text-ivory-faint">{step.on}</span>
              </p>
              <h3 className="display mt-3 text-xl text-ivory">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">{step.body}</p>
              {step.href && (
                <Link
                  href={step.href}
                  className="mt-auto pt-4 text-sm text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
                >
                  See the live one
                </Link>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-[62ch] text-sm leading-relaxed text-ivory-faint">
          Deposits round up and redemptions round down, so every rounding remainder
          stays in the vault. The vault can therefore only ever hold more than the
          outstanding shares claim, never less.{" "}
          <Link
            href="/method"
            className="text-ivory-dim underline decoration-rule-bright underline-offset-4 hover:text-ivory"
          >
            How the program is built
          </Link>
        </p>
      </section>

      {/* ---------------------------------------------------------- launch */}
      <section id="launch" className="reveal scroll-mt-24 border-t border-rule py-20">
        <LaunchMarket />
      </section>

      {/* ------------------------------------------------------- two clocks */}
      <section className="reveal grid gap-10 border-t border-rule py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <div className="max-w-[38ch] self-center">
          <h2 className="display text-title text-ivory">
            The exchange keeps hours. Your basket does not.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-ivory-dim">
            A tokenised share trades every minute of every day, including the
            hours when the listing behind it is dark. That is where the gap between
            token and share opens up, and it is why Tessera shows you both prices
            rather than one.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ivory-faint">
            The exchange calendar here is the one Pyth publishes for each listing,
            holidays and shortened sessions included.
          </p>
        </div>
        <div className="self-center">
          <MarketClock />
        </div>
      </section>

      {/* -------------------------------------------------------- baskets */}
      <section className="reveal border-t border-rule py-20">
        <FeaturedBaskets />
      </section>
    </div>
  );
}
