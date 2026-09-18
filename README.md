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
| Creating and redeeming shares | **Devnet**, against mirror mints (see below) |
| The program's arithmetic | **10 passing integration tests** |

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

Rather than claim that cost is small, every basket page measures it. **The last
mile** panel quotes each component through Jupiter twice — dollars in, then
straight back out — and prints the round trip. On a live eight-component basket
that is **0.17% for one share and 0.26% for a hundred**, with the venues named per
leg. Comparing a route against a price feed would let two disagreeing sources make
buying look free, so the measurement is against itself. Nothing is executed;
`lib/fill-cost.ts` is the arithmetic.

The tokens themselves are issued by Backed Finance, not by Tessera. Their
transfer hooks, permanent delegate, and pause authority are theirs. Tessera does
not remove counterparty risk in a tokenised equity; it removes counterparty risk
in the wrapper around it.

---

## Sponsor tracks

### PreStocks — a second token-extension problem, solved the same way

Everything above composes xStocks. Tessera also composes **PreStocks**
(`prestocks.com`) — Token-2022 SPVs over pre-IPO companies: Anthropic, OpenAI,
SpaceX, Anduril, Figure AI, Kalshi, Neuralink, Polymarket. Real mainnet mints,
real Jupiter liquidity, listed at `web/lib/prestocks.ts`.

Several of these mints carry a `TransferFeeConfig` extension no xStock has:
every transfer skims a fee at the token-program level. A recipe that deposits
the raw amount it wants the vault to hold would under-back it by exactly that
fee — silently, the same shape of bug `ScaledUiAmountConfig` forces you to
avoid on the xStock side, one extension over. `gross_for_transfer_fee` in
`programs/tessera/src/lib.rs` reads the mint's live fee schedule at deposit
time and grosses up so the vault nets exactly the recipe amount; redemption is
unchanged, since the fee coming out of what leaves the vault doesn't touch
what backs anyone else's share. Covered by the ninth test, and verified live:

- **Basket:** `5Z8XUzGVJjcYPxPZ6Hfxx8uJRNKibFcmZd7yStuSPr1p` — "Frontier Labs",
  four PreStocks components, devnet.
- **Creation tx:** `4jNTjhUgbGUu1eLhCXZmZrzZ8H9Mr1UXJH1stbSw1GVopVM22rdet7xHT5BTWhG6NHYtdoHn3LgHoyppkBAsBbkz`
- On chain right now: the ANTHROPIC vault holds `513564189` raw units with
  `2580725` withheld as fee by the token program — a ratio of exactly 50 bps
  of the gross amount, computed by Token-2022 itself, not by Tessera.

`scripts/setup-mirror-prestocks.mjs` mirrors the eight mints onto the write
cluster, transfer fee included, the way `setup-mirror.mjs` already does for
xStocks. `/compose`, `/portfolio`, and the basket page all treat a PreStock as
an ordinary component once it has a mirror — see `asXStock` in
`web/lib/prestocks.ts`.

### Meteora DBC — a primary market for a basket that has none yet

A brand-new basket has zero shares and no liquidity, and nobody wants to be the
first person to assemble eight components on faith. `scripts/dbc-launch.mjs`
opens a Meteora Dynamic Bonding Curve pool as a front-market for a real
Tessera basket, on the real DBC program (`dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`
— identical address on devnet and mainnet), configured from that basket's own
numbers rather than round ones:

- **`initialMarketCap` / `migrationMarketCap`** are set at 0.5x and 20x the
  basket's own stated NAV per share, converted to SOL at Jupiter's live
  SOL/USD price at launch time — the curve opens and graduates around a
  number Tessera already computes, not an arbitrary one.
- **`tokenAuthorityOption: Immutable`** — the base mint gets no upgrade path,
  the same reason a Tessera share mint has no freeze authority.
- **Fee scheduler decays 4% → 1% over the first hour** — anti-snipe at the
  open, settling at a rate still cheaper than assembling eight components
  through Jupiter (`0.17-0.26%` on **the last mile**, this pool's 1% floor is
  the cost of not having to).
- **Migrated liquidity is 100% permanently locked**, split evenly
  partner/creator — nobody can withdraw it later, by construction, the same
  shape of guarantee as a Tessera vault having no withdrawal instruction a
  creator can call.

Verified live on devnet, quoted in SOL, for the "Frontier Labs" PreStocks
basket above:

