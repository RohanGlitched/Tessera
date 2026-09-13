# Tessera — Stocklana submission

Working notes for the submission form and the demo video. Not part of the product.

---

## One line

Anyone can launch an index fund of tokenised stocks in one transaction, and
nobody has to trust the person who launched it.

## The 100-word version

Launching an index fund today means a prospectus, an administrator, a custodian
and a transfer agent. Tessera replaces all four with one Solana program. You pick
up to eight tokenised equities and their weights; the program records how many raw
units of each stand behind one share, takes authority over a new share mint, and
gives up the ability to change either. Shares are created by depositing the actual
components and redeemed by withdrawing them, so no oracle is ever consulted and
backing per share can only rise. The creator earns up to 1% on creations, paid in
shares, never out of the vault.

## Who it is for, concretely

Three users, in the order they show up:

1. **Someone with a view.** "Semiconductors, equal weight" or "the companies
   whose balance sheets are a bitcoin trade." Today expressing that means buying
   five tickers and rebalancing by hand. Here it is one token they can hold, send,
   or point other people at — and they earn a fee if others use it.
2. **Someone who wants the exposure without the work.** They buy the share, or
   create it in kind, and hold one thing instead of eight.
3. **An arbitrageur.** The basket page prints the premium of the basket against
   its own components. When it is positive, creating shares and selling them is
   profitable; when negative, the reverse. This is the mechanism that keeps the
   token tracking its holdings, and it is available to anyone rather than to a
   handful of authorised participants.

## What a judge should click, in order

1. **`/`** — the market as a mosaic, tile area is real on-chain liquidity, colour
   is the real 24-hour move. Gold dots mark the tickers currently accruing
   dividends into their mint multiplier.
2. **`/compose`** — press "The big five," watch the weights and the per-share
   component quantities compute, then read the four figures: what one share is
   worth right now, what the basket would have done today, **how much of its
   value is dividends already collected on chain**, and which component's
   liquidity caps how large a mint can go.
3. **Lay the basket** — one or two signatures, depending on component count,
   because a Solana transaction holds 1232 bytes.
4. **The basket page** — the recipe in raw units beside what the vault actually
   holds, and the backing check: vault balance divided by outstanding shares,
   which must be at or above the recipe. That is the whole trust model on one
   screen.
5. **Mint, then redeem** — and see the backing figure hold.
6. **The last mile**, at the bottom of the basket page — press "100 shares."
   Every component quoted through Jupiter twice, dollars in and straight back
   out, so the round trip is the real cost of assembling a basket by hand. It is
   0.17% for one share and 0.26% for a hundred, with the venues named. This is
   the answer to the only serious objection to in-kind creation, and it is a
   measurement rather than a claim.
7. **`/method`** — including the section titled "What this gives up."

## Judging criteria, addressed

**Does it solve a real user need?** Index investing is the single most successful
retail financial product of the last fifty years, and the reason there are
thousands of funds rather than millions is that launching one costs a legal entity
and an administrator. Tessera makes the marginal cost of a new fund one
transaction. The need is not "I want an ETF on chain," it is "I have a view and no
way to package it."

**Is it functional?** Three program instructions, nine passing integration tests,
and a UI that runs the whole lifecycle: compose, create, redeem, and verify. Every
price and dividend multiplier is read live from Solana mainnet.

**Why Solana?** Four things collapse into one transaction — issuing the
instrument, taking custody of the backing, settling the exchange, and letting
anyone verify the backing afterwards. Beyond that, two Solana-specific reasons:
in-kind creation and redemption only keep a fund on track if arbitrage settles
before the price gap moves, and the dividend mechanism this design is built around
is a Token-2022 extension (`ScaledUiAmountConfig`), not an application feature.
The design would be wrong on a chain without token extensions.

**Execution quality.** No oracle anywhere. Rounding is directional so that
backing per share provably cannot fall. The creator fee cannot touch the vault.
Vaults are constrained to the basket's own associated token account. The recipe is
immutable with no instruction to change it. And the honest limitations are in the
product itself, on `/method`, not buried in a README.

## The one thing to say out loud in the video

Most tokenised-asset projects ask you to trust that something exists off chain.
Tessera asks you to trust nothing: open the basket page, and the number it shows
you is the vault's own token balance divided by the share mint's own supply. If
that number is at or above the recipe, every share is backed. You can compute it
yourself with two RPC calls.

