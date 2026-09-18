import Link from "next/link";
import { HomeMosaic, HomeStats, ComposeCta } from "@/components/home-mosaic";
import { MarketClock } from "@/components/market-clock";
import { FeaturedBaskets } from "@/components/featured-baskets";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
      {/* ------------------------------------------------------------- hero */}
      <section className="grid gap-12 pt-14 pb-16 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14 lg:pt-20">
        <div className="max-w-[34rem] self-center">
          <h1 className="display text-hero text-ivory">
            An index fund is a list of companies and a set of weights.
          </h1>
          <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-ivory-dim">
            Pick from twenty tokenised equities, plus pre-IPO SPVs over OpenAI,
            Anthropic and SpaceX via PreStocks. Tessera mints your list as one
            token, backed share for share in a vault anyone can read. Buyers hold
            a single position instead of eight. You earn a fee on every share
            created.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ComposeCta />
            <Link
              href="/explore"
              className="border border-rule px-5 py-3 text-sm text-ivory-dim transition-colors hover:border-rule-bright hover:text-ivory"
            >
              See what people have laid
            </Link>
          </div>
          <p className="mt-7 text-sm leading-relaxed text-ivory-faint">
            Nothing is priced by an oracle. A share is created by handing the vault
            the exact tokens the recipe names, and redeemed by taking them back.
          </p>
        </div>

        <div className="self-center">
          <HomeMosaic />
        </div>
      </section>

      {/* ------------------------------------------------------------ stats */}
      <section className="border-y border-rule py-px">
        <HomeStats />
      </section>

      {/* ------------------------------------------------------- two clocks */}
      <section className="grid gap-10 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
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

      {/* -------------------------------------------------------- mechanics */}
      <section className="border-t border-rule py-20">
        <h2 className="display text-title max-w-[24ch] text-ivory">
          Three steps, and none of them trust us.
        </h2>
        <ol className="mt-12 grid gap-px bg-rule md:grid-cols-3">
          {[
            {
              n: "First",
              title: "Write the recipe",
              body: "Choose up to eight tokenised equities and a weight for each. Tessera turns the weights into an exact number of raw token units per share, at the prices on screen, and writes that recipe into a program account. It never changes again.",
            },
            {
              n: "Then",
              title: "Create shares in kind",
              body: "To mint one share you hand the vault exactly what the recipe names. To redeem one you take exactly that back. No price is consulted, so no price can be manipulated to mint a share cheaply.",
            },
            {
              n: "After",
              title: "Hold one thing",
              body: "Your basket is a Token-2022 mint like any other. It transfers, it sits in a wallet, it can be sold. Dividends on the components keep accruing to the vault, which means they keep accruing to every holder.",
            },
          ].map((step) => (
            <li key={step.title} className="bg-ground-deep p-7">
              <span className="text-xs tracking-wide text-gold">{step.n}</span>
              <h3 className="display mt-3 text-xl text-ivory">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ivory-dim">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-8 max-w-[62ch] text-sm leading-relaxed text-ivory-faint">
          Deposits round up and redemptions round down, so every rounding remainder
          stays in the vault. The vault can therefore only ever hold more than the
          outstanding shares claim, never less.{" "}
          <Link
            href="/method"
            className="text-ivory-dim underline decoration-rule-bright underline-offset-2 hover:text-ivory"
          >
            How the program is built
          </Link>
        </p>
      </section>

      {/* -------------------------------------------------------- baskets */}
      <section className="border-t border-rule py-20">
        <FeaturedBaskets />
      </section>
    </div>
  );
}
