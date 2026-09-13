# Tessera

**Anyone can launch an index fund. It takes one transaction, and nobody has to trust the person who launched it.**

An index fund is two things: a list of companies and a set of weights. Everything
else the industry grew around it is administration. Tessera keeps the two things
and deletes the administration.

Pick up to eight tokenised equities, set their weights, and Tessera writes a
recipe into a Solana program and hands that program the authority over a new
share mint. From then on the share is a claim on specific quantities of specific
tokens sitting in a vault anyone can read. You create shares by handing the vault
the components. You redeem them by taking the components back. No oracle is
consulted, no manager can rebalance you, and no upgrade path exists that would
let the creator change what your share is a claim on.

The creator earns a fee of up to 1% on every share created — paid in shares of
their own basket, never out of the vault.

---

## What is actually real here

| | |
|---|---|
| Prices, 24-hour moves, liquidity, holders, dividend multipliers | **Solana mainnet, live** |
| The 20 tokenised equities being composed | **Real xStocks by Backed Finance** |
| Creating and redeeming shares | **A mirror cluster** (see below) |
| The program's arithmetic | **9 passing integration tests** |

Nothing on screen is a sample or a placeholder. Every figure in the market
mosaic, every premium against the listed share, and every dividend-accrual number
is read from mainnet at page load.

**Why creation runs on a mirror.** The 20 xStocks exist only on mainnet.
Deploying an unaudited program that takes custody of real tokenised Apple would
be reckless, and quoting invented prices on devnet would make every number in the
product a lie. So the write cluster gets a faithful mirror instead: one
Token-2022 mint per ticker, 8 decimals, a self-referential metadata pointer, and
a `ScaledUiAmountConfig` seeded from the multiplier the real mint carries right
now. The only difference the program can observe is who holds the mint authority,
which is what lets the app hand a visitor test tokens. Swapping the mirror mints
for the real ones is a change to one generated file.

---

## Why this has to be a blockchain

The claim is not that a chain is faster. It is that four things collapse into one
transaction here and cannot collapse anywhere else: **issuing a new instrument,
taking custody of its backing, settling the exchange, and letting anybody verify
the backing afterwards.** A fund administrator does the first three and an auditor
does the fourth, quarterly. Here the fourth is a `getTokenAccountBalance` call
that anyone can make at any time, and the basket page makes it on every load.

**Why Solana in particular**, on two counts:

1. **Creation and redemption are only useful if they are cheap and immediate.**
   The mechanism that keeps a fund tracking its holdings is arbitrage between the
   basket and its components, and that arbitrage has to settle before the gap
   moves. Fractions of a cent per transaction are what make a hundred-dollar
   basket worth creating at all.
2. **Token-2022 is load-bearing, not incidental.** The tokenised equities pay
   dividends by raising a `ScaledUiAmountConfig` multiplier on the mint rather
   than transferring anything. A basket recipe written in *displayed* balances
   would be short by exactly the dividends already accrued. Tessera writes
   recipes in raw units and multiplies through the current multiplier when
   pricing, which is why redeeming a share returns the same raw amount before
   and after a dividend while being worth more. This is a token-extension
   problem, and it does not exist on a chain without token extensions.

---

## The three design decisions worth arguing about

**In kind, so there is no price to argue with.** Creating shares means handing
the vault the actual tokens the recipe names; redeeming means taking them back.
The program never asks what anything is worth, so there is no oracle to go
stale, none to be manipulated, and none to pay for. This is the same mechanism a
real ETF uses — the difference is that the right to create and redeem normally
belongs to a handful of authorised participants, and here it belongs to whoever
holds the tokens. It also means redemption cannot fail for market reasons: if
every buyer disappears, a share is still a claim on specific tokens in a specific
vault.

**Rounding always favours the people still holding.** Amounts are integers, so
division leaves remainders. Every deposit rounds **up** and every withdrawal
rounds **down**. A creator pays at most one extra raw unit per component; a
redeemer receives at most one raw unit less. The consequence is the property the
basket page proves on every load: what the vault holds can only ever be at or
above what the outstanding shares can claim, so **backing per share never
falls.** Rounding dust accrues to whoever is still holding — the opposite of the
usual arrangement where the fund keeps it.

**The creator fee comes out of shares, never the vault.** The fee is taken from
the shares issued, not the components deposited, so the vault always receives the
full recipe and backing per share is untouched. A creator who wants to be paid
more has exactly one lever: get more people to create shares. They cannot dilute
holders and cannot reach into the vault, because the program has no instruction
that would let them.

### What it gives up

Creating shares requires holding every component first, in the right proportions.
That is the cost of refusing to trust a price. A router can smooth it over for
someone paying in one currency, and the honest statement is that the primitive
underneath is in kind and the convenience is a layer on top.

The tokens themselves are issued by Backed Finance, not by Tessera. Their
transfer hooks, permanent delegate, and pause authority are theirs. Tessera does
not remove counterparty risk in a tokenised equity; it removes counterparty risk
in the wrapper around it.

---

## The program