---

## Submission form copy

Paste these three straight into the Project Info step.

### Project Name

```
Tessera
```

### Short Description (280 max)

```
Anyone can launch an index fund of tokenized stocks in one transaction, and nobody has to trust the person who launched it. Baskets are backed in kind by a program vault, so no oracle is ever consulted and anyone can verify every share is fully backed with two RPC calls.
```

### Full Description (Markdown, 5000 max)

```markdown
## What it is

An index fund is two things: a list of companies and a set of weights. Everything else the industry grew around it — a prospectus, an administrator, a custodian, a transfer agent — is administration. Tessera keeps the two things and deletes the administration.

Pick up to eight tokenized equities, set their weights, and Tessera writes a recipe into a Solana program and hands it authority over a new share mint. The share becomes a claim on specific quantities of specific tokens in a vault anyone can read: create shares by depositing the components, redeem them by taking them back. No oracle is consulted, no manager can rebalance you, and no upgrade path lets the creator change what your share is a claim on. The creator earns up to 1% on every share created, paid in shares of their own basket, never out of the vault.

## Who it is for

**Someone with a view** — "semiconductors, equal weight" — who today would buy five tickers and rebalance by hand, and now holds one token others can buy too, earning a fee when they do. **Someone who wants that exposure without the work** holds the share instead of eight tokens. And **an arbitrageur** keeps it tracking: every basket page prints its premium against its own components, so that trade is open to anyone.

## Why it has to be on chain, and why Solana

Four things collapse into one transaction and cannot collapse anywhere else: issuing the instrument, taking custody of its backing, settling the exchange, and letting anybody verify the backing afterwards. An administrator does the first three; an auditor does the fourth, quarterly. Here the fourth is a `getTokenAccountBalance` call anyone can make, and every basket page makes it on load.

Solana in particular, on two counts:

1. **In-kind creation and redemption are only useful if they are cheap and immediate.** What keeps a fund tracking its holdings is arbitrage between the basket and its components, and that has to settle before the gap moves. Fractions of a cent per transaction are what make a hundred-dollar basket worth creating at all.
2. **Token-2022 is load-bearing, not incidental.** These equities pay dividends by raising a `ScaledUiAmountConfig` multiplier rather than transferring anything, so a recipe in *displayed* balances would be short by exactly the dividends already accrued. Tessera writes recipes in raw units and multiplies through the live multiplier when pricing. The design would be wrong on a chain without token extensions.

## The decisions worth arguing about

- **In kind, so there is no price to argue with.** No oracle to go stale, manipulate, or pay for. Redemption cannot fail for market reasons: if every buyer disappears, a share is still a claim on specific tokens in a specific vault.
- **Rounding always favors the people still holding.** Deposits round up and withdrawals round down, so the vault holds at or above what the outstanding shares can claim. Backing per share never falls, and the dust accrues to holders rather than to the fund.
- **The fee comes out of shares, never the vault.** A creator who wants more has one lever: get more people to create shares. They cannot dilute holders or reach into the vault, because no instruction lets them.

## What is real

Prices, 24-hour moves, liquidity, holder counts and dividend multipliers are read live from Solana mainnet on every page load, and the 20 tokenized equities are the real xStocks by Backed Finance. Nothing on screen is a placeholder.

Creating and redeeming run on devnet against faithful mirrors of the same mints: Token-2022, the same decimals, the same metadata, and a scaled-UI multiplier seeded from the live mainnet value. An unaudited program should not hold real tokenized Apple, and invented devnet prices would make every number a lie. Swapping the mirrors for the real mints is one generated file.

## What it gives up, measured rather than asserted

Creating shares requires holding every component first. That is the cost of refusing to trust a price. Rather than claim the cost is small, every basket page measures it: each component is quoted through Jupiter twice, dollars in and then straight back out, so the round trip is measured against one router instead of against a price feed that might disagree. On a live eight-component basket that is 0.17% for one share and 0.26% for a hundred, with the venues named per leg.

The tokens are issued by Backed Finance. Tessera does not remove counterparty risk in a tokenized equity, only in the wrapper around it.

## Execution

Three program instructions and nine passing integration tests, including one that raises a component's dividend multiplier mid-test and asserts that raw mint and redeem amounts are unchanged. Vaults are constrained to the basket's own associated token account. Creation splits across two signatures when a basket would overflow Solana's 1232-byte packet limit. The limitations live in the product itself, on `/method`, not buried in a README.
```