- **Config:** `DqxXAWXXqurghukxhZmtridTj1nBobJSHG5aSBeYD5nu`
- **Pool:** `DAZdm2LmiDCfVQaAuVkKdK5Qa1hWmkV1fNK6SzGikqFU`
- **Base token (Token-2022):** `4A1rSrw6PoAVHg1AUfYfxs9nQzbF2ptY86caUuoJsULV` — "Frontier Labs, early access", FRNTRA
- **Creation tx:** `3MDHtKoBXMSmrvhAXoCGXcnS32ekQy6x5udLhyKmE3xAXEe6xLZEv5a6XFZBmmEDiaYDKmgybQ1fp9mEcua1MMgb`
- **A real buy against it:** `38KaZPY3tSVWxtk3xX9PkAqDqeubzAYXTV24hqNkGhuC59wQKBC4yXfZeRTS65tCa2Z2LgTtWaHg7QagfjzUxAni` — 0.01 SOL in, ~4.1M of the 990M curve-side supply out, at the open of the curve.

This pool's token is a separate asset from a Tessera share, not a redemption
right — linking the two (so the pool migrating funds the basket's own first
creation) is the natural next step, not yet built.

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
    ✔ grosses up a deposit so a transfer-fee component still nets the recipe amount
    ✔ still fully backs every share after all that

  10 passing
```

The eighth test is the one that matters most for xStocks: it raises a
component's `ScaledUiAmountConfig` multiplier mid-test and asserts that mint
and redeem amounts in raw units are unchanged. The ninth is its counterpart for
PreStocks components, below.

---

## The app

Next.js 16 App Router, React 19, Tailwind v4, `@solana/wallet-adapter`.

| Route | What it does |
|---|---|
| `/` | The market as a mosaic, sized by on-chain liquidity, plus the baskets that exist |
| `/compose` | Click tiles to pick companies, drag weights, name the token, lay the basket |
| `/explore` | Every basket, with its backing proof and premium to its own components |
| `/basket/[address]` | One basket: recipe, vault contents, backing check, mint and redeem, and what buying the components costs |
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

To settle on devnet instead of a local validator, one script does the whole
cutover — deploy, mirror mints, seed baskets, and print the three environment
variables to change:

```bash
./scripts/go-devnet.sh
```

It needs about 3 SOL on the deploy wallet for a 280 KB program plus 20
Token-2022 mints. The devnet faucet rate-limits by IP, so if the script stops at
the balance check, fund the address it prints at
[faucet.solana.com](https://faucet.solana.com) and run it again.

Its last step matters for anyone hosting this. Until then the deploy wallet is the
mirror mints' mint authority, and the faucet route needs that authority's secret
key — which would mean putting a wallet that also holds the program's upgrade
authority into a hosting dashboard. `scripts/split-faucet-key.mjs` hands the mints
to a key that controls nothing else, so the only secret a deployment needs is one
that can mint twenty stand-ins on a test cluster.

Both setup scripts run dozens of transactions against a public endpoint that
answers a run like that with 429s, and a long enough burst of those outlives the
blockhash the transaction was signed against. `scripts/lib/rpc.mjs` is the retry
layer, and it is deliberately narrow about what it will retry: only failures that
prove the transaction never executed. Notably not `block height exceeded`, because
a transaction that expired in flight may still have landed, and a second
`mint_shares` is not a no-op. Every step is also idempotent, so an interrupted run
is finished by running it again.

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
tests/tessera.ts              10 integration tests, including the dividend and fee cases
web/lib/prestocks.ts          the 8 PreStocks pre-IPO mints
scripts/setup-mirror.mjs      creates the xStock mirror mints, writes mirror.generated.ts
scripts/setup-mirror-prestocks.mjs   the same, for PreStocks, transfer fee included
scripts/seed-baskets.mjs      a few baskets to look at
scripts/dbc-launch.mjs        opens a Meteora DBC pool sized from a basket's own NAV
scripts/split-faucet-key.mjs  moves mint authority off the deploy wallet
scripts/lib/rpc.mjs           what is safe to retry against a throttled endpoint
scripts/lib/color.mjs         OKLCH, colour-vision simulation, palette checks
scripts/gen-universe.mjs      regenerates web/lib/universe.ts from mainnet
scripts/build-diverging.mjs   generates and validates the 24h-move colour scale
web/                          the Next.js app
```

---

Not investment advice, and not an offer to sell anything. Tokenised equities are
issued by Backed Finance; Tessera neither issues nor custodies them beyond the
program vault a basket writes to.
