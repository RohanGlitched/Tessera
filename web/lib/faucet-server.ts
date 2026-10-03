import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** The faucet key, read from the server environment. It never leaves the server. */
export function faucetKeypair(): Keypair | null {
  const secret = process.env.FAUCET_SECRET_KEY;
  if (!secret) return null;
  try {
    if (secret.trim().startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    }
    return Keypair.fromSecretKey(bs58.decode(secret.trim()));
  } catch {
    return null;
  }
}