`programs/tessera/src/lib.rs`, Anchor 0.31.1. Program ID
`F8QLTZPe9mJuPgXCbccnU9G2kMSEE4inygdUw3QZbrQ`.

Three instructions:

- **`create_basket`** — validates the recipe, stores raw units per share per
  component, and requires that the share mint has 6 decimals, zero supply, no
  freeze authority, and the basket PDA as its mint authority. The recipe cannot
  be edited afterwards; no instruction exists to do so.
- **`mint_shares`** — transfers each component from the caller into the basket's
  own associated token account, rounding up, then mints shares to the caller and
  the creator's fee cut.
- **`redeem_shares`** — burns shares and transfers each component back, rounding
  down.

Constants: 6 share decimals, 1 to 8 components, a 1% fee ceiling, a 32-character
name and 10-character symbol. Vaults are checked to be the basket's own
associated token account, so a caller cannot substitute one they control.

```
$ pnpm exec ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'

  tessera
    ✔ records the recipe it was given
    ✔ refuses a recipe whose weights do not add up
    ✔ refuses a creator fee above 1%
    ✔ takes the recipe in and issues shares, net of the creator fee
    ✔ keeps the vault fully backing every outstanding share
    ✔ hands the components back on redemption
    ✔ rejects a vault that is not the basket's own token account
    ✔ is unmoved by a dividend accruing into a component's multiplier
    ✔ still fully backs every share after all that

  9 passing
```

The eighth test is the one that matters most: it raises a component's
`ScaledUiAmountConfig` multiplier mid-test and asserts that mint and redeem
amounts in raw units are unchanged.

---

## The app

Next.js 16 App Router, React 19, Tailwind v4, `@solana/wallet-adapter`.

| Route | What it does |
|---|---|
| `/` | The market as a mosaic, sized by on-chain liquidity, plus the baskets that exist |
| `/compose` | Click tiles to pick companies, drag weights, name the token, lay the basket |
| `/explore` | Every basket, with its backing proof and premium to its own components |
| `/basket/[address]` | One basket: recipe, vault contents, backing check, mint and redeem |
| `/portfolio` | What you hold, what it is worth, and what it would redeem for |
| `/method` | The document behind the product, including what it gives up |

Two API routes: `/api/market` batches the mainnet reads (prices via Jupiter,
supply and multipliers via `getMultipleAccounts`) behind a short cache, and
`/api/faucet` hands mirror tokens to a wallet so the mint flow can be tried
without owning tokenised Apple.

Design notes worth knowing if you are reading the code:

- **Both treemaps label only what fits.** SVG text has nothing to clip it, so
  `fitsTile()` in `lib/treemap.ts` length-tests a string against its tile before
  the label is drawn. `GOOGL` used to render straight across its neighbour.
- **The 1232-byte packet limit shapes `lib/tx.ts`.** `packSteps` measures each
  compiled message and splits creation across two signatures when a basket has
  enough components to overflow one transaction. An 8-component create measures
  1260 bytes; a 1-component create measures 734.
- **Colour is validated, not eyeballed.** The diverging scale for 24-hour moves
  was generated by `scripts/build-diverging.mjs` and checked for a worst-case
  colour-vision separation of 8.1 in OKLab.

---

## Running it

Requires Node 22+, pnpm, Rust, the Solana CLI (Agave 4.x) and Anchor 0.31.1.

```bash
pnpm install
cd web && pnpm install && cd ..

# 1. A local validator, with the program loaded.
solana-test-validator --reset &
anchor build && anchor deploy --provider.cluster localnet

# 2. Build the mirror mints and generate web/lib/mirror.generated.ts.
#    Reads the live multipliers from mainnet, so this needs network access.
node scripts/setup-mirror.mjs

# 3. Optional: a few baskets to look at.
node scripts/seed-baskets.mjs

# 4. Configure and run the app.
cp web/.env.example web/.env.local   # then fill in FAUCET_SECRET_KEY
cd web && pnpm build && pnpm start
```

Both scripts take `--url devnet` to target devnet instead, in which case set
`NEXT_PUBLIC_WRITE_CLUSTER=devnet` in `web/.env.local`.

Run the program tests against a running validator with:

```bash
ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 \
ANCHOR_WALLET=~/.config/solana/id.json \
NODE_OPTIONS=--no-experimental-strip-types \
pnpm exec ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'
```

> **Note on `next dev`:** the dev server does not hydrate in some WSL setups.
> Verify against `pnpm build && pnpm start` if the page renders but nothing
> responds to a click.

---

## Layout

```
programs/tessera/src/lib.rs   the program: create, mint, redeem
tests/tessera.ts              9 integration tests, including the dividend case
scripts/setup-mirror.mjs      creates the mirror mints, writes mirror.generated.ts
scripts/seed-baskets.mjs      a few baskets to look at
scripts/gen-universe.mjs      regenerates web/lib/universe.ts from mainnet
scripts/build-diverging.mjs   generates and validates the 24h-move colour scale
web/                          the Next.js app
```

---

Not investment advice, and not an offer to sell anything. Tokenised equities are
issued by Backed Finance; Tessera neither issues nor custodies them beyond the
program vault a basket writes to.
