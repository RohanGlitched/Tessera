import type { Metadata } from "next";
import Link from "next/link";
import {
  MAX_COMPONENTS,
  MAX_CREATOR_FEE_BPS,
  SHARE_DECIMALS,
  TESSERA_PROGRAM_ID,
  WRITE_CLUSTER,
  explorerAddress,
} from "@/lib/config";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "In-kind creation and redemption, the rounding rule that keeps every share backed, and why the dividend multiplier changes the arithmetic.",
};

/**
 * The document behind the product.
 *
 * A page like this earns trust only by being specific. Every claim here names the
 * mechanism that makes it true, and the two places the design gives something up
 * are stated as plainly as the places it wins.
 */

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-10">
      <h2 className="display text-title leading-tight text-ivory">{heading}</h2>
      <div className="mt-5 space-y-5 text-base leading-[1.7] text-ivory-dim">
        {children}
      </div>
    </section>
  );
}

export default function MethodPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
      <header className="max-w-[62ch]">
        <h1 className="display text-hero leading-[0.95] text-ivory">
          How it works
        </h1>
        <p className="mt-6 text-lg leading-[1.65] text-ivory-dim">
          An index fund is two things: a list of companies and a set of weights.
          Everything else about the industry that grew around it is
          administration. Tessera keeps the two things and deletes the
          administration.
        </p>
      </header>

      <div className="mt-16 grid gap-14 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="space-y-14">
          <Section heading="A basket is a recipe and a vault">
            <p>
              When somebody lays a basket, the program writes down how many raw
              units of each token stand behind one share, and then takes control of
              the share mint. That record cannot be edited afterwards. There is no
              manager, no rebalance authority, and no upgrade path that lets
              somebody change what your share is a claim on.
            </p>
            <p>
              A basket holds up to {MAX_COMPONENTS} components. Shares carry{" "}
              {SHARE_DECIMALS} decimals, so a share divides down to a millionth. The vault is the basket account&rsquo;s own associated
              token account for each component, which means anybody can check the
              balance without asking us where the assets are.
            </p>
          </Section>

          <Section heading="In kind, so there is no price to argue with">
            <p>
              Creating shares means handing the vault the actual tokens the recipe
              names. Redeeming means taking them back out. At no point does the
              program ask what anything is worth, so there is no oracle to go stale,
              no oracle to be manipulated, and no oracle to pay for.
            </p>
            <p>
              This is the same mechanism a real exchange-traded fund uses, and it
              is the reason a fund tracks its holdings instead of drifting from
              them. The difference is that the right to create and redeem normally
              belongs to a handful of authorised participants. Here it belongs to
              whoever is holding the tokens.
            </p>
            <p>
              It also means redemption cannot fail for market reasons. If every
              buyer disappears, a share is still a claim on specific tokens in a
              specific vault, and the claim is honoured by a program that has no
              opinion about the news.
            </p>
          </Section>

          <Section heading="Rounding always favours the people still holding">
            <p>
              Amounts are integers, so division leaves remainders. Every deposit
              rounds <em className="not-italic text-ivory">up</em> and every
              withdrawal rounds <em className="not-italic text-ivory">down</em>. A
              creator therefore pays at most one extra raw unit per component, and a
              redeemer receives at most one raw unit less.
            </p>
            <p>
              The consequence is the property the basket page shows you: what the
              vault holds can only ever be at or above what the outstanding shares
              can claim. Backing per share never falls. Rounding dust accumulates in
              the vault and belongs to whoever is still holding shares, which is the
              opposite of the usual arrangement where the fund keeps it.
            </p>
          </Section>

          <Section heading="Dividends arrive as a multiplier, not a payment">
            <p>
              The tokenised equities on Solana use a Token-2022 extension called
              scaled UI amount. When the underlying company pays a dividend, the
              issuer raises a multiplier on the mint, and every wallet&rsquo;s
              displayed balance grows. Nothing is transferred. The raw balance on
              chain is unchanged.
            </p>
            <p>
              That distinction does real work here. A recipe written in raw units is
              immune to the multiplier moving, which is why redeeming a share
              returns exactly the same raw amount before and after a dividend, while
              being worth more. But it also means a basket priced from displayed
              balances would be written short by exactly the dividends already
              accrued. So the composer converts a target share price into raw units
              by multiplying through the current multiplier first.
            </p>
            <p>
              The dividends-inside figure on every basket is that arithmetic run
              backwards: the share of the basket&rsquo;s value that is dividends
              already collected on chain rather than price appreciation.
            </p>
          </Section>

          <Section heading="The creator fee comes out of shares, never the vault">
            <p>
              A creator can set a fee up to {MAX_CREATOR_FEE_BPS / 100}% and earns
              it on every creation, paid in shares of their own basket. The fee is
              taken from the shares issued, not from the components deposited, so
              the vault always receives the full recipe and backing per share is not
              touched by the fee.
            </p>
            <p>
              A creator who wants to be paid more has exactly one lever: get more
              people to create shares. They cannot dilute the holders and they
              cannot reach into the vault, because the program has no instruction
              that would let them.
            </p>
          </Section>

          <Section heading="What this gives up">
            <p>
              Creating shares requires holding every component first, in the right
              proportions. That is the cost of refusing to trust a price. A router
              can smooth it over for someone paying in one currency, and the honest
              statement is that the primitive underneath is in kind and the
              convenience is a layer on top.
            </p>
            <p>
              The tokens themselves are issued by Backed Finance, not by us. Their
              transfer hooks, permanent delegate, and pause authority are theirs.
              Tessera does not remove counterparty risk in the tokenised equity; it
              removes counterparty risk in the wrapper around it.
            </p>
          </Section>

          <Section heading="Why this has to be a blockchain">
            <p>
              The claim is not that a chain is faster. It is that four specific
              things collapse into one transaction here and cannot collapse anywhere
              else: issuing a new instrument, taking custody of its backing,
              settling the exchange, and letting anybody verify the backing
              afterwards.
            </p>
            <p>
              Solana in particular because creation and redemption are only useful
              if they are cheap and immediate. An arbitrage that closes a gap
              between a basket and its components has to settle before the gap
              moves, and fractions of a cent per transaction are what make a
              hundred-dollar basket worth creating at all. Token-2022 matters just
              as much: the dividend mechanism this whole design accounts for is a
              token extension, not an application feature.
            </p>
          </Section>

          <Section heading="What is real on this site">
            <p>
              Every price, every 24-hour move, every liquidity figure, and every
              dividend multiplier is read live from Solana mainnet. Nothing on
              screen is a sample or a placeholder.
            </p>
            <p>
              Creating and redeeming run against {WRITE_CLUSTER}, against faithful
              mirrors of the same mints: Token-2022, the same decimals, the same
              metadata, and a scaled UI multiplier seeded from the live mainnet
              value. So you can hand a vault real quantities and watch the backing
              proof update without spending money on a demonstration.
            </p>
            {/* A 43-character base58 address is one unbreakable word, and on a
                phone that single word was wider than the screen. */}
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
          </Section>
        </div>

        {/* --------------------------------------------------------- side rail */}
        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          <div className="border border-rule p-6">
            <h3 className="display text-lg text-ivory">
              Three steps, and none of them trust us
            </h3>
            <ol className="mt-5 space-y-5 text-sm leading-relaxed text-ivory-dim">
              <li>
                <span className="text-ivory">Write the recipe.</span> Pick
                companies and weights. The program stores raw units per share and
                gives up the ability to change them.
              </li>
              <li>
                <span className="text-ivory">Create shares in kind.</span> Deposit
                the components, receive the share. No price is quoted.
              </li>
              <li>
                <span className="text-ivory">Redeem whenever.</span> Burn the share,
                take the components back. This works even if nobody wants to buy.
              </li>
            </ol>
            <Link
              href="/compose"
              className="mt-7 inline-block border border-gold bg-gold px-5 py-3 text-sm text-ground-deep transition-colors hover:bg-[#c79a2e]"
            >
              Lay a basket
            </Link>
          </div>

          <dl className="divide-y divide-rule border border-rule text-sm">
            {[
              ["Components per basket", `1 to ${MAX_COMPONENTS}`],
              ["Share decimals", String(SHARE_DECIMALS)],
              ["Creator fee ceiling", `${MAX_CREATOR_FEE_BPS / 100}%`],
              ["Deposits", "round up"],
              ["Redemptions", "round down"],
              ["Oracles used", "none"],
              ["Recipe after creation", "immutable"],
              ["Share token", "Token-2022"],
            ].map(([term, value]) => (
              <div
                key={term}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <dt className="text-ivory-faint">{term}</dt>
                <dd className="tnum text-ivory">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </div>
  );
}
