#!/usr/bin/env bash
#
# Move the write cluster from a local validator to devnet, in one run.
#
# Everything the app reads for prices already comes from mainnet and is untouched
# by this. What moves is settlement: the program, the mirror mints that stand in
# for the xStocks, and the handful of baskets worth looking at.
#
#   ./scripts/go-devnet.sh
#
# The only prerequisite this cannot do for itself is SOL. Deploying a 280 KB
# program plus 20 Token-2022 mints needs roughly 3 SOL on the deploy wallet, and
# the devnet faucet rate-limits by IP, so if the balance check below fails, get
# SOL into the printed address from https://faucet.solana.com and run this again.

set -euo pipefail
cd "$(dirname "$0")/.."

RPC="${DEVNET_RPC:-https://api.devnet.solana.com}"
WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
NEEDED_SOL=3

step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

step "Checking the deploy wallet"
ADDRESS=$(solana address --keypair "$WALLET")
BALANCE=$(solana --url "$RPC" balance "$ADDRESS" | awk '{print $1}')
echo "$ADDRESS has $BALANCE SOL on devnet"

if (( $(echo "$BALANCE < $NEEDED_SOL" | bc -l) )); then
  echo
  echo "Not enough SOL. Deploying needs about $NEEDED_SOL."
  echo "Trying the faucet once, then giving up so this does not spin:"
  solana --url "$RPC" airdrop 2 "$ADDRESS" || true
  BALANCE=$(solana --url "$RPC" balance "$ADDRESS" | awk '{print $1}')
  if (( $(echo "$BALANCE < $NEEDED_SOL" | bc -l) )); then
    echo
    echo "Still $BALANCE SOL. Fund $ADDRESS at https://faucet.solana.com and rerun." >&2
    exit 1
  fi
fi

step "Building and deploying the program to devnet"
anchor build
anchor deploy --provider.cluster "$RPC" --provider.wallet "$WALLET"
PROGRAM_ID=$(solana address -k target/deploy/tessera-keypair.json)
echo "Program $PROGRAM_ID"

step "Creating the mirror mints and regenerating web/lib/mirror.generated.ts"
# Reads each real mint's current ScaledUiAmountConfig multiplier off mainnet, so
# a mirror of a dividend-paying stock starts where the real one stands.
node scripts/setup-mirror.mjs --url devnet

step "Seeding a few baskets"
node scripts/seed-baskets.mjs --url "$RPC" --keypair "$WALLET"

step "Done. Point the app at devnet"
cat <<EOF

Set these in web/.env.local, keeping FAUCET_SECRET_KEY as it is:

  NEXT_PUBLIC_WRITE_CLUSTER=devnet
  NEXT_PUBLIC_WRITE_RPC=$RPC
  NEXT_PUBLIC_TESSERA_PROGRAM_ID=$PROGRAM_ID

Then rebuild:  cd web && pnpm build && pnpm start

The faucet wallet needs a little devnet SOL of its own to pay fees when it hands
out test tokens. Its address is the public key of FAUCET_SECRET_KEY.
EOF
