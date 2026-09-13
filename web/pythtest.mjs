import { PublicKey, Connection } from "@solana/web3.js";
const progs = {
  push: "pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRoZ",
  receiver: "rec5EKMGg6MxZYaMdyCfPVQbHcYFLqL9NLfEsFsjKvL",
};
const hex = "978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675"; // AAPLx/USD
const conn = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
for (const [pname, pid] of Object.entries(progs)) {
  for (const shard of [0, 1, 2, 3]) {
    const s = Buffer.alloc(2); s.writeUInt16LE(shard);
    const [pda] = PublicKey.findProgramAddressSync([s, Buffer.from(hex, "hex")], new PublicKey(pid));
    const info = await conn.getAccountInfo(pda);
    console.log(pname, "shard", shard, pda.toBase58(), info ? `len=${info.data.length} owner=${info.owner.toBase58()}` : "MISSING");
  }
}
