/**
 * Retry helpers for the setup scripts, which each send dozens of transactions in
 * a row and get 429s back from the public devnet endpoint. web3.js retries the
 * 429s, but a long burst of them outlives the blockhash the transaction was
 * signed against, and the next attempt surfaces as "Transaction simulation
 * failed: Blockhash not found" — congestion wearing the costume of a bug.
 */

import {
  Connection,
  sendAndConfirmTransaction as sendOnce,
} from "@solana/web3.js";

/**
 * Failures that prove the transaction never executed, and the reason retrying is
 * safe: simulation failures happen before execution, 429s and dropped sockets
 * before submission, so re-sending cannot double-apply.
 *
 * "block height exceeded" is excluded on purpose. It means the blockhash expired
 * while the transaction was in flight, and a transaction in flight may still have
 * landed. Retrying builds a different transaction that could apply a second time,
 * and a second mint_shares is not a no-op.
 */
const NEVER_RAN =
  /Blockhash not found|429|Too Many Requests|failed to get recent blockhash|fetch failed|ECONNRESET|socket hang up|ETIMEDOUT|Unable to obtain|Node is behind/i;

/** Endpoint congestion, for the retry-until-it-lands helper below. */
const TRANSIENT = new RegExp(
  `${NEVER_RAN.source}|block height exceeded|timed out|timeout`,
  "i",
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const backoff = (attempt) => Math.min(1000 * 2 ** (attempt - 1), 8000);
const firstLine = (err) =>
  (err instanceof Error ? err.message : String(err)).split("\n")[0];

/** The default confirmation window is far too short once 429 backoff stacks up. */
export function resilientConnection(url) {
  return new Connection(url, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
}

/**
 * Send a transaction, retrying only failures that cannot have applied. The
 * blockhash is cleared before each attempt: reusing the expired one is why the
 * previous attempt failed.
 */
export async function sendResilient(
  connection,
  transaction,
  signers,
  options = {},
  // Devnet throttling arrives in bursts that outlast six attempts.
  attempts = 10,
) {
  for (let attempt = 1; ; attempt++) {
    transaction.recentBlockhash = undefined;
    transaction.lastValidBlockHeight = undefined;
    transaction.signatures = [];
    try {
      return await sendOnce(connection, transaction, signers, {
        commitment: "confirmed",
        maxRetries: 5,
        ...options,
      });
    } catch (err) {
      if (attempt >= attempts || !NEVER_RAN.test(firstLine(err))) throw err;
      const ms = backoff(attempt);
      console.log(`  ${firstLine(err)} — retrying in ${ms}ms`);
      await wait(ms);
    }
  }
}

/**
 * Retry a multi-transaction operation, guarded by a check for whether it already
 * took effect. `landed` runs before every attempt including the first, because a
 * 429 can arrive after the transaction it complained about was accepted; without
 * it the retry re-creates an account that now exists and fails permanently with
 * an error that looks nothing like the original.
 */
export async function withRetry(label, landed, send, attempts = 6) {
  for (let attempt = 1; ; attempt++) {
    if (await landed()) return;
    try {
      await send();
      return;
    } catch (err) {
      if (attempt >= attempts || !TRANSIENT.test(firstLine(err))) throw err;
      const ms = backoff(attempt);
      console.log(`  ${label}: ${firstLine(err)} — retrying in ${ms}ms`);
      await wait(ms);
    }
  }
}
