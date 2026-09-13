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
6. **`/method`** — including the section titled "What this gives up."

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
| 2:25–2:30 | `/method`, scrolled to "What this gives up" | "And here is what it costs you." |

Record at 1440×900. The composer is laid out for that width.

---

## Still to do before submitting

- [ ] **Devnet.** `./scripts/go-devnet.sh` does the whole cutover but needs about
      3 SOL on `7md5ecBazJtGoHEkRvQaVSdNz7pyJrbmrHgx1L5NVJb4`. The faucet
      rate-limits this IP, so the SOL has to come from
      [faucet.solana.com](https://faucet.solana.com) in a browser.
- [ ] **Host it.** The read side works from anywhere; the write side needs devnet
      done first. Deploying needs a Vercel/Netlify login, and the four variables
      from `web/.env.example` set in the dashboard — `FAUCET_SECRET_KEY` as a
      secret, not a public one.
- [ ] **Push the repository** and put the URL in the submission form.
- [ ] **Record the video** to the table above.