---

## Demo video, 2 minutes 30

| Time | Shot | Said |
|---|---|---|
| 0:00–0:15 | `/` loading, the mosaic drawing | "Twenty tokenised stocks, live on Solana. Tile size is real liquidity, colour is today's move." |
| 0:15–0:35 | Hover a gold-dotted tile, tooltip open | "The gold dot means that company paid a dividend, and it arrived as a multiplier on the mint rather than a payment. That detail decides the whole design." |
| 0:35–1:05 | `/compose`, press a preset, drag one weight | "Pick companies, set weights. This is a fund launch. There is no entity, no administrator, no custodian." |
| 1:05–1:20 | The four figures, pointing at "Dividends already inside" | "This is the share of the basket's value that is dividends already collected on chain. Nothing else prices that." |
| 1:20–1:40 | Lay the basket, wallet approval, success screen | "One transaction. The program now owns the share mint and cannot change the recipe." |
| 1:40–2:10 | Basket page: recipe beside vault, the backing check | "Recipe on the left, what the vault actually holds on the right. Backing per share: computed from the vault's balance and the mint's supply. Two RPC calls, and you never trust me." |
| 2:10–2:25 | Mint, then redeem, backing figure unchanged | "Create in kind. Redeem in kind. Rounding always favours whoever is still holding, so this number can only go up." |
| 2:25–2:45 | The last mile, press "One share" then "100 shares" | "The obvious objection: you need all eight tokens first. So here is what that costs, quoted live — 0.17% for one share, 0.26% for a hundred. Not a claim. A measurement." |
| 2:45–2:50 | `/method`, scrolled to "What this gives up" | "And here is the rest of what it costs you." |

Record at 1440×900. The composer is laid out for that width. Runs to 2:50 with the
last-mile beat; cut the dividend-tooltip shot at 0:15 if a hard 2:30 is required.

---

## Before you record: what the wallet on screen needs

The site is on devnet, so the wallet in the browser has to be too, and it has to
have a little SOL. Nothing else is a prerequisite — the tokens come from the app.

**1. Put the wallet on devnet.** Phantom: Settings → Developer Settings → Testnet
Mode on, then pick Solana Devnet. Solflare: the network dropdown, top right.
Getting this wrong is the one failure that looks like a bug on camera — the site
will load fine, the wallet will connect fine, and the transaction will fail with
something unhelpful.

**2. Put SOL in it.** One SOL is roughly fifty basket launches, so there is no
reason to be careful. Either use [faucet.solana.com](https://faucet.solana.com),
or send it from the wallet that did the deploy, which still holds about 3:

```bash
solana transfer <YOUR_BROWSER_WALLET> 1 --url devnet --allow-unfunded-recipient
```

**3. Do not fund it with the component tokens.** Press **Get test tokens** in the
app instead. The button is on every basket page and on the portfolio, and it
hands over all eight components at once. The faucet pays for the token accounts
as well as the tokens, so this step costs the wallet on screen nothing at all.
There is a 60-second cooldown per wallet, so press it once before you start
recording rather than mid-take.

Where the SOL actually goes, for the record: launching an eight-component basket
costs **0.0183 SOL**, and all of it is rent on accounts that did not exist before
— 0.0024 for the share mint, 0.0039 for the basket's own record, and 0.0015 for
each of the eight vaults. Fees are the rounding error. Minting and redeeming
after that are fractions of a cent, because the accounts already exist.

## Still to do before submitting

- [x] **Devnet.** Program, 20 mirror mints and three baskets are live on devnet,
      and the faucet answers to a key that holds nothing else.
- [x] **Host it.** Deployed to Vercel with the four environment variables set for
      production and preview.
- [ ] **Turn off Vercel's deployment protection**, or the judges get a login wall
      instead of the app. Project → Settings → Deployment Protection → Vercel
      Authentication → Disabled.
- [ ] **Push the repository.** The remote is set and the commits are ready; the
      push needs a credential GitHub will accept from this machine.
- [ ] **Record the video** to the table above.
