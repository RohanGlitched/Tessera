/**
 * Talking to a public RPC endpoint that does not want to talk to you.
 *
 * The setup scripts each send dozens of transactions in a row, and the public
 * devnet endpoint answers a run like that with 429s. The 429s themselves are
 * retried by web3.js, but a long enough burst of them outlives the blockhash the
 * transaction was signed against, and the next attempt comes back as
 * "Transaction simulation failed: Blockhash not found" — which reads like a bug
 * and is really just congestion.
 *
 * Both helpers here exist to survive that. They are deliberately conservative
 * about what they retry, because the dangerous case is not a failure, it is a
 * transaction that landed while we were being told it had not.
 */

import {
  Connection,
  sendAndConfirmTransaction as sendOnce,
} from "@solana/web3.js";

/**
 * Failures that prove the transaction never executed.
 *
 * This list is the safety argument for retrying at all. A simulation failure
 * happens before execution, and a 429 or a dropped socket happens before submission,
 * so re-sending cannot double-apply anything. Notably absent is
 * "block height exceeded": that one means the blockhash expired while the
 * transaction was in flight, and a transaction in flight may still have landed.
 * Retrying it with a fresh blockhash would build a *different* transaction that
 * could apply a second time, and a second mint_shares is not a no-op.
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

/**
 * A connection with a confirmation window wide enough for a throttled endpoint.
 * The default is far too short once 429 backoff starts stacking up.
 */
export function resilientConnection(url) {
  return new Connection(url, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 90_000,
  });
}

/**
 * Send a transaction, retrying only failures that cannot have applied.
 *
 * The blockhash is cleared before every attempt, because reusing the expired one
 * is exactly why the previous attempt failed.
 */
export async function sendResilient(
  connection,
  transaction,
  signers,
  options = {},
  // Ten rather than a handful. Public devnet throttling arrives in bursts that
  // comfortably outlast six attempts, and every retry here is provably safe.
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
 * Retry an operation that may be several transactions, guarded by a check for
 * whether it already took effect.
 *
 * `landed` is consulted before every attempt, including the first, because a 429
 * can arrive after the transaction it was complaining about has been accepted.
 * Without that check the retry re-sends a create-account instruction for an
 * account that now exists, and fails permanently with an error that reads nothing
 * like the original problem.
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
