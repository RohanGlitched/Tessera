import type { Connection, TransactionSignature } from "@solana/web3.js";

/**
 * Wait for a signature to reach "confirmed" by asking for its status, rather
 * than opening a WebSocket subscription: shared public endpoints rate-limit
 * sockets first, and a status poll is one small request a second.
 */
export async function confirmSignature(
  connection: Connection,
  signature: TransactionSignature,
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { value } = await connection
      .getSignatureStatuses([signature], { searchTransactionHistory: false })
      .catch(() => ({ value: [null] }));
    const status = value[0];
    if (status?.err) throw new Error(`The transaction failed: ${JSON.stringify(status.err)}`);
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The transaction was not confirmed in time. It may still land; check the explorer.");
}
