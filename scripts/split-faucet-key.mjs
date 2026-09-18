/**
 * Give the faucet its own key, so a hosted deployment holds nothing valuable.
 *
 * `setup-mirror.mjs` creates the mirror mints with the deploy wallet as mint
 * authority, which is convenient and fine on a laptop. It stops being fine the
 * moment the app is hosted: the faucet route needs the mint authority's secret
 * key in an environment variable, and the deploy wallet is usually the developer's
 * default Solana keypair — the one that also holds the program's upgrade authority
 * and, on a bad day, real money.
 *
 * So this moves the mint authority of every mirror mint onto a key that exists for
 * nothing else. After it runs, FAUCET_SECRET_KEY controls exactly twenty stand-in
 * mints on a test cluster and not one thing more. The upgrade authority stays where
 * it was, on the deploy wallet, which never leaves the machine.
 *
 *   node scripts/split-faucet-key.mjs --url devnet
 *
 * Idempotent. Mints already handed over are reported and skipped, so an
 * interrupted run is finished by running it again.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  AuthorityType,
  TOKEN_2022_PROGRAM_ID,
  createSetAuthorityInstruction,
  getMint,
} from "@solana/spl-token";
import { resilientConnection, sendResilient } from "./lib/rpc.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE = path.join(ROOT, ".mirror-state.json");
const PRESTOCKS_STATE = path.join(ROOT, ".mirror-state-prestocks.json");
const KEY_FILE = path.join(ROOT, ".faucet-key.json");
const ENV_FILE = path.join(ROOT, "web/.env.local");

/** SOL the faucet needs of its own, purely to pay fees when it hands out tokens. */
const TOP_UP_TO = 0.3;

const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};

const URLS = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};
const clusterArg = flag("url", "localnet");
const cluster = URLS[clusterArg] ? clusterArg : "custom";
const rpc = URLS[clusterArg] ?? clusterArg;

const loadKeypair = (file) =>
  Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(file, "utf8"))),
  );

const authorityPath =
  flag("keypair") ?? path.join(os.homedir(), ".config/solana/id.json");
const authority = loadKeypair(authorityPath);

/**
 * The faucet key, reused if it exists.
 *
 * Generating a fresh one on every run would abandon the mints already handed to
 * the previous key, and there is no way back: the old authority has signed itself
 * out of them.
 */
function faucetKeypair() {
  if (fs.existsSync(KEY_FILE)) return { keypair: loadKeypair(KEY_FILE), fresh: false };
  const keypair = Keypair.generate();
  fs.writeFileSync(
    KEY_FILE,
    `${JSON.stringify(Array.from(keypair.secretKey))}\n`,
    { mode: 0o600 },
  );
  return { keypair, fresh: true };
}

/**
 * Point FAUCET_SECRET_KEY at the new key without disturbing anything else in the
 * file, and without the value ever reaching stdout.
 */
function writeEnv(keypair) {
  const encoded = JSON.stringify(Array.from(keypair.secretKey));
  const line = `FAUCET_SECRET_KEY=${encoded}`;
  if (!fs.existsSync(ENV_FILE)) {
    fs.writeFileSync(ENV_FILE, `${line}\n`, { mode: 0o600 });
    return "created";
  }
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
  const at = lines.findIndex((l) => /^FAUCET_SECRET_KEY=/.test(l));
  if (at >= 0) lines[at] = line;
  else lines.push(line);
  fs.writeFileSync(ENV_FILE, lines.join("\n"), { mode: 0o600 });
  return at >= 0 ? "updated" : "appended";
}

const connection = resilientConnection(rpc);

async function main() {
  if (!fs.existsSync(STATE)) {
    console.error(
      `No ${path.relative(ROOT, STATE)}. Run scripts/setup-mirror.mjs first.`,
    );
    process.exit(1);
  }
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const prestocksState = fs.existsSync(PRESTOCKS_STATE)
    ? JSON.parse(fs.readFileSync(PRESTOCKS_STATE, "utf8"))
    : {};
  // Two separate mirror pipelines, xStocks and PreStocks, each with its own
  // state file — merged here so one faucet key ends up authority over both.
  const mints = { ...(state[cluster] ?? {}), ...(prestocksState[cluster] ?? {}) };
  if (Object.keys(mints).length === 0) {
    console.error(`No mirror mints recorded for ${cluster}.`);
    process.exit(1);
  }

  const { keypair: faucet, fresh } = faucetKeypair();
  console.log(`cluster   ${cluster} (${rpc})`);
  console.log(`authority ${authority.publicKey.toBase58()}`);
  console.log(`faucet    ${faucet.publicKey.toBase58()} (${fresh ? "new" : "existing"})`);
  console.log(`mints     ${Object.keys(mints).length}\n`);

  let moved = 0;
  let already = 0;
  const stuck = [];

  for (const [symbol, entry] of Object.entries(mints)) {
    const mint = new PublicKey(entry.mint);
    const info = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const current = info.mintAuthority?.toBase58() ?? null;

    if (current === faucet.publicKey.toBase58()) {
      console.log(`= ${symbol.padEnd(7)} already the faucet's`);
      already++;
      continue;
    }
    if (current !== authority.publicKey.toBase58()) {
      console.log(`! ${symbol.padEnd(7)} authority is ${current ?? "none"}, cannot move it`);
      stuck.push(symbol);
      continue;
    }

    await sendResilient(
      connection,
      new Transaction().add(
        createSetAuthorityInstruction(
          mint,
          authority.publicKey,
          AuthorityType.MintTokens,
          faucet.publicKey,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      ),
      [authority],
    );
    console.log(`> ${symbol.padEnd(7)} handed over`);
    moved++;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // Fees only. The faucet mints tokens it has authority over; it never needs to
  // hold any of them, and it should never hold anything worth taking.
  const balance = (await connection.getBalance(faucet.publicKey)) / 1e9;
  if (balance < TOP_UP_TO / 2) {
    const lamports = Math.round((TOP_UP_TO - balance) * 1e9);
    await sendResilient(
      connection,
      new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: faucet.publicKey,
          lamports,
        }),
      ),
      [authority],
    );
    console.log(`\ntopped the faucet up to ${TOP_UP_TO} SOL for fees`);
  } else {
    console.log(`\nfaucet holds ${balance.toFixed(4)} SOL for fees, enough`);
  }

  const what = writeEnv(faucet);
  console.log(`FAUCET_SECRET_KEY ${what} in ${path.relative(ROOT, ENV_FILE)}`);
  console.log(
    `secret also at ${path.relative(ROOT, KEY_FILE)} (gitignored, mode 600)`,
  );
  console.log(`\nmoved ${moved}, already done ${already}, stuck ${stuck.length}`);

  if (stuck.length) {
    console.error(`\nCould not move: ${stuck.join(", ")}`);
    process.exit(1);
  }
  console.log(
    "\nThe deploy wallet keeps the program's upgrade authority. The faucet key now\n" +
      "controls nothing but these mirror mints, so it is the only secret a hosted\n" +
      "deployment needs.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
